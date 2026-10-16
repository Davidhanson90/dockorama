import { html, type PropertyValues, type TemplateResult } from "lit";
import { DockoramaPart } from "./part.js";

/** A button of `<dockorama-notice>`: its label and the request action it sends. */
export interface NoticeAction {
  label: string;
  action: string;
  primary?: boolean;
}

/**
 * `<dockorama-notice>`: a small banner (`role="alertdialog"`) at the top of the layout, used when the
 * browser stopped dockorama re-opening views in their own windows. Each button sends its action as a request.
 */
export class DockoramaNotice extends DockoramaPart {
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
    return html`${this.paint("notice", { message: this.message, actions: this.actions.map((a) => ({ label: a.label, primary: Boolean(a.primary), run: () => this.request(a.action) })) })}`;
  }
}
