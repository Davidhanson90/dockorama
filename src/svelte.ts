import "./index.js";
import type { DockoramaManager } from "./engine/manager.js";
import { applyProps, bindEvents, type DockoramaHandlers, type DockoramaProps } from "./wrappers/bridge.js";

export type { DockoramaHandlers, DockoramaProps } from "./wrappers/bridge.js";

/** Options for the `use:dockorama` action: element properties plus an `on` map of callbacks. */
export interface DockoramaActionOptions extends DockoramaProps {
  on?: DockoramaHandlers;
}

/**
 * Svelte action for a `<dockorama-manager>` element: `<dockorama-manager use:dockorama={{ model, on: { change } }}>`.
 * Call `addView` / `removeView` / `getViewElement` / `hasView` on the element itself (`bind:this`).
 * Framework-free (no Svelte import), so it also works with any code that calls actions by hand.
 */
export function dockorama(node: DockoramaManager, options: DockoramaActionOptions = {}) {
  let current = options;
  applyProps(node, current);
  const off = bindEvents(node, () => current.on ?? {});
  return {
    update(next: DockoramaActionOptions) {
      current = next;
      applyProps(node, next);
    },
    destroy() {
      off();
    }
  };
}
