import { DockoramaConfirm } from "./confirm.js";
import { DockoramaDocs } from "./docs.js";
import { DockoramaDropGuide } from "./drop-guide.js";
import { DockoramaFlyout } from "./flyout.js";
import { DockoramaGutter } from "./gutter.js";
import { DockoramaMenu } from "./menu.js";
import { DockoramaNotice } from "./notice.js";
import { DockoramaPalette } from "./palette.js";
import { DockoramaRail } from "./rail.js";
import { DockoramaSplit } from "./split.js";
import { DockoramaStack } from "./stack.js";
import { DockoramaTab } from "./tab.js";
import { DockoramaTabMenu } from "./tab-menu.js";
import { DockoramaTabstrip } from "./tabstrip.js";
import { DockoramaToolbar } from "./toolbar.js";
import { DockoramaView } from "./view.js";
import { DockoramaWindow } from "./window.js";

export {
  DockoramaConfirm, DockoramaDocs, DockoramaDropGuide, DockoramaFlyout, DockoramaGutter, DockoramaMenu, DockoramaNotice, DockoramaPalette, DockoramaRail,
  DockoramaSplit, DockoramaStack, DockoramaTab, DockoramaTabMenu, DockoramaTabstrip, DockoramaToolbar, DockoramaView, DockoramaWindow
};
export { DockoramaPart } from "./part.js";
export type { DockContext, GuideSpot, MenuEntry, NoticeAction, PartRequest, TabMenuItem } from "../core/contracts.js";

/** Tag name → class of every UI part a manager renders. */
export const PARTS = {
  "dockorama-split": DockoramaSplit,
  "dockorama-gutter": DockoramaGutter,
  "dockorama-stack": DockoramaStack,
  "dockorama-docs": DockoramaDocs,
  "dockorama-tabstrip": DockoramaTabstrip,
  "dockorama-tab": DockoramaTab,
  "dockorama-toolbar": DockoramaToolbar,
  "dockorama-view": DockoramaView,
  "dockorama-window": DockoramaWindow,
  "dockorama-drop-guide": DockoramaDropGuide,
  "dockorama-rail": DockoramaRail,
  "dockorama-flyout": DockoramaFlyout,
  "dockorama-menu": DockoramaMenu,
  "dockorama-palette": DockoramaPalette,
  "dockorama-tab-menu": DockoramaTabMenu,
  "dockorama-notice": DockoramaNotice,
  "dockorama-confirm": DockoramaConfirm
} as const;

/** Register every UI part (safe to call more than once). */
export function defineParts(): void {
  for (const [tag, cls] of Object.entries(PARTS)) {
    if (!customElements.get(tag)) customElements.define(tag, cls);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "dockorama-split": DockoramaSplit;
    "dockorama-gutter": DockoramaGutter;
    "dockorama-stack": DockoramaStack;
    "dockorama-docs": DockoramaDocs;
    "dockorama-tabstrip": DockoramaTabstrip;
    "dockorama-tab": DockoramaTab;
    "dockorama-toolbar": DockoramaToolbar;
    "dockorama-view": DockoramaView;
    "dockorama-window": DockoramaWindow;
    "dockorama-drop-guide": DockoramaDropGuide;
    "dockorama-rail": DockoramaRail;
    "dockorama-flyout": DockoramaFlyout;
    "dockorama-menu": DockoramaMenu;
    "dockorama-palette": DockoramaPalette;
    "dockorama-tab-menu": DockoramaTabMenu;
    "dockorama-notice": DockoramaNotice;
    "dockorama-confirm": DockoramaConfirm;
  }
}
