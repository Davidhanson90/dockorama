import { html, type PropertyValues, type TemplateResult } from "lit";
import { FlexdockPart } from "./part.js";

/** A button of `<flexdock-notice>`: its label and the request action it sends. */
export interface NoticeAction {
  label: string;
  action: string;
  primary?: boolean;
}

/**
 * `<flexdock-notice>`: a small banner (`role="alertdialog"`) at the top of the layout, used when the
 * browser stopped flexdock re-opening views in their own windows. Each button sends its action as a request.
 */
export class FlexdockNotice extends FlexdockPart {
  static override properties = {
    message: {},
    actions: { attribute: false }
  };
  message = "";
  actions: NoticeAction[] = [];

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("notice");
    this.mark("part", "notice");
    this.mark("role", "alertdialog");
    this.mark("aria-label", this.message);
  }

  override render(): TemplateResult {
    return html`<span class="notice-text">${this.message}</span>${this.actions.map((a) =>
      html`<button class="btn notice-btn" ?data-primary=${Boolean(a.primary)} @click=${() => this.request(a.action)}>${a.label}</button>`)}`;
  }
}
