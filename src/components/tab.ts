import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { icons } from "../icons.js";
import type { ViewInfo } from "../model.js";
import { FlexdockPart } from "./part.js";

/**
 * `<flexdock-tab>`: one tab (`role="tab"`). Click reveals, pointer-drag moves, middle-click or the
 * close button (when `closable`) closes.
 */
export class FlexdockTab extends FlexdockPart {
  static override properties = {
    view: {},
    info: { attribute: false },
    selected: { type: Boolean },
    closable: { type: Boolean },
    closeLabel: { attribute: "close-label" },
    win: {},
    pinned: { type: Boolean },
    preview: { type: Boolean },
    dirty: { type: Boolean },
    dirtyLabel: { attribute: "dirty-label" }
  };
  view = "";
  info?: ViewInfo;
  selected = false;
  closable = false;
  closeLabel = "Close";
  win?: string;
  /** Pinned tabs are drawn compact (glyph only when there is one) and never show a close button. */
  pinned = false;
  /** Preview tab: italic, replaced by the next preview; double-click keeps it. */
  preview = false;
  /** Unsaved changes: shows a dot (the close button replaces it on hover). */
  dirty = false;
  dirtyLabel = "Unsaved changes";

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("contextmenu", this.onContext);
    this.addEventListener("keydown", this.onKeyDown);
    this.addEventListener("click", this.onClick);
    this.addEventListener("dblclick", this.onDouble);
    this.addEventListener("pointerdown", this.onDown);
    this.addEventListener("auxclick", this.onAux);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("contextmenu", this.onContext);
    this.removeEventListener("keydown", this.onKeyDown);
    this.removeEventListener("click", this.onClick);
    this.removeEventListener("dblclick", this.onDouble);
    this.removeEventListener("pointerdown", this.onDown);
    this.removeEventListener("auxclick", this.onAux);
  }
  private readonly onContext = (e: MouseEvent): void => {
    e.preventDefault();
    this.request("tab-menu", { id: this.view, x: e.clientX, y: e.clientY });
  };
  /** Shift+F10 or the menu key open the tab menu from the keyboard. */
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!(e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey))) return;
    e.preventDefault();
    e.stopPropagation();
    const r = this.getBoundingClientRect();
    this.request("tab-menu", { id: this.view, x: r.left, y: r.bottom, keyboard: true });
  };
  private readonly onDouble = (e: MouseEvent): void => {
    if (!this.preview) return;
    e.stopPropagation();
    this.request("promote", { id: this.view });
  };
  private readonly onClick = (): void => this.request("reveal", { id: this.view });
  private readonly onDown = (event: PointerEvent): void => this.request("grab", { id: this.view, win: this.win, event, source: this });
  private readonly onAux = (e: MouseEvent): void => {
    if (e.button === 1) this.request("dismiss", { id: this.view });
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("tab");
    this.mark("part", this.selected ? "tab tab-current" : "tab");
    this.mark("role", "tab");
    this.id = `tab-${this.view}`;
    this.mark("data-view", this.view);
    this.mark("aria-selected", this.selected ? "true" : "false");
    this.mark("tabindex", this.selected ? "0" : "-1");
    this.mark("data-pinned", this.pinned);
    this.mark("data-preview", this.preview);
    this.mark("data-dirty", this.dirty);
    this.mark("aria-haspopup", "menu");
  }

  override render(): TemplateResult {
    const title = this.info?.title ?? this.view;
    const compact = this.pinned && Boolean(this.info?.icon);
    if (this.pinned) this.title = title;
    return html`${this.info?.icon ? html`<span class="glyph">${this.info.icon}</span>` : nothing}${compact ? nothing : html`<span class="label">${title}</span>`}
      ${this.dirty ? html`<span class="dirty" part="tab-dirty" role="img" aria-label=${this.dirtyLabel}></span>` : nothing}
      ${this.pinned ? html`<span class="pin" part="tab-pin" aria-hidden="true">${icons.pin}</span>` : nothing}
      ${this.closable && !this.pinned
        ? html`<button class="btn" part="tab-close" tabindex="-1" aria-label="${this.closeLabel} ${title}"
            @pointerdown=${(e: Event) => e.stopPropagation()}
            @click=${(e: Event) => { e.stopPropagation(); this.request("dismiss", { id: this.view }); }}>${icons.close}</button>`
        : nothing}`;
  }
}
