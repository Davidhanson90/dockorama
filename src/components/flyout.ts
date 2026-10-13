import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { icons } from "../icons.js";
import type { Side } from "../model.js";
import type { DockContext } from "./context.js";
import { FlexdockPart } from "./part.js";

/** `<flexdock-flyout>`: the sliding panel that shows an auto-hidden view over the layout. Esc closes it. */
export class FlexdockFlyout extends FlexdockPart {
  static override properties = {
    view: {},
    side: {},
    ctx: { attribute: false }
  };
  view = "";
  side: Side = "start";
  ctx!: DockContext;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("keydown", this.onKey);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this.onKey);
  }
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") this.request("peek-close");
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("drawer");
    this.mark("part", "drawer");
    this.mark("data-side", this.side);
  }

  override render(): TemplateResult {
    const id = this.view;
    const t = this.ctx.labels;
    const info = this.ctx.model.views[id];
    return html`<section class="stack" data-active data-stack=${id}>
      <div class="bar" part="bar"><span class="title">${info?.title ?? id}</span>
        <button class="btn" part="action unstow" aria-label=${t.unstow} title=${t.unstow} @click=${() => this.request("unstow", { id })}>${icons.unstow}</button>
        ${info?.caps?.dismiss !== false ? html`<button class="btn" part="action close" aria-label=${t.dismiss} @click=${() => this.request("dismiss", { id })}>${icons.close}</button>` : nothing}
      </div>
      <flexdock-view .view=${id} .label=${info?.title ?? id} .ctx=${this.ctx}></flexdock-view>
    </section>`;
  }
}
