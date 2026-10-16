import { html, type PropertyValues, type TemplateResult } from "lit";
import type { SkinOutput } from "../skins/core.js";
import { DockoramaPart } from "./part.js";

/** An entry of `<dockorama-menu>`: a command, a radio item (`checked` set) or a separator. */
export type MenuEntry = { label: string; action: string; id: string; checked?: boolean } | "separator";

/** Lists longer than this are virtualised: only the rows in view are rendered. */
export const VIRTUAL_AFTER = 40;
/** Row height (px) of a virtualised list. */
const ROW = 30;
const SHOW = 12;

/**
 * `<dockorama-menu>`: a positioned `role="menu"` popup (view actions and the tab list of a group).
 * Arrow keys move, Esc closes; choosing sends the entry's action as a request. A tab list longer than
 * `VIRTUAL_AFTER` renders only the rows in view (fixed `ROW` height), so groups with hundreds of tabs stay fast.
 */
export class DockoramaMenu extends DockoramaPart {
  static override properties = {
    entries: { attribute: false },
    x: { type: Number },
    y: { type: Number },
    _top: { state: true }
  };
  entries: MenuEntry[] = [];
  x = 0;
  y = 0;
  private _top = 0;

  protected override get listeners() {
    return { keydown: this.onKey };
  }

  /** The leading radio items (the tab list) and the rest. */
  private split(): { list: MenuEntry[]; rest: MenuEntry[] } {
    const n = this.entries.findIndex((e) => e === "separator" || e.checked === undefined);
    const cut = n < 0 ? this.entries.length : n;
    return { list: this.entries.slice(0, cut), rest: this.entries.slice(cut) };
  }

  /** True when the tab list is virtualised. */
  get virtual(): boolean {
    return this.split().list.length > VIRTUAL_AFTER;
  }

  /** Scroll the virtual list so row `index` is in view and focus it. */
  async showRow(index: number): Promise<void> {
    const box = this.querySelector<HTMLElement>(".menu-scroll");
    if (!box) return;
    const h = SHOW * ROW;
    if (index * ROW < box.scrollTop) box.scrollTop = index * ROW;
    else if ((index + 1) * ROW > box.scrollTop + h) box.scrollTop = (index + 1) * ROW - h;
    this._top = box.scrollTop;
    await this.updateComplete;
    this.querySelector<HTMLButtonElement>(`button[data-index="${index}"]`)?.focus();
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    const focused = this.querySelector<HTMLButtonElement>("button:focus");
    const row = focused?.dataset["index"];
    if (e.key === "Escape") this.request("menu-close");
    else if (row !== undefined && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End")) {
      const count = this.split().list.length;
      const i = Number(row);
      const next = e.key === "Home" ? 0 : e.key === "End" ? count - 1 : i + (e.key === "ArrowDown" ? 1 : -1);
      if (next >= count) this.querySelector<HTMLButtonElement>(".menu-rest button")?.focus();
      else void this.showRow(Math.max(0, next));
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const items = Array.from(this.querySelectorAll<HTMLButtonElement>("button"));
      const i = items.indexOf(focused as HTMLButtonElement);
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("menu");
    this.mark("part", "menu");
    this.mark("role", "menu");
    this.mark("data-virtual", this.virtual);
    this.style.cssText = `left:${this.x}px;top:${this.y}px`;
  }

  private item(it: Exclude<MenuEntry, "separator">, index?: number, style?: string): SkinOutput {
    return this.paint("menu-item", {
      label: it.label, role: it.checked === undefined ? "menuitem" : "menuitemradio",
      ...(it.checked === undefined ? {} : { checked: it.checked }), ...(index === undefined ? {} : { index }), ...(style ? { style } : {}),
      choose: () => this.request(it.action, { id: it.id, fromMenu: true })
    });
  }

  override render(): TemplateResult {
    const { list, rest } = this.split();
    const plain = (items: MenuEntry[]) => items.map((it) => (it === "separator" ? this.paint("menu-separator", {}) : this.item(it)));
    if (list.length <= VIRTUAL_AFTER) return html`${plain(this.entries)}`;
    const first = Math.max(0, Math.floor(this._top / ROW) - 4);
    const last = Math.min(list.length, first + SHOW + 8);
    const rows = list.slice(first, last).map((it, k) =>
      this.item(it as Exclude<MenuEntry, "separator">, first + k, `position:absolute;top:${(first + k) * ROW}px;height:${ROW}px`));
    return html`<div class="menu-scroll" role="group" style="height:${SHOW * ROW}px"
        @scroll=${(e: Event) => { this._top = (e.currentTarget as HTMLElement).scrollTop; }}>
        <div class="menu-rows" style="height:${list.length * ROW}px">${rows}</div>
      </div><div class="menu-rest">${plain(rest)}</div>`;
  }
}
