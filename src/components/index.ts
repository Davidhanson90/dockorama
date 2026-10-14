import { PazuruConfirm } from "./confirm.js";
import { PazuruDocs } from "./docs.js";
import { PazuruDropGuide } from "./drop-guide.js";
import { PazuruFlyout } from "./flyout.js";
import { PazuruGutter } from "./gutter.js";
import { PazuruMenu } from "./menu.js";
import { PazuruNotice } from "./notice.js";
import { PazuruPalette } from "./palette.js";
import { PazuruRail } from "./rail.js";
import { PazuruSplit } from "./split.js";
import { PazuruStack } from "./stack.js";
import { PazuruTab } from "./tab.js";
import { PazuruTabMenu } from "./tab-menu.js";
import { PazuruTabstrip } from "./tabstrip.js";
import { PazuruToolbar } from "./toolbar.js";
import { PazuruView } from "./view.js";
import { PazuruWindow } from "./window.js";

export {
  PazuruConfirm, PazuruDocs, PazuruDropGuide, PazuruFlyout, PazuruGutter, PazuruMenu, PazuruNotice, PazuruPalette, PazuruRail,
  PazuruSplit, PazuruStack, PazuruTab, PazuruTabMenu, PazuruTabstrip, PazuruToolbar, PazuruView, PazuruWindow
};
export { PazuruPart, type PartRequest } from "./part.js";
export type { DockContext } from "./context.js";
export type { GuideSpot } from "./drop-guide.js";
export type { MenuEntry } from "./menu.js";
export type { TabMenuItem } from "./tab-menu.js";
export type { NoticeAction } from "./notice.js";

/** Tag name → class of every UI part a manager renders. */
export const PARTS = {
  "pazuru-split": PazuruSplit,
  "pazuru-gutter": PazuruGutter,
  "pazuru-stack": PazuruStack,
  "pazuru-docs": PazuruDocs,
  "pazuru-tabstrip": PazuruTabstrip,
  "pazuru-tab": PazuruTab,
  "pazuru-toolbar": PazuruToolbar,
  "pazuru-view": PazuruView,
  "pazuru-window": PazuruWindow,
  "pazuru-drop-guide": PazuruDropGuide,
  "pazuru-rail": PazuruRail,
  "pazuru-flyout": PazuruFlyout,
  "pazuru-menu": PazuruMenu,
  "pazuru-palette": PazuruPalette,
  "pazuru-tab-menu": PazuruTabMenu,
  "pazuru-notice": PazuruNotice,
  "pazuru-confirm": PazuruConfirm
} as const;

/** Register every UI part (safe to call more than once). */
export function defineParts(): void {
  for (const [tag, cls] of Object.entries(PARTS)) {
    if (!customElements.get(tag)) customElements.define(tag, cls);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pazuru-split": PazuruSplit;
    "pazuru-gutter": PazuruGutter;
    "pazuru-stack": PazuruStack;
    "pazuru-docs": PazuruDocs;
    "pazuru-tabstrip": PazuruTabstrip;
    "pazuru-tab": PazuruTab;
    "pazuru-toolbar": PazuruToolbar;
    "pazuru-view": PazuruView;
    "pazuru-window": PazuruWindow;
    "pazuru-drop-guide": PazuruDropGuide;
    "pazuru-rail": PazuruRail;
    "pazuru-flyout": PazuruFlyout;
    "pazuru-menu": PazuruMenu;
    "pazuru-palette": PazuruPalette;
    "pazuru-tab-menu": PazuruTabMenu;
    "pazuru-notice": PazuruNotice;
    "pazuru-confirm": PazuruConfirm;
  }
}
