import { LitElement } from "lit";
import { icons } from "../icons.js";
import { templateFor, type SkinContexts, type SkinKey, type SkinKit, type SkinOutput, type SkinScope } from "../skins/core.js";
import "../skins/default/skin.js";

/** Detail of the internal `dockorama-request` event that UI parts send to their manager. */
export interface PartRequest {
  action: string;
  id?: string;
  [key: string]: unknown;
}

/**
 * Base class of dockorama's UI parts. Parts render into their own light DOM so that they live inside the
 * manager's shadow root (one stylesheet, CSS parts and `::slotted` keep working), and report user intent
 * to the manager with composed `dockorama-request` events. They never change the layout model themselves.
 */
export abstract class DockoramaPart extends LitElement {
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Resolves once this part and every part inside it have rendered. */
  protected override async getUpdateComplete(): Promise<boolean> {
    let done = await super.getUpdateComplete();
    for (const el of Array.from(this.querySelectorAll("*"))) {
      if (el instanceof DockoramaPart) done = (await el.updateComplete) && done;
    }
    return done;
  }

  /** Where this part's templates come from: the owning manager's skin settings, else the page-wide skin. */
  protected skinScope(): SkinScope {
    const root = this.getRootNode() as ShadowRoot | Document;
    const host = (root as ShadowRoot).host as (Element & { skinScope?: () => SkinScope }) | undefined;
    return host?.skinScope?.() ?? {};
  }

  /** Render the current skin's template for `key`. */
  protected paint<K extends SkinKey>(key: K, ctx: SkinContexts[K]): SkinOutput {
    const scope = this.skinScope();
    const kit: SkinKit = { paint: (k, c) => templateFor(k, scope)(c, kit), icons };
    return templateFor(key, scope)(ctx, kit);
  }

  /** Ask the owning manager to do something. */
  protected request(action: string, detail: Omit<PartRequest, "action"> = {}): void {
    this.dispatchEvent(new CustomEvent<PartRequest>("dockorama-request", { detail: { ...detail, action }, bubbles: true, composed: true }));
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
    "dockorama-request": CustomEvent<PartRequest>;
  }
}
