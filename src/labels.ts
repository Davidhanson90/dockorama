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
  resize: "Resize"
};
