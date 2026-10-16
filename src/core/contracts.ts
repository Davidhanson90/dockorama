// Shared type contracts of dockorama: the layout model, event details, labels, geometry shapes,
// engine unions and the UI-part contracts. Pure types only — no runtime code, no imports.

// api-check:start-model-contracts
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
  /** Hint for apps: content should be created on first reveal (see `dockorama-viewshow`). */
  lazy?: boolean;
  /** With the manager's `retain="active"`: keep this view's content attached while hidden. */
  keepAlive?: boolean;
  /** Tooltip / palette description. */
  hint?: string;
}

export interface SplitNode {
  kind: "split";
  axis: "row" | "column";
  children: DockNode[];
  /** Relative weights, one per child. */
  weights: number[];
  /** Per child: a fixed size in px that stays put when the layout resizes (null = shares space by weight). */
  fixed?: Array<number | null>;
  /** Per child: min / max size in px along the axis (null = none). */
  limits?: Array<SizeLimits | null>;
  /** Per child: collapsed to nothing (restored by double-clicking the gutter next to it). */
  folded?: boolean[];
}

/** Size bounds of a split child, in px along the split axis. */
export interface SizeLimits {
  min?: number;
  max?: number;
}

export interface StackNode {
  kind: "stack";
  views: string[];
  current: string;
  /** Editor-style document area: tabs always shown, kept even when empty. */
  docs?: boolean;
  /** Pinned views: always first in `views`, drawn compact. */
  pinned?: string[];
  /** The group's preview view (italic tab), replaced by the next preview opened here. */
  preview?: string;
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

/**
 * A separate browser window holding the content of one or more views. The views stay in their place in the
 * layout (which shows a placeholder) so bringing them back puts them where they were.
 */
export interface OutsideWindow {
  key: string;
  views: string[];
  current: string;
  /** Screen position and outer size, when known. */
  box?: Box;
}

export interface DockoramaModel {
  v: 1;
  /** Your app's layout version (see the manager's `layoutVersion` and `migrations`). Missing = 0. */
  version?: number;
  views: Record<string, ViewInfo>;
  root: DockNode | null;
  windows: FloatWindow[];
  drawers: Record<Side, string[]>;
  parked: string[];
  /** Views whose content is open in separate browser windows (re-opened on load). */
  outside?: OutsideWindow[];
  focus?: string;
  zoom?: string;
}

/** Where a view currently lives. */
export type Whereabouts =
  | { place: "tree"; window?: string; stack: StackNode; path: number[] }
  | { place: "drawer"; side: Side }
  | { place: "parked" }
  | { place: "nowhere" };

/**
 * Where `addView` puts a new view.
 * - `"auto"` (default): the first document area, else the right edge.
 * - `"docs"`: the first document area (throws if there is none).
 * - `"parked"`: registered but closed; show it later with `reveal(id)`.
 * - `{ near, zone }`: beside / into the group holding another view (`zone` defaults to `"into"`).
 * - `{ edge }`: at an outer edge of the main layout, taking `weight` (0..1) of it.
 * - `{ float }`: in its own floating window (`box` fields are optional).
 * - `{ stow }`: auto-hidden on a side rail.
 */
export type ViewSpot =
  | "auto"
  | "docs"
  | "parked"
  | { near: string; zone?: DropZone; index?: number }
  | { edge: EdgeZone; weight?: number }
  | { float: Partial<Box> | true }
  | { stow: Side };

/** Content for `addView`: an element, a text string, or a factory called on first show. */
export type ViewContent = Element | string | (() => Element);

/** Options for `addView`. Every `ViewInfo` field plus where to put the view. */
export interface ViewOptions extends Partial<ViewInfo> {
  at?: ViewSpot;
  /** Open as the group's preview tab: it replaces the group's current preview, and is kept once promoted. */
  preview?: boolean;
}

/** Upgrade steps for saved layouts: `migrations[n]` turns a version-`n` model into version `n + 1`. */
export type LayoutMigrations = Record<number, (model: DockoramaModel) => DockoramaModel>;

/** Where a layout being checked came from (detail of `dockorama-layoutissue`). */
export type LayoutSource = "set" | "restore" | "storage";
// api-check:end-model-contracts

/** Where a view lived before it was docked into the main layout. */
export type DockOrigin = "floating" | "drawer" | "closed";

/** What the pointer is over during a drag (detail of `dockorama-dragover` and `dockorama-drop`). */
export type DragSpot = DropZone | EdgeZone | "between" | "empty" | "tabs" | "outside" | "other-dock" | "none";

/** How a drag started: reordering in a tab strip, a loose view, or moving a whole floating window. */
export type DragKind = "tab" | "loose" | "window";

/** Detail of `dockorama-dragover`: fired when the drop spot changes. */
export interface DragOverDetail {
  id: string;
  spot: DragSpot;
  /** View whose group is the target, when there is one. */
  target?: string;
}

/** Detail of `dockorama-drop`: the drag ended. `moved` is false when nothing changed (or a listener vetoed it). */
export interface DropDetail extends DragOverDetail {
  moved: boolean;
}

/** Detail of `dockorama-resize` / `dockorama-resizing`. */
export type ResizeDetail =
  | { kind: "split"; path: number[]; window?: string; sizes: number[] }
  | { kind: "window"; window: string; box: Box };

/** Where a menu command came from. */
export type CommandSource = "tab-menu" | "pane-menu";

/** Detail of the cancellable `dockorama-command`. `custom` is true for app-added tab menu items. */
export interface CommandDetail {
  id: string;
  command: string;
  source: CommandSource;
  custom: boolean;
}

/** Detail of the collapse / expand events: the split cell that changed and the views in it. */
export interface FoldDetail {
  views: string[];
  path: number[];
  index: number;
  window?: string;
}

/** Every public dockorama event detail, keyed by event name (state, drag, resize and command events). */
export interface DockoramaStateEvents {
  "dockorama-float": { id: string; window: string };
  "dockorama-dock": { id: string; from: DockOrigin };
  "dockorama-stow": { id: string; side: Side };
  "dockorama-unstow": { id: string };
  "dockorama-pin": { id: string };
  "dockorama-unpin": { id: string };
  "dockorama-popout": { id: string; window: string };
  "dockorama-popin": { id: string };
  "dockorama-collapse": FoldDetail;
  "dockorama-expand": FoldDetail;
  "dockorama-viewremove": { id: string };
}

export type StateEventName = keyof DockoramaStateEvents;
export type StateEvent = { [K in StateEventName]: { type: K; detail: DockoramaStateEvents[K] } }[StateEventName];

/** Detail of the cancellable `dockorama-beforeadd`. */
export interface BeforeAddDetail {
  id: string;
  title: string;
  at?: ViewSpot;
}

/** User-facing strings. Override any of them through the `labels` property. */
export interface DockoramaLabels {
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

export interface Rect { left: number; top: number; width: number; height: number; }
export interface Spot<Z extends string> { zone: Z; x: number; y: number; }

/** Why the model changed (detail of `dockorama-change`). */
export type ChangeReason =
  | "set" | "place" | "edge" | "detach" | "window" | "stow" | "unstow" | "dismiss" | "reveal" | "select"
  | "reorder" | "resize" | "zoom" | "add" | "forget" | "undo" | "redo" | "focus" | "restore" | "cancel"
  | "transfer" | "popout" | "popin" | "pin" | "promote";

/** Built-in keys of the tab context menu. */
export type TabCommand =
  | "close" | "close-others" | "close-right" | "close-all" | "pin" | "float" | "popout" | "split-right" | "split-down" | "stow";

/** Detail of the internal `dockorama-request` event that UI parts send to their manager. */
export interface PartRequest {
  action: string;
  id?: string;
  [key: string]: unknown;
}

/** Read-only state a manager hands down to its UI parts on every render. */
export interface DockContext {
  model: DockoramaModel;
  labels: DockoramaLabels;
  /** Views whose content is in a separate browser window. */
  popped: ReadonlySet<string>;
  /** The gutter currently under a drag, if any. */
  gap?: { path: string; after: number; win: string };
  /** True while a pointer drag is in progress. */
  dragging: boolean;
  /** Views with unsaved changes. */
  dirty?: ReadonlySet<string>;
}

/** One drop target shown during a drag (coordinates relative to the manager). */
export interface GuideSpot {
  zone: string;
  x: number;
  y: number;
  hot: boolean;
}

/** An entry of `<dockorama-menu>`: a command, a radio item (`checked` set) or a separator. */
export type MenuEntry = { label: string; action: string; id: string; checked?: boolean } | "separator";

/**
 * One item of a tab's context menu. Built-in items carry a `key` the manager acts on; your own items
 * (added through the manager's `tabMenu` hook) carry a `run` callback. `"separator"` draws a rule.
 */
export type TabMenuItem =
  | { key: string; label: string; disabled?: boolean; checked?: boolean; run?: (viewId: string) => void }
  | "separator";

/** A button of `<dockorama-notice>`: its label and the request action it sends. */
export interface NoticeAction {
  label: string;
  action: string;
  primary?: boolean;
}