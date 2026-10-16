import { html, type PropertyValues, type TemplateResult } from "lit";
import { viewsIn } from "../core/ops.js";
import type { Box, DockContext, DockNode } from "../core/contracts.js";
import { DockoramaPart } from "./part.js";
import { renderNode } from "./tree.js";

/** `<dockorama-window>`: a floating window holding its own layout tree, with a resize grip. */
export class DockoramaWindow extends DockoramaPart {
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

  protected override get listeners() {
    return { pointerdown: this.onDown };
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
    const title = viewsIn(this.tree).map((v) => this.ctx.model.views[v]?.title ?? v).join(", ");
    const header = this.paint("floating-header", { key: this.key, title });
    const content = html`${header}<div class="content">${renderNode(this.tree, [], this.key, this.ctx)}</div>`;
    const grip = this.paint("floating-grip", { startResize: (event: PointerEvent) => this.request("grip", { key: this.key, event }) });
    return html`${this.paint("floating-window", { key: this.key, title, content, grip })}`;
  }
}
