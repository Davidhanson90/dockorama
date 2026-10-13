import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../icons.js";
import type { DockContext } from "./context.js";
import { FlexdockPart } from "./part.js";

/** `<flexdock-toolbar>`: the action buttons in a group's header (auto-hide, zoom, more, close). */
export class FlexdockToolbar extends FlexdockPart {
  static override properties = {
    view: {},
    docs: { type: Boolean },
    win: {},
    ctx: { attribute: false }
  };
  view = "";
  docs = false;
  win?: string;
  ctx!: DockContext;

  override render(): TemplateResult {
    const t = this.ctx.labels;
    const c = this.ctx.model.views[this.view]?.caps ?? {};
    const zoomed = Boolean(this.ctx.model.zoom);
    const stop = (e: Event) => e.stopPropagation();
    const b = (label: string, icon: unknown, action: string, part: string) =>
      html`<button class="btn" part="action ${part}" title=${label} aria-label=${label} @pointerdown=${stop}
        @click=${(e: Event) => { stop(e); this.request(action, { id: this.view }); }}>${icon}</button>`;
    return html`
      ${!this.win && !this.docs && c.hide !== false && !zoomed ? b(t.stow, icons.stow, "stow", "stow") : nothing}
      ${c.zoom !== false ? b(zoomed ? t.unzoom : t.zoom, zoomed ? icons.unzoom : icons.zoom, "zoom", "zoom") : nothing}
      ${b(t.more, icons.more, "menu", "more")}
      ${!this.docs && c.dismiss !== false ? b(t.dismiss, icons.close, "dismiss", "close") : nothing}`;
  }
}
