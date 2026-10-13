/** Logical side of the component. `start`/`end` follow writing direction (RTL aware). */
export type Side = "start" | "end" | "top" | "bottom";
/** Where a dragged view lands relative to a target view's group. */
export type DropZone = "left" | "right" | "above" | "below" | "into";
/** Where a dragged view lands relative to the whole component. */
export type EdgeZone = "edge-left" | "edge-right" | "edge-above" | "edge-below";

/** What a user may do with a view. Everything defaults to allowed except `docsOnly`. */
export interface Caps {
  dismiss?: boolean;
  hide?: boolean;
  float?: boolean;
  move?: boolean;
  zoom?: boolean;
  popout?: boolean;
  /** Only allowed inside a document area. */
  docsOnly?: boolean;
  /** Content is inert (not interactive). */
  inert?: boolean;
}

export interface ViewInfo {
  title: string;
  /** Optional short glyph / emoji shown before the title. */
  icon?: string;
  caps?: Caps;
  /** Hint for apps: content should be created on first reveal (see `flexdock-viewshow`). */
  lazy?: boolean;
  /** Tooltip / palette description. */
  hint?: string;
}

export interface SplitNode {
  kind: "split";
  axis: "row" | "column";
  children: DockNode[];
  /** Relative weights, one per child. */
  weights: number[];
}

export interface StackNode {
  kind: "stack";
  views: string[];
  current: string;
  /** Editor-style document area: tabs always shown, kept even when empty. */
  docs?: boolean;
}

export type DockNode = SplitNode | StackNode;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloatWindow {
  key: string;
  box: Box;
  tree: DockNode;
}

export interface FlexdockModel {
  v: 1;
  views: Record<string, ViewInfo>;
  root: DockNode | null;
  windows: FloatWindow[];
  drawers: Record<Side, string[]>;
  parked: string[];
  focus?: string;
  zoom?: string;
}

/** Where a view currently lives. */
export type Whereabouts =
  | { place: "tree"; window?: string; stack: StackNode; path: number[] }
  | { place: "drawer"; side: Side }
  | { place: "parked" }
  | { place: "nowhere" };
