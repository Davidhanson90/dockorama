import { LitElement } from "lit";

/** Detail of the internal `flexdock-request` event that UI parts send to their manager. */
export interface PartRequest {
  action: string;
  id?: string;
  [key: string]: unknown;
}

/**
 * Base class of flexdock's UI parts. Parts render into their own light DOM so that they live inside the
 * manager's shadow root (one stylesheet, CSS parts and `::slotted` keep working), and report user intent
 * to the manager with composed `flexdock-request` events. They never change the layout model themselves.
 */
export abstract class FlexdockPart extends LitElement {
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Resolves once this part and every part inside it have rendered. */
  protected override async getUpdateComplete(): Promise<boolean> {
    let done = await super.getUpdateComplete();
    for (const el of Array.from(this.querySelectorAll("*"))) {
      if (el instanceof FlexdockPart) done = (await el.updateComplete) && done;
    }
    return done;
  }

  /** Ask the owning manager to do something. */
  protected request(action: string, detail: Omit<PartRequest, "action"> = {}): void {
    this.dispatchEvent(new CustomEvent<PartRequest>("flexdock-request", { detail: { ...detail, action }, bubbles: true, composed: true }));
  }

  /** Set or remove a host attribute. */
  protected mark(name: string, value: string | boolean | undefined): void {
    if (value === false || value === undefined) this.removeAttribute(name);
    else {
      const v = value === true ? "" : value;
      if (this.getAttribute(name) !== v) this.setAttribute(name, v);
    }
  }
}

declare global {
  interface HTMLElementEventMap {
    "flexdock-request": CustomEvent<PartRequest>;
  }
}
