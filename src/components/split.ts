import { html, type PropertyValues, type TemplateResult } from "lit";
import type { SplitNode } from "../model.js";
import type { DockContext } from "./context.js";
import { FlexdockPart } from "./part.js";
import { renderNode } from "./tree.js";

/** `<flexdock-split>`: lays out child nodes in a row or column with a `<flexdock-gutter>` between each pair. */
export class FlexdockSplit extends FlexdockPart {
  static override properties = {
    node: { attribute: false },
    path: { attribute: false },
    win: { attribute: false },
    ctx: { attribute: false }
  };
  node!: SplitNode;
  path: number[] = [];
  win?: string;
  ctx!: DockContext;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("split");
    this.mark("part", "split");
    this.mark("data-axis", this.node.axis);
  }

  /** Flex sizing of child `i`: collapsed, fixed px or weighted, plus min / max bounds. */
  private cellStyle(i: number): string {
    const n = this.node;
    if (n.folded?.[i]) return "flex: 0 0 0px; min-width: 0; min-height: 0";
    const fixed = n.fixed?.[i];
    const base = typeof fixed === "number" ? `flex: 0 0 ${fixed}px` : `flex: ${n.weights[i] ?? 1} 1 0px`;
    const lim = n.limits?.[i];
    const dim = n.axis === "row" ? "width" : "height";
    return `${base}${lim?.min !== undefined ? `; min-${dim}: ${lim.min}px` : ""}${lim?.max !== undefined ? `; max-${dim}: ${lim.max}px` : ""}`;
  }

  override render(): TemplateResult {
    const { node, path, win, ctx } = this;
    const total = node.weights.reduce((a, b) => a + b, 0) || 1;
    const key = path.join(".");
    const parts: TemplateResult[] = [];
    node.children.forEach((child, i) => {
      if (i > 0) {
        const pct = Math.round((node.weights.slice(0, i).reduce((a, b) => a + b, 0) / total) * 100);
        const drop = ctx.gap?.path === key && ctx.gap.after === i - 1 && ctx.gap.win === (win ?? "");
        const folded = node.folded?.[i - 1] ? "before" : node.folded?.[i] ? "after" : "";
        parts.push(html`<flexdock-gutter .path=${path} .index=${i - 1} .win=${win} .axis=${node.axis} .weights=${node.weights}
          .value=${pct} .label=${ctx.labels.resize} .drop=${drop} .folded=${folded}></flexdock-gutter>`);
      }
      parts.push(html`<div class="cell" style=${this.cellStyle(i)} ?data-folded=${Boolean(node.folded?.[i])}
        ?data-fixed=${typeof node.fixed?.[i] === "number"}>${renderNode(child, [...path, i], win, ctx)}</div>`);
    });
    return html`${parts}`;
  }
}
