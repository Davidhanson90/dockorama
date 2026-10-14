import { html } from "lit";
import type { SkinTemplates } from "../core.js";

/** Ledger draws unsaved changes as a bold asterisk and pins as a "§" mark, and labels its toolbar with text. */
export const ledgerTemplates: Partial<SkinTemplates> = {
  "tab-dirty-dot": (c) => html`<span class="ledger-mark" part="tab-dirty" role="img" aria-label=${c.label}>*</span>`,
  "tab-pin-mark": () => html`<span class="ledger-mark" part="tab-pin" aria-hidden="true">§</span>`,
  "toolbar-button": (c) => html`<button class="btn" part="action ${c.part}" title=${c.label} aria-label=${c.label}
    style="width:auto;padding:0 6px;font:800 10px/1 inherit;letter-spacing:.06em"
    @pointerdown=${(e: Event) => e.stopPropagation()} @click=${(e: Event) => { e.stopPropagation(); c.press(); }}>${{ stow: "HIDE", zoom: "MAX", unzoom: "MIN", menu: "•••", dismiss: "✕" }[c.action]}</button>`
};
