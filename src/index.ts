import { DockoramaManager } from "./engine/manager.js";
import { DockoramaMinimap } from "./components/minimap.js";
import { defineParts } from "./components/index.js";

export { DockoramaManager, DockoramaMinimap };
export type { ChangeReason } from "./core/contracts.js";
export { stateEvents } from "./core/events.js";
export type {
  BeforeAddDetail, CommandDetail, CommandSource, DockOrigin, DragKind, DragOverDetail, DragSpot, DropDetail, DockoramaStateEvents,
  FoldDetail, ResizeDetail, StateEvent, StateEventName
} from "./core/contracts.js";
export {
  DockoramaConfirm, DockoramaDocs, DockoramaDropGuide, DockoramaFlyout, DockoramaGutter, DockoramaMenu, DockoramaNotice, DockoramaPalette, DockoramaPart, DockoramaRail,
  DockoramaSplit, DockoramaStack, DockoramaTab, DockoramaTabMenu, DockoramaTabstrip, DockoramaToolbar, DockoramaView, DockoramaWindow, PARTS, defineParts,
  type DockContext, type GuideSpot, type MenuEntry, type NoticeAction, type PartRequest, type TabMenuItem
} from "./components/index.js";
export * from "./core/contracts.js";
export {
  addView, adopt, cellOf, clampPair, fixSize, fold, limitSize, resizeCells, catalogue, promote, previewOf, setPreview, upgrade, validate, closeSet, comeInside, goOutside, outsideOf, pin, tuneOutside, enlist, column, copy, createModel, detach, dismiss, docs, emptyModel, forget, isModel, locate,
  fillDocs, insertBetween, normalize, place, placeAtEdge, reorder, reveal, row, select, setWeights, stack, stacksOf, stow, toggleZoom,
  unplace, unstow, viewsIn
} from "./core/ops.js";
export { Timeline } from "./core/history.js";
export { Workspaces } from "./core/workspaces.js";
export { DEFAULT_LABELS, VERSION } from "./core/constants.js";
export * as geometry from "./core/geometry.js";

defineParts();
if (!customElements.get("dockorama-manager")) customElements.define("dockorama-manager", DockoramaManager);
if (!customElements.get("dockorama-minimap")) customElements.define("dockorama-minimap", DockoramaMinimap);

declare global {
  interface HTMLElementTagNameMap {
    "dockorama-minimap": DockoramaMinimap;
  }
}
export {
  activeSkin, clearSkinOverrides, defineSkin, extendSkin, overrideSkin, skinNamed, skinNames, useSkin,
  type Skin, type SkinContexts, type SkinKey, type SkinKit, type SkinOutput, type SkinPatch, type SkinTemplate, type SkinTemplates
} from "./skins/core.js";
