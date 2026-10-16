import { html, type PropertyValues, type TemplateResult } from "lit";
import { DockoramaPart } from "./part.js";

/**
 * One item of a tab's context menu. Built-in items carry a `key` the manager acts on; your own items
 * (added through the manager's `tabMenu` hook) carry a `run` callback. `"separator"` draws a rule.
 */
export type TabMenuItem =
  | { key: string; label: string; disabled?: boolean; checked?: boolean; run?: (viewId: string) => void }
  | "separator";

/**
 * `<dockorama-tab-menu>`: the right-click / Shift+F10 menu of a tab (`role="menu"`). Arrow keys, Home/End
 * and first-letter typing move between items, Enter/Space choose, Esc and Tab close.
 * Sends `tab-menu-choose` (with the item index) and `tab-menu-close` requests.
 */
export class DockoramaTabMenu extends DockoramaPart {
  static override properties = {
    view: {},
    items: { attribute: false },
    x: { type: Number },
    y: { type: Number },
    label: {}
  };
  view = "";
  items: TabMenuItem[] = [];
  x = 0;
  y = 0;
  label = "Tab actions";

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("keydown", this.onKey);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this.onKey);
  }

  private buttons(): HTMLButtonElement[] {
    return Array.from(this.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
  }

  /** Focus the first enabled item. */
  focusFirst(): void {
    this.buttons()[0]?.focus();
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    const items = this.buttons();
    const i = items.indexOf(this.querySelector("button:focus") as HTMLButtonElement);
    const n = items.length;
    if (e.key === "Escape" || e.key === "Tab") this.request("tab-menu-close", { id: this.view });
    else if (e.key === "ArrowDown") items[(i + 1) % n]?.focus();
    else if (e.key === "ArrowUp") items[(i - 1 + n) % n]?.focus();
    else if (e.key === "Home") items[0]?.focus();
    else if (e.key === "End") items[n - 1]?.focus();
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLowerCase();
      const order = [...items.slice(i + 1), ...items.slice(0, i + 1)];
      const hitItem = order.find((b) => (b.textContent ?? "").trim().toLowerCase().startsWith(k));
      if (!hitItem) return;
      hitItem.focus();
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("menu", "tab-menu");
    this.mark("part", "menu tab-menu");
    this.mark("role", "menu");
    this.mark("aria-label", this.label);
    this.style.cssText = `left:${this.x}px;top:${this.y}px`;
  }

  override render(): TemplateResult {
    return html`${this.items.map((it, index) => it === "separator"
      ? this.paint("menu-separator", {})
      : this.paint("tab-menu-item", {
        label: it.label, key: it.key, ...(it.checked === undefined ? {} : { checked: it.checked }), disabled: Boolean(it.disabled),
        choose: () => this.request("tab-menu-choose", { id: this.view, index })
      }))}`;
  }
}
