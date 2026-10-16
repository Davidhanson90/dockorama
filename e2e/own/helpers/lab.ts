import { expect, type Locator, type Page } from "@playwright/test";
import type { Lab, LabEvent, MountOptions } from "../../../harness/lab-main.js";

declare global {
  interface Window { lab: Lab; labReady: boolean }
}

export type Zone = "left" | "right" | "above" | "below" | "into" | "edge-left" | "edge-right" | "edge-above" | "edge-below";
export type Pt = { x: number; y: number };
type ModelLike = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const BASE = process.env["DOCKORAMA_SITE"] ?? "";

/** Opens the deterministic lab page (harness/lab.html) and waits for the API to be ready. */
export async function openLab(page: Page, query = ""): Promise<void> {
  await page.goto(`${BASE}/lab.html${query}`);
  await page.waitForFunction(() => window.labReady === true);
}

/** Page object for one `<dockorama-manager>` in the lab. Shadow DOM is pierced by Playwright locators. */
export class Dock {
  readonly el: Locator;
  constructor(readonly page: Page, readonly name = "main") {
    this.el = page.locator(`#${name}`);
  }

  /** Mounts the standard layout (or the options given) and waits for it to render. */
  static async mount(page: Page, options: MountOptions = {}, query = ""): Promise<Dock> {
    await openLab(page, query);
    const name = options.name ?? "main";
    await page.evaluate((o) => { window.lab.mount(o); }, { ...options, name });
    const d = new Dock(page, name);
    await expect(d.el.locator("[data-stack]").first()).toBeVisible();
    return d;
  }

  /** Mounts a manager built in the page by `build` (receives `window.lab`). */
  static async mountWith<A>(page: Page, build: (lab: Lab, arg: A) => MountOptions, arg: A, query = ""): Promise<Dock> {
    await openLab(page, query);
    const name = await page.evaluate(([fn, a]) => {
      const o = (new Function("lab", "arg", `return (${fn})(lab, arg)`))(window.lab, a) as MountOptions;
      return window.lab.mount(o).id;
    }, [build.toString(), arg] as const);
    const d = new Dock(page, name);
    await expect(d.el.locator("[data-stack]").first()).toBeVisible();
    return d;
  }

  /** Adds a further manager (same page) and returns its page object. */
  async mountAnother(name: string, options: MountOptions = {}): Promise<Dock> {
    await this.page.evaluate((o) => { window.lab.mount(o); }, { ...options, name });
    return new Dock(this.page, name);
  }

  // --- locators -------------------------------------------------------------------------------------------
  stack(id: string): Locator { return this.el.locator(`[data-stack="${id}"]`); }
  stacks(): Locator { return this.el.locator("[data-stack]"); }
  tab(title: string): Locator { return this.el.getByRole("tab").filter({ has: this.page.getByText(title, { exact: true }) }); }
  /** The close button next to the tab with this title (it is a sibling of the role="tab" element, not inside it). */
  closeOf(title: string): Locator { return this.el.locator("dockorama-tab").filter({ has: this.page.getByRole("tab").filter({ has: this.page.getByText(title, { exact: true }) }) }).locator('[part~="tab-close"]'); }
  /** The `dockorama-tab` wrapper by view id: holds the role="tab" element and its close button. */
  tabOf(id: string): Locator { return this.el.locator(`dockorama-tab[data-view="${id}"]`); }
  tabs(within?: Locator): Locator { return (within ?? this.el).getByRole("tab"); }
  selectedTab(): Locator { return this.el.locator('[role="tab"][aria-selected="true"]'); }
  /** The role="tab" element by view id. */
  tabMain(id: string): Locator { return this.tabOf(id).locator('[role="tab"]'); }
  gutters(): Locator { return this.el.getByRole("separator"); }
  windows(): Locator { return this.el.locator('.window[role="dialog"]'); }
  window(title: string): Locator { return this.el.locator(".window").filter({ hasText: title }); }
  rail(): Locator { return this.el.locator(".rail-item"); }
  drawer(): Locator { return this.el.locator(".drawer"); }
  target(zone: Zone): Locator { return this.el.locator(`.target[data-zone="${zone}"]`); }
  hotTarget(zone: Zone): Locator { return this.el.locator(`.target[data-zone="${zone}"][data-hot]`); }
  content(id: string): Locator { return this.el.locator(`[data-content="${id}"]`); }
  stackButton(id: string, part: string): Locator { return this.stack(id).locator(`[part~="${part}"]`).first(); }

