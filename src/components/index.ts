import { FlexdockConfirm } from "./confirm.js";
import { FlexdockDocs } from "./docs.js";
import { FlexdockDropGuide } from "./drop-guide.js";
import { FlexdockFlyout } from "./flyout.js";
import { FlexdockGutter } from "./gutter.js";
import { FlexdockMenu } from "./menu.js";
import { FlexdockNotice } from "./notice.js";
import { FlexdockPalette } from "./palette.js";
import { FlexdockRail } from "./rail.js";
import { FlexdockSplit } from "./split.js";
import { FlexdockStack } from "./stack.js";
import { FlexdockTab } from "./tab.js";
import { FlexdockTabMenu } from "./tab-menu.js";
import { FlexdockTabstrip } from "./tabstrip.js";
import { FlexdockToolbar } from "./toolbar.js";
import { FlexdockView } from "./view.js";
import { FlexdockWindow } from "./window.js";

export {
  FlexdockConfirm, FlexdockDocs, FlexdockDropGuide, FlexdockFlyout, FlexdockGutter, FlexdockMenu, FlexdockNotice, FlexdockPalette, FlexdockRail,
  FlexdockSplit, FlexdockStack, FlexdockTab, FlexdockTabMenu, FlexdockTabstrip, FlexdockToolbar, FlexdockView, FlexdockWindow
};
export { FlexdockPart, type PartRequest } from "./part.js";
export type { DockContext } from "./context.js";
export type { GuideSpot } from "./drop-guide.js";
export type { MenuEntry } from "./menu.js";
export type { TabMenuItem } from "./tab-menu.js";
export type { NoticeAction } from "./notice.js";

/** Tag name → class of every UI part a manager renders. */
export const PARTS = {
  "flexdock-split": FlexdockSplit,
  "flexdock-gutter": FlexdockGutter,
  "flexdock-stack": FlexdockStack,
  "flexdock-docs": FlexdockDocs,
  "flexdock-tabstrip": FlexdockTabstrip,
  "flexdock-tab": FlexdockTab,
  "flexdock-toolbar": FlexdockToolbar,
  "flexdock-view": FlexdockView,
  "flexdock-window": FlexdockWindow,
  "flexdock-drop-guide": FlexdockDropGuide,
  "flexdock-rail": FlexdockRail,
  "flexdock-flyout": FlexdockFlyout,
  "flexdock-menu": FlexdockMenu,
  "flexdock-palette": FlexdockPalette,
  "flexdock-tab-menu": FlexdockTabMenu,
  "flexdock-notice": FlexdockNotice,
  "flexdock-confirm": FlexdockConfirm
} as const;

/** Register every UI part (safe to call more than once). */
export function defineParts(): void {
  for (const [tag, cls] of Object.entries(PARTS)) {
    if (!customElements.get(tag)) customElements.define(tag, cls);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "flexdock-split": FlexdockSplit;
    "flexdock-gutter": FlexdockGutter;
    "flexdock-stack": FlexdockStack;
    "flexdock-docs": FlexdockDocs;
    "flexdock-tabstrip": FlexdockTabstrip;
    "flexdock-tab": FlexdockTab;
    "flexdock-toolbar": FlexdockToolbar;
    "flexdock-view": FlexdockView;
    "flexdock-window": FlexdockWindow;
    "flexdock-drop-guide": FlexdockDropGuide;
    "flexdock-rail": FlexdockRail;
    "flexdock-flyout": FlexdockFlyout;
    "flexdock-menu": FlexdockMenu;
    "flexdock-palette": FlexdockPalette;
    "flexdock-tab-menu": FlexdockTabMenu;
    "flexdock-notice": FlexdockNotice;
    "flexdock-confirm": FlexdockConfirm;
  }
}
