import { html, type PropertyValues, type TemplateResult } from "lit";
import { slotOf, type DockContext } from "./context.js";
import { FlexdockPart } from "./part.js";

/**
 * `<flexdock-view>`: hosts one view's content (a named slot for the light-DOM element with matching
 * `data-view`). Shows a placeholder when the content is popped out, and the empty drop zone when there is no view.
 */
export class FlexdockView extends FlexdockPart {
  static override properties = {
    view: {},
    kind: {},
    labelledBy: { attribute: false },
    label: {},
    ctx: { attribute: false }
  };
  view = "";
  /** ARIA role of the content area. */
  kind: "region" | "tabpanel" = "region";
  labelledBy = "";
  label = "";
  ctx!: DockContext;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("body");
    this.mark("part", "body");
    this.mark("role", this.kind);
    this.mark("aria-labelledby", this.labelledBy || undefined);
    this.mark("aria-label", this.label || undefined);
    this.mark("data-inert", Boolean(this.ctx.model.views[this.view]?.caps?.inert));
  }

  override render(): TemplateResult {
    const t = this.ctx.labels;
    if (!this.view) return html`<div class="empty">${t.emptyDocs}</div>`;
    if (this.ctx.popped.has(this.view)) {
      return html`<div class="away"><p>${t.poppedOut}</p><button class="btn" style="width:auto;padding:0 10px"
        @click=${() => this.request("popin", { id: this.view })}>${t.popin}</button></div>`;
    }
    return html`<slot name=${slotOf(this.view)}></slot>`;
  }
}
