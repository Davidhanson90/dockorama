import { html, type PropertyValues, type TemplateResult } from "lit";
import type { Box, DockNode } from "../model.js";
import { viewsIn } from "../ops.js";
import type { DockContext } from "./context.js";
import { FlexdockPart } from "./part.js";
import { renderNode } from "./tree.js";

/** `<flexdock-window>`: a floating window holding its own layout tree, with a resize grip. */
export class FlexdockWindow extends FlexdockPart {
  static override properties = {
    key: {},
    box: { attribute: false },
    tree: { attribute: false },
    layer: { type: Number },
    ctx: { attribute: false }
  };
  key = "";
  box: Box = { x: 0, y: 0, w: 360, h: 240 };
  tree!: DockNode;
  /** Stacking order among windows (0 = bottom). */
  layer = 0;
  ctx!: DockContext;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("pointerdown", this.onDown);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("pointerdown", this.onDown);
  }
  private readonly onDown = (): void => this.request("raise", { key: this.key });

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const b = this.box;
    this.classList.add("window");
    this.mark("part", "window");
    this.mark("role", "dialog");
    this.mark("aria-label", viewsIn(this.tree).map((v) => this.ctx.model.views[v]?.title ?? v).join(", "));
    this.mark("data-window", this.key);
    this.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;z-index:${30 + this.layer}`;
  }

  override render(): TemplateResult {
    return html`<div class="content">${renderNode(this.tree, [], this.key, this.ctx)}</div>
      <div class="grip" part="grip" @pointerdown=${(event: PointerEvent) => this.request("grip", { key: this.key, event })}></div>`;
  }
}
