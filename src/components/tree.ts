import { html, type TemplateResult } from "lit";
import type { DockNode } from "../model.js";
import type { DockContext } from "./context.js";

/** Render a layout node as the matching part element. */
export function renderNode(node: DockNode, path: number[], win: string | undefined, ctx: DockContext): TemplateResult {
  if (node.kind === "split") {
    return html`<flexdock-split .node=${node} .path=${path} .win=${win} .ctx=${ctx}></flexdock-split>`;
  }
  return node.docs
    ? html`<flexdock-docs .group=${node} .path=${path} .win=${win} .ctx=${ctx}></flexdock-docs>`
    : html`<flexdock-stack .group=${node} .path=${path} .win=${win} .ctx=${ctx}></flexdock-stack>`;
}
