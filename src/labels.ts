/** User-facing strings. Override any of them through the `labels` property. */
export interface FlexdockLabels {
  dismiss: string;
  zoom: string;
  unzoom: string;
  stow: string;
  unstow: string;
  float: string;
  dock: string;
  popout: string;
  popin: string;
  more: string;
  palette: string;
  palettePlaceholder: string;
  noMatches: string;
  poppedOut: string;
  emptyDocs: string;
  moved: string;
  closed: string;
  resize: string;
  tabMenu: string;
  closeOthers: string;
  closeRight: string;
  closeAll: string;
  pin: string;
  unpin: string;
  splitRight: string;
  splitDown: string;
  reopenBlocked: string;
  reopen: string;
  keepDocked: string;
  unsaved: string;
  confirmClose: string;
  closeAnyway: string;
  cancel: string;
  moveMode: string;
  moveTarget: string;
  moveDone: string;
  moveCancelled: string;
  outerEdge: string;
}

export const DEFAULT_LABELS: FlexdockLabels = {
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
