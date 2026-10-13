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
    win: {}
  };
  view = "";
  info?: ViewInfo;
  selected = false;
  closable = false;
  closeLabel = "Close";
  win?: string;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.onClick);
    this.addEventListener("pointerdown", this.onDown);
    this.addEventListener("auxclick", this.onAux);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("click", this.onClick);
    this.removeEventListener("pointerdown", this.onDown);
    this.removeEventListener("auxclick", this.onAux);
  }
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
  }

  override render(): TemplateResult {
    const title = this.info?.title ?? this.view;
    return html`${this.info?.icon ? html`<span class="glyph">${this.info.icon}</span>` : nothing}<span class="label">${title}</span>
      ${this.closable
        ? html`<button class="btn" part="tab-close" tabindex="-1" aria-label="${this.closeLabel} ${title}"
            @pointerdown=${(e: Event) => e.stopPropagation()}
            @click=${(e: Event) => { e.stopPropagation(); this.request("dismiss", { id: this.view }); }}>${icons.close}</button>`
        : nothing}`;
  }
}
