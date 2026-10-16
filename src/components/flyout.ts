import { html, type PropertyValues, type TemplateResult } from "lit";
import type { Side } from "../model.js";
import type { DockContext } from "./context.js";
import { DockoramaPart } from "./part.js";

/** `<dockorama-flyout>`: the sliding panel that shows an auto-hidden view over the layout. Esc closes it. */
export class DockoramaFlyout extends DockoramaPart {
  static override properties = {
    view: {},
    side: {},
    ctx: { attribute: false }
  };
  view = "";
  side: Side = "start";
  ctx!: DockContext;

  protected override get listeners() {
    return { keydown: this.onKey };
  }
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") this.request("peek-close");
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("drawer");
    this.mark("part", "drawer");
    this.mark("data-side", this.side);
  }

  override render(): TemplateResult {
    const id = this.view;
    const t = this.ctx.labels;
    const info = this.ctx.model.views[id];
    const closable = info?.caps?.dismiss !== false;
    return html`${this.paint("flyout", {
      id, title: info?.title ?? id, unstowLabel: t.unstow, unstow: () => this.request("unstow", { id }),
      ...(closable ? { closeLabel: t.dismiss, close: () => this.request("dismiss", { id }) } : {}),
      body: html`<dockorama-view .view=${id} .label=${info?.title ?? id} .ctx=${this.ctx}></dockorama-view>`
    })}`;
  }
}
