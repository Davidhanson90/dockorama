import { afterEach, describe, expect, it } from "vitest";
import { createModel, defineParts, docs, row, stack, DEFAULT_LABELS, type DockContext, type PartRequest } from "../index.js";

defineParts();
const views = { a: { title: "Alpha", icon: "★" }, b: { title: "Beta" }, c: { title: "Gamma", caps: { dismiss: false, hide: false, zoom: false, float: false, popout: false, inert: true } } };
export const ctx = (over: Partial<DockContext> = {}): DockContext => ({
  model: createModel(views, row([stack(["a", "b"]), docs(["c"])])), labels: DEFAULT_LABELS, popped: new Set(), dragging: false, ...over
});
async function put<T extends HTMLElement & { updateComplete: Promise<boolean> }>(tag: string, props: Record<string, unknown>): Promise<T> {
  const el = document.createElement(tag) as T;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}
export function requests(): PartRequest[] {
  const out: PartRequest[] = [];
  document.addEventListener("dockorama-request", (e) => out.push((e as CustomEvent<PartRequest>).detail));
  return out;
}
afterEach(() => { document.body.innerHTML = ""; });

type P = HTMLElement & { updateComplete: Promise<boolean>; selected: boolean };
describe("<dockorama-tab>", () => {
  it("reflects tab semantics and sends reveal, grab and dismiss", async () => {
    const got = requests();
    const el = await put<P>("dockorama-tab", { view: "a", info: views.a, selected: true, closable: true, closeLabel: "Shut", win: "w" });
    const main = el.querySelector<HTMLElement>(".tab-main")!;
    expect(main.id).toBe("tab-a");
    expect(el.getAttribute("role")).toBe("presentation");
    expect(main.getAttribute("role")).toBe("tab");
    expect(el.getAttribute("part")).toBe("tab tab-current");
    expect(main.getAttribute("aria-selected")).toBe("true");
    expect(main.tabIndex).toBe(0);
    // The close button is a sibling of the tab, not inside it.
    expect(main.querySelector("button")).toBeNull();
    expect(main.nextElementSibling?.getAttribute("part")).toBe("tab-close");
    expect(main.textContent).not.toContain("Shut");
    expect(el.dataset["view"]).toBe("a");
    expect(el.querySelector(".label")!.textContent).toBe("Alpha");
    const close = el.querySelector<HTMLButtonElement>('[part="tab-close"]')!;
    expect(close.getAttribute("aria-label")).toBe("Shut Alpha");
    el.click();
    el.dispatchEvent(new MouseEvent("pointerdown"));
    el.dispatchEvent(new MouseEvent("auxclick", { button: 1 }));
    el.dispatchEvent(new MouseEvent("auxclick", { button: 2 }));
    close.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    close.click();
    expect(got.map((r) => r.action)).toEqual(["reveal", "grab", "dismiss", "dismiss"]);
    expect(got[1]).toMatchObject({ id: "a", win: "w", source: el });
    el.selected = false;
    await el.updateComplete;
    expect(el.getAttribute("part")).toBe("tab");
    expect(main.tabIndex).toBe(-1);
    el.remove();
    el.click();
    expect(got.length).toBe(4);
  });
  it("moves between the tabs of a strip with arrow keys (mirrored in RTL), Home and End, and closes with Delete", async () => {
    const got = requests();
    const strip = document.createElement("div");
    strip.className = "tabs";
    document.body.append(strip);
    const tabs = await Promise.all(["a", "b", "c"].map(async (v) => {
      const t = document.createElement("dockorama-tab") as P & { view: string; closable: boolean };
      Object.assign(t, { view: v, info: { title: v }, selected: v === "a", closable: true });
      strip.append(t);
      await t.updateComplete;
      return t;
    }));
    const main = (i: number) => tabs[i]!.querySelector<HTMLElement>(".tab-main")!;
    const press = (i: number, key: string) => { const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }); main(i).dispatchEvent(e); return e; };
    main(0).focus();
    expect(press(0, "ArrowRight").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(main(1));
    expect(got.at(-1)).toMatchObject({ action: "reveal", id: "b" });
    press(1, "ArrowLeft");
    expect(got.at(-1)).toMatchObject({ action: "reveal", id: "a" });
    press(0, "ArrowLeft"); // wraps
    expect(got.at(-1)).toMatchObject({ action: "reveal", id: "c" });
    press(0, "End");
    expect(got.at(-1)).toMatchObject({ action: "reveal", id: "c" });
    press(2, "Home");
    expect(got.at(-1)).toMatchObject({ action: "reveal", id: "a" });
    press(1, "Delete");
    expect(got.at(-1)).toMatchObject({ action: "dismiss", id: "b" });
    const n = got.length;
    const withAlt = new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true, cancelable: true });
    main(0).dispatchEvent(withAlt);
    expect(withAlt.defaultPrevented).toBe(false);
    expect(got.length).toBe(n);
    strip.dir = "rtl";
    strip.style.direction = "rtl";
    press(0, "ArrowRight");
    expect(got.at(-1)).toMatchObject({ action: "reveal", id: "c" });
    press(0, "ArrowLeft");
    expect(got.at(-1)).toMatchObject({ action: "reveal", id: "b" });
  });
  it("falls back to the id without info and has no close button by default", async () => {
    const el = await put<P>("dockorama-tab", { view: "zzz" });
    expect(el.textContent).toContain("zzz");
    expect(el.querySelector(".glyph")).toBeNull();
    expect(el.querySelector("button")).toBeNull();
  });
});
