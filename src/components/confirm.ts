import { html, type PropertyValues, type TemplateResult } from "lit";
import { FlexdockPart } from "./part.js";

/**
 * `<flexdock-confirm>`: the "unsaved changes" question shown before a dirty view closes
 * (`role="alertdialog"`, modal over the layout). Tab cycles its two buttons, Esc cancels.
 * Sends `confirm-close` with `ok: true | false`.
 */
export class FlexdockConfirm extends FlexdockPart {
  static override properties = {
    view: {},
    message: {},
    okLabel: { attribute: "ok-label" },
    cancelLabel: { attribute: "cancel-label" }
  };
  view = "";
  message = "";
  okLabel = "Close";
  cancelLabel = "Cancel";

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("keydown", this.onKey);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this.onKey);
  }

  /** Focus the safe choice (Cancel). */
  focusSafe(): void {
    this.querySelector<HTMLButtonElement>("button[data-cancel]")?.focus();
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") this.request("confirm-close", { id: this.view, ok: false });
    else if (e.key === "Tab") {
      const b = Array.from(this.querySelectorAll<HTMLButtonElement>("button"));
      const i = b.indexOf(this.querySelector("button:focus") as HTMLButtonElement);
      b[(i + (e.shiftKey ? b.length - 1 : 1)) % b.length]?.focus();
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("confirm");
    this.mark("part", "confirm");
    this.mark("role", "alertdialog");
    this.mark("aria-modal", "true");
    this.mark("aria-label", this.message);
  }

  override render(): TemplateResult {
    return html`${this.paint("confirm", {
      message: this.message, okLabel: this.okLabel, cancelLabel: this.cancelLabel,
      ok: () => this.request("confirm-close", { id: this.view, ok: true }), cancel: () => this.request("confirm-close", { id: this.view, ok: false })
    })}`;
  }
}
