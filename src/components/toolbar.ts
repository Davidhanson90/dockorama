import { html, nothing, type TemplateResult } from "lit";
import type { SkinOutput } from "../skins/core.js";
import type { DockContext } from "./context.js";
import { PazuruPart } from "./part.js";

/** `<pazuru-toolbar>`: the action buttons in a group's header (auto-hide, zoom, more, close). */
export class PazuruToolbar extends PazuruPart {
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
    const b = (label: string, action: "stow" | "zoom" | "unzoom" | "menu" | "dismiss", request: string, part: string) =>
      this.paint("toolbar-button", { action, label, part, press: () => this.request(request, { id: this.view }) });
    const buttons: SkinOutput[] = [
      !this.win && !this.docs && c.hide !== false && !zoomed ? b(t.stow, "stow", "stow", "stow") : nothing,
      c.zoom !== false ? b(zoomed ? t.unzoom : t.zoom, zoomed ? "unzoom" : "zoom", "zoom", "zoom") : nothing,
      b(t.more, "menu", "menu", "more"),
      !this.docs && c.dismiss !== false ? b(t.dismiss, "dismiss", "dismiss", "close") : nothing
    ];
    return html`${this.paint("toolbar", { buttons })}`;
  }
}
