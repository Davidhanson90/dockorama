import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { FlexdockPart } from "./part.js";

/** An entry of `<flexdock-menu>`: a command, a radio item (`checked` set) or a separator. */
export type MenuEntry = { label: string; action: string; id: string; checked?: boolean } | "separator";

/**
 * `<flexdock-menu>`: a positioned `role="menu"` popup (view actions and the tab list of a group).
 * Arrow keys move, Esc closes; choosing sends the entry's action as a request.
 */
export class FlexdockMenu extends FlexdockPart {
  static override properties = {
    entries: { attribute: false },
    x: { type: Number },
    y: { type: Number }
  };
  entries: MenuEntry[] = [];
  x = 0;
  y = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("keydown", this.onKey);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this.onKey);
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    const items = Array.from(this.querySelectorAll<HTMLButtonElement>("button"));
    const i = items.indexOf(this.querySelector("button:focus") as HTMLButtonElement);
    if (e.key === "Escape") this.request("menu-close");
    else if (e.key === "ArrowDown") items[(i + 1) % items.length]?.focus();
    else if (e.key === "ArrowUp") items[(i - 1 + items.length) % items.length]?.focus();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("menu");
    this.mark("part", "menu");
    this.mark("role", "menu");
    this.style.cssText = `left:${this.x}px;top:${this.y}px`;
  }

  override render(): TemplateResult {
    return html`${this.entries.map((it) => it === "separator"
      ? html`<hr>`
      : html`<button role=${it.checked === undefined ? "menuitem" : "menuitemradio"} aria-checked=${it.checked === undefined ? nothing : String(it.checked)}
          @click=${() => this.request(it.action, { id: it.id, fromMenu: true })}>${it.label}</button>`)}`;
  }
}
