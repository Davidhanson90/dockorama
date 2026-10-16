import { html, type TemplateResult } from "lit";
import type { DockNode } from "../core/model.js";
import type { DockContext } from "./context.js";

/** Render a layout node as the matching part element. */
export function renderNode(node: DockNode, path: number[], win: string | undefined, ctx: DockContext): TemplateResult {
  if (node.kind === "split") {
    return html`<dockorama-split .node=${node} .path=${path} .win=${win} .ctx=${ctx}></dockorama-split>`;
  }
  return node.docs
    ? html`<dockorama-docs .group=${node} .path=${path} .win=${win} .ctx=${ctx}></dockorama-docs>`
    : html`<dockorama-stack .group=${node} .path=${path} .win=${win} .ctx=${ctx}></dockorama-stack>`;
}
