import { html } from "lit";
import type { SkinTemplates } from "../core.js";

/** Nimbus replaces a few templates: dotted splitter handles and a round "×" close. */
export const nimbusTemplates: Partial<SkinTemplates> = {
  splitter: () => html`<span class="nimbus-dots" aria-hidden="true">•••</span>`,
  "tab-close-button": (c) => html`<button class="btn" part="tab-close" tabindex="-1" aria-label="${c.label} ${c.title}"
    @pointerdown=${(e: Event) => e.stopPropagation()} @click=${(e: Event) => { e.stopPropagation(); c.close(); }}>×</button>`
};
