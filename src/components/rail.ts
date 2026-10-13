import { html, type PropertyValues, type TemplateResult } from "lit";
import type { Side } from "../model.js";
import type { DockContext } from "./context.js";
import { FlexdockPart } from "./part.js";

/** `<flexdock-rail>`: the strip of auto-hidden views along one edge. Click or hover opens a `<flexdock-flyout>`. */
export class FlexdockRail extends FlexdockPart {
  static override properties = {
    side: {},
    views: { attribute: false },
    open: {},
    ctx: { attribute: false }
  };
  side: Side = "start";
  views: string[] = [];
  /** The view whose flyout is open, if any. */
  open?: string;
  ctx!: DockContext;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("rail");
    this.mark("part", "rail");
    this.mark("data-side", this.side);
    this.mark("role", "toolbar");
    this.mark("aria-label", this.side);
  }

  override render(): TemplateResult {
    return html`${this.views.map((id) => html`<button class="rail-item" part="rail-item" aria-expanded=${this.open === id ? "true" : "false"}
      @click=${() => this.request("peek", { id, toggle: true })}
      @pointerenter=${(e: PointerEvent) => { if (e.pointerType === "mouse" && this.open !== id) this.request("peek", { id, toggle: false }); }}>
      ${this.ctx.model.views[id]?.title ?? id}</button>`)}`;
  }
}
