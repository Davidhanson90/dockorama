import { html } from "lit";
import type { SkinTemplates } from "../core.js";

const ASCII: Record<string, string> = { left: "<", right: ">", above: "^", below: "v", into: "#", between: "|", fill: "#" };
const stop = (e: Event): void => e.stopPropagation();

/** Phosphor swaps icons for ASCII, brackets tab labels and prompts the empty state. */
export const phosphorTemplates: Partial<SkinTemplates> = {
  "tab-label": (c) => html`<span class="label">${c.selected ? `[${c.title}]` : c.title}</span>`,
  "tab-close-button": (c) => html`<button class="btn phos" part="tab-close" tabindex="-1" aria-label="${c.label} ${c.title}"
    @pointerdown=${stop} @click=${(e: Event) => { stop(e); c.close(); }}>x</button>`,
  "toolbar-button": (c) => html`<button class="btn phos" part="action ${c.part}" title=${c.label} aria-label=${c.label} @pointerdown=${stop}
    @click=${(e: Event) => { stop(e); c.press(); }}>${{ stow: "_", zoom: "[]", unzoom: "][", menu: "..", dismiss: "x" }[c.action]}</button>`,
  "drop-target": (c) => html`<div class="target" part="target" data-zone=${c.zone} ?data-hot=${c.hot} style="left:${c.x}px;top:${c.y}px">${ASCII[c.direction] ?? "+"}</div>`,
  "view-empty": (c) => html`<div class="empty">&gt; ${c.label}<span aria-hidden="true">_</span></div>`
};
