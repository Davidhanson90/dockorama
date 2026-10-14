import { html, type TemplateResult } from "lit";
import type { DockNode } from "../model.js";
import type { DockContext } from "./context.js";

/** Render a layout node as the matching part element. */
export function renderNode(node: DockNode, path: number[], win: string | undefined, ctx: DockContext): TemplateResult {
  if (node.kind === "split") {
    return html`<pazuru-split .node=${node} .path=${path} .win=${win} .ctx=${ctx}></pazuru-split>`;
  }
  return node.docs
    ? html`<pazuru-docs .group=${node} .path=${path} .win=${win} .ctx=${ctx}></pazuru-docs>`
    : html`<pazuru-stack .group=${node} .path=${path} .win=${win} .ctx=${ctx}></pazuru-stack>`;
}
