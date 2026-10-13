import { FlexdockManager } from "./manager.js";
import { FlexdockMinimap } from "./minimap.js";

/** Current package version. */
export const VERSION = "0.1.0";

export { FlexdockManager, FlexdockMinimap };
export type { ChangeReason } from "./manager.js";
export * from "./model.js";
export {
  addView, catalogue, column, copy, createModel, detach, dismiss, docs, emptyModel, forget, isModel, locate,
  normalize, place, placeAtEdge, reorder, reveal, row, select, setWeights, stack, stacksOf, stow, toggleZoom,
  unplace, unstow, viewsIn
} from "./ops.js";
export { Timeline } from "./history.js";
export { Workspaces } from "./workspaces.js";
export { DEFAULT_LABELS, type FlexdockLabels } from "./labels.js";
export * as geometry from "./geometry.js";

if (!customElements.get("flexdock-manager")) customElements.define("flexdock-manager", FlexdockManager);
if (!customElements.get("flexdock-minimap")) customElements.define("flexdock-minimap", FlexdockMinimap);

declare global {
  interface HTMLElementTagNameMap {
    "flexdock-minimap": FlexdockMinimap;
  }
}
