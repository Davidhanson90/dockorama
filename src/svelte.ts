import "./index.js";
import type { FlexdockManager } from "./manager.js";
import { applyProps, bindEvents, type FlexdockHandlers, type FlexdockProps } from "./bridge.js";

export type { FlexdockHandlers, FlexdockProps } from "./bridge.js";

/** Options for the `use:flexdock` action: element properties plus an `on` map of callbacks. */
export interface FlexdockActionOptions extends FlexdockProps {
  on?: FlexdockHandlers;
}

/**
 * Svelte action for a `<flexdock-manager>` element: `<flexdock-manager use:flexdock={{ model, on: { change } }}>`.
 * Call `addView` / `removeView` / `getViewElement` / `hasView` on the element itself (`bind:this`).
 * Framework-free (no Svelte import), so it also works with any code that calls actions by hand.
 */
export function flexdock(node: FlexdockManager, options: FlexdockActionOptions = {}) {
  let current = options;
  applyProps(node, current);
  const off = bindEvents(node, () => current.on ?? {});
  return {
    update(next: FlexdockActionOptions) {
      current = next;
      applyProps(node, next);
    },
    destroy() {
      off();
    }
  };
}