  // --- state ----------------------------------------------------------------------------------------------
  async model(): Promise<ModelLike> {
    return this.el.evaluate((el) => JSON.parse(JSON.stringify((el as unknown as { model: unknown }).model)));
  }
  async snapshot(): Promise<ModelLike> {
    return this.el.evaluate((el) => JSON.parse(JSON.stringify((el as unknown as { snapshot(): unknown }).snapshot())));
  }
  async call<R = unknown>(method: string, ...args: unknown[]): Promise<R> {
    return this.el.evaluate((el, [m, a]) => (el as unknown as Record<string, (...x: unknown[]) => unknown>)[m as string]!(...(a as unknown[])) as never, [method, args] as const);
  }
  async prop<R = unknown>(name: string): Promise<R> {
    return this.el.evaluate((el, n) => JSON.parse(JSON.stringify((el as unknown as Record<string, unknown>)[n] ?? null)), name);
  }
  /** Ids of the views of the group that contains `viewId` (tab order), read from the model. */
  async order(viewId: string): Promise<string[]> {
    const m = await this.model();
    const find = (n: any): string[] | undefined => n.kind === "stack" ? (n.views.includes(viewId) ? n.views : undefined) : n.children.map(find).find(Boolean); // eslint-disable-line @typescript-eslint/no-explicit-any
    return [m["root"], ...m["windows"].map((w: any) => w.tree)].filter(Boolean).map(find).find(Boolean) ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  /** An item of the open tab menu by its command key (close, close-others, pin, float, split-right, ...). */
  menuItem(key: string): Locator { return this.el.locator(`dockorama-tab-menu [data-key="${key}"]`); }
  /** Opens the tab menu of a tab with a right-click. */
  async openTabMenu(title: string): Promise<void> {
    await this.tab(title).click({ button: "right" });
    await expect(this.el.locator("dockorama-tab-menu")).toBeVisible();
  }

  // --- events ---------------------------------------------------------------------------------------------
  async events(name?: string): Promise<LabEvent[]> {
    const all = await this.page.evaluate((m) => window.lab.events.filter((e) => e.manager === m), this.name);
    return name ? all.filter((e) => e.name === `dockorama-${name}`) : all;
  }
  async eventNames(): Promise<string[]> { return (await this.events()).map((e) => e.name.replace("dockorama-", "")); }
  async clearEvents(): Promise<void> { await this.page.evaluate(() => window.lab.clearEvents()); }
  /** Waits until at least `n` events of this name were recorded and returns them. */
  async waitForEvent(name: string, n = 1): Promise<LabEvent[]> {
    await expect.poll(async () => (await this.events(name)).length, { message: `event ${name}` }).toBeGreaterThanOrEqual(n);
    return this.events(name);
  }

  // --- pointer helpers ------------------------------------------------------------------------------------
  async center(l: Locator): Promise<Pt> {
    const b = await l.boundingBox();
    if (!b) throw new Error("element has no box");
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  /** Moves the pointer in steps so drag logic sees real movement. */
  async glide(from: Pt, to: Pt, steps = 10): Promise<void> {
    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down();
    await this.page.mouse.move(from.x + 12, from.y + 18, { steps: 3 });
    await this.page.mouse.move(to.x, to.y, { steps });
  }
  async drag(from: Pt, to: Pt): Promise<void> {
    await this.glide(from, to);
    await this.page.mouse.up();
  }
  /** Starts dragging a tab and hovers a point (the drag stays active until `release`). */
  async hold(tab: Locator, to: Pt): Promise<void> { await this.glide(await this.center(tab), to); }
  async release(): Promise<void> { await this.page.mouse.up(); }
  /** Drags a tab to hover an overlay drop target of a group; resolves once the target is hot. */
  async dragTabToZone(title: string, targetStack: string, zone: Zone, release = true): Promise<void> {
    const tab = this.tab(title);
    const stack = this.stack(targetStack);
    await this.hold(tab, await this.center(stack));
    if (zone.startsWith("edge-")) await this.page.mouse.move(...(await this.pt(this.target(zone))), { steps: 10 });
    else await this.page.mouse.move(...(await this.pt(this.target(zone))), { steps: 6 });
    await expect(this.hotTarget(zone)).toBeVisible();
    if (release) await this.release();
  }
  private async pt(l: Locator): Promise<[number, number]> { const c = await this.center(l); return [c.x, c.y]; }
  /** Drags the splitter `index` by `dx`/`dy` pixels. */
  async dragGutter(index: number, dx: number, dy = 0): Promise<void> {
    const c = await this.center(this.gutters().nth(index));
    await this.drag(c, { x: c.x + dx, y: c.y + dy });
  }
  async width(l: Locator): Promise<number> { return (await l.boundingBox())!.width; }
  async height(l: Locator): Promise<number> { return (await l.boundingBox())!.height; }
}

/** Collects console errors and uncaught exceptions for the duration of a test. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return errors;
}
