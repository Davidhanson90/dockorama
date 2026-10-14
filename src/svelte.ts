import "./index.js";
import type { PazuruManager } from "./manager.js";
import { applyProps, bindEvents, type PazuruHandlers, type PazuruProps } from "./bridge.js";

export type { PazuruHandlers, PazuruProps } from "./bridge.js";

/** Options for the `use:pazuru` action: element properties plus an `on` map of callbacks. */
export interface PazuruActionOptions extends PazuruProps {
  on?: PazuruHandlers;
}

/**
 * Svelte action for a `<pazuru-manager>` element: `<pazuru-manager use:pazuru={{ model, on: { change } }}>`.
 * Call `addView` / `removeView` / `getViewElement` / `hasView` on the element itself (`bind:this`).
 * Framework-free (no Svelte import), so it also works with any code that calls actions by hand.
 */
export function pazuru(node: PazuruManager, options: PazuruActionOptions = {}) {
  let current = options;
  applyProps(node, current);
  const off = bindEvents(node, () => current.on ?? {});
  return {
    update(next: PazuruActionOptions) {
      current = next;
      applyProps(node, next);
    },
    destroy() {
      off();
    }
  };
}
