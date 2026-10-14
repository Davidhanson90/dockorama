import { PazuruManager } from "./manager.js";
import { PazuruMinimap } from "./minimap.js";
import { defineParts } from "./components/index.js";

/** Current package version. */
export const VERSION = "0.1.0";

export { PazuruManager, PazuruMinimap };
export type { ChangeReason } from "./manager.js";
export {
  stateEvents, type BeforeAddDetail, type CommandDetail, type CommandSource, type DockOrigin, type DragKind, type DragOverDetail, type DragSpot,
  type DropDetail, type PazuruStateEvents, type FoldDetail, type ResizeDetail, type StateEvent, type StateEventName
} from "./events.js";
export {
  PazuruConfirm, PazuruDocs, PazuruDropGuide, PazuruFlyout, PazuruGutter, PazuruMenu, PazuruNotice, PazuruPalette, PazuruPart, PazuruRail,
  PazuruSplit, PazuruStack, PazuruTab, PazuruTabMenu, PazuruTabstrip, PazuruToolbar, PazuruView, PazuruWindow, PARTS, defineParts,
  type DockContext, type GuideSpot, type MenuEntry, type NoticeAction, type PartRequest, type TabMenuItem
} from "./components/index.js";
export * from "./model.js";
export {
  addView, adopt, cellOf, clampPair, fixSize, fold, limitSize, resizeCells, catalogue, promote, previewOf, setPreview, upgrade, validate, closeSet, comeInside, goOutside, outsideOf, pin, tuneOutside, enlist, column, copy, createModel, detach, dismiss, docs, emptyModel, forget, isModel, locate,
  fillDocs, insertBetween, normalize, place, placeAtEdge, reorder, reveal, row, select, setWeights, stack, stacksOf, stow, toggleZoom,
  unplace, unstow, viewsIn
} from "./ops.js";
export { Timeline } from "./history.js";
export { Workspaces } from "./workspaces.js";
export { DEFAULT_LABELS, type PazuruLabels } from "./labels.js";
export * as geometry from "./geometry.js";

defineParts();
if (!customElements.get("pazuru-manager")) customElements.define("pazuru-manager", PazuruManager);
if (!customElements.get("pazuru-minimap")) customElements.define("pazuru-minimap", PazuruMinimap);

declare global {
  interface HTMLElementTagNameMap {
    "pazuru-minimap": PazuruMinimap;
  }
}
export {
  activeSkin, clearSkinOverrides, defineSkin, extendSkin, overrideSkin, skinNamed, skinNames, useSkin,
  type Skin, type SkinContexts, type SkinKey, type SkinKit, type SkinOutput, type SkinPatch, type SkinTemplate, type SkinTemplates
} from "./skins/core.js";
