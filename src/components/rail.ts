import { html, type PropertyValues, type TemplateResult } from "lit";
import type { DockContext, Side } from "../core/contracts.js";
import { DockoramaPart } from "./part.js";

/** `<dockorama-rail>`: the strip of auto-hidden views along one edge. Click or hover opens a `<dockorama-flyout>`. */
export class DockoramaRail extends DockoramaPart {
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
    return html`${this.views.map((id) => this.paint("rail-item", {
      id, title: this.ctx.model.views[id]?.title ?? id, open: this.open === id,
      toggle: () => this.request("peek", { id, toggle: true }),
      hover: (e: PointerEvent) => { if (e.pointerType === "mouse" && this.open !== id) this.request("peek", { id, toggle: false }); }
    }))}`;
  }
}
