// Runtime constants of dockorama: the package version, default labels, menu sizing and the built-in icon set.
import { svg } from "lit";
import type { DockoramaLabels } from "./contracts.js";

/** Current package version. */
export const VERSION = "0.1.0";

/** Lists longer than this are virtualised: only the rows in view are rendered. */
export const VIRTUAL_AFTER = 40;

/** Row height (px) of a virtualised list. */
export const ROW = 30;

/** User-facing strings. Override any of them through the `labels` property. */
export const DEFAULT_LABELS: DockoramaLabels = {
  dismiss: "Close",
  zoom: "Fill the layout",
  unzoom: "Back to layout",
  stow: "Auto-hide to edge",
  unstow: "Keep open",
  float: "Float in window",
  dock: "Dock back",
  popout: "Open in new browser window",
  popin: "Bring back",
  more: "More actions",
  palette: "Go to view",
  palettePlaceholder: "Type to find a view or action…",
  noMatches: "Nothing matches",
  poppedOut: "This view is open in its own browser window.",
  emptyDocs: "Drop a view here",
  moved: "Moved",
  closed: "Closed",
  resize: "Resize",
  tabMenu: "Tab actions",
  closeOthers: "Close others",
  closeRight: "Close to the right",
  closeAll: "Close all",
  pin: "Pin tab",
  unpin: "Unpin tab",
  splitRight: "Move to new group on the right",
  splitDown: "Move to new group below",
  reopenBlocked: "Some views were open in their own browser windows. Your browser blocked re-opening them.",
  reopen: "Re-open windows",
  keepDocked: "Keep them here",
  unsaved: "Unsaved changes",
  confirmClose: "{title} has unsaved changes. Close it anyway?",
  closeAnyway: "Close",
  cancel: "Cancel",
  moveMode: "Moving {title}. Tab chooses a group, arrow keys a side, Enter drops, Escape cancels.",
  moveTarget: "{target}, {zone}",
  moveDone: "Moved {title}",
  moveCancelled: "Move cancelled",
  outerEdge: "Outer edge"
};

// Original line icons drawn for dockorama on a 16x16 grid.
const frame = (body: ReturnType<typeof svg>) => svg`<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  close: frame(svg`<path d="M4 4l8 8M12 4l-8 8"/>`),
  zoom: frame(svg`<path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3"/>`),
  unzoom: frame(svg`<path d="M6 3v3H3M10 3v3h3M6 13v-3H3M10 13v-3h3"/>`),
  stow: frame(svg`<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M6 2.5v11M10.5 6.5L8.5 8l2 1.5"/>`),
  unstow: frame(svg`<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M6 2.5v11M8.5 6.5l2 1.5-2 1.5"/>`),
  float: frame(svg`<rect x="2.5" y="5.5" width="8" height="8" rx="1"/><path d="M6 5.5V3.5a1 1 0 0 1 1-1h5.5a1 1 0 0 1 1 1V9a1 1 0 0 1-1 1h-2"/>`),
  popout: frame(svg`<path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3"/>`),
  more: frame(svg`<circle cx="3.5" cy="8" r=".6"/><circle cx="8" cy="8" r=".6"/><circle cx="12.5" cy="8" r=".6"/>`),
  arrow: (deg: number) => frame(svg`<path transform="rotate(${deg} 8 8)" d="M8 12.5V3.5M4.5 7L8 3.5 11.5 7"/>`),
  pin: frame(svg`<path d="M6 2.5h4M7 2.5v4L4.5 9h7L9 6.5v-4M8 9v4.5"/>`),
  join: frame(svg`<rect x="3" y="3" width="10" height="10" rx="1.5"/><path d="M3 6h10"/>`)
};