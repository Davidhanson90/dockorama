import { LitElement, css, html } from "lit";

/** Current package version. */
export const VERSION = "0.0.1";

/** Placeholder dock manager element. The real layout engine lands feature by feature from docs/specs/. */
export class FlexdockManager extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      box-sizing: border-box;
      min-height: 120px;
    }
  `;

  override render() {
    return html`<div part="root" class="flexdock-root"><slot></slot></div>`;
  }
}

if (!customElements.get("flexdock-manager")) {
  customElements.define("flexdock-manager", FlexdockManager);
}

declare global {
  interface HTMLElementTagNameMap {
    "flexdock-manager": FlexdockManager;
  }
}
