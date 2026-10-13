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

  override render(): TemplateResult {
    const { node, path, win, ctx } = this;
    const total = node.weights.reduce((a, b) => a + b, 0) || 1;
    const key = path.join(".");
    const parts: TemplateResult[] = [];
    node.children.forEach((child, i) => {
      if (i > 0) {
        const pct = Math.round((node.weights.slice(0, i).reduce((a, b) => a + b, 0) / total) * 100);
        const drop = ctx.gap?.path === key && ctx.gap.after === i - 1 && ctx.gap.win === (win ?? "");
        parts.push(html`<flexdock-gutter .path=${path} .index=${i - 1} .win=${win} .axis=${node.axis} .weights=${node.weights}
          .value=${pct} .label=${ctx.labels.resize} .drop=${drop}></flexdock-gutter>`);
      }
      parts.push(html`<div class="cell" style="flex: ${node.weights[i] ?? 1} 1 0px">${renderNode(child, [...path, i], win, ctx)}</div>`);
    });
    return html`${parts}`;
  }
}
