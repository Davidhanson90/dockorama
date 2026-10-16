import type { DockoramaLabels } from "./labels.js";
import type { ChangeReason, DockoramaManager } from "./manager.js";
import type { Box, Caps, DropZone, EdgeZone, DockoramaModel } from "./model.js";
import type { Rect } from "./geometry.js";
import type { DragEngine } from "./drag.js";
import type { Timeline } from "./history.js";
import type { OutsideWindows } from "./outside.js";

export interface DragState {
  id: string;
  mode: "pending" | "tab" | "loose" | "window";
  startX: number;
  startY: number;
  x: number;
  y: number;
  windowKey?: string;
  windowStart?: Box;
  strip?: HTMLElement;
  target?: { view: string; rect: Rect; zone?: DropZone };
  /** Drop onto a gutter between two siblings. */
  gap?: { path: number[]; after: number; win?: string; rect: Rect };
  /** Drop into an empty document area. */
  fill?: { path: number[]; win?: string; rect: Rect };
  edge?: EdgeZone;
  /** Last spot reported through `dockorama-dragover`. */
  over?: string;
  /** Model when the drag started (restored by Escape). */
  origin: DockoramaModel;
  preview?: Rect;
  pointerId: number;
  /** Capabilities of the dragged view (set when another manager is the drop target). */
  caps?: Caps;
  /** Another manager in the same drag group under the pointer. */
  peer?: DockHost;
  /** The pointer left the browser window (dropping pops the view out). */
  beyond?: boolean;
  sx?: number;
  sy?: number;
}

/**
 * What the controllers split out of `DockoramaManager` need from it. The manager keeps these members private
 * (so its published typings are unchanged) and hands itself over as a `DockHost`.
 */
export interface DockHost extends HTMLElement, Pick<DockoramaManager, "toggleZoom" | "beginMove" | "stow" | "openPalette" | "undo" | "redo" | "dismiss" | "reveal" | "activate"> {
  _keyMove?: { id: string; index: number; zone: DropZone | EdgeZone };
  _say: string;
  theme: string;
  dragGroup: string | undefined;
  _model: DockoramaModel;
  store: import("./storage.js").LayoutStore;
  factories: Map<string, () => Element>;
  stash: Map<string, Element>;
  _guest?: DragState;
  _blocked: string[];
  readonly t: DockoramaLabels;
  caps(id: string): Caps;
  commit(next: DockoramaModel, reason: ChangeReason, record?: boolean): void;
  drag: DragEngine;
  snap: number;
  shown: Set<string>;
  _drag?: DragState;
  _menu?: unknown;
  _peek?: string;
  timeline: Timeline<DockoramaModel>;
  outside: OutsideWindows;
  readonly renderRoot: HTMLElement | DocumentFragment;
  hasView(id: string): boolean;
  mount(id: string, el: Element): void;
  emit(type: string, detail: unknown, cancelable?: boolean): boolean;
  emitBefore(type: string, detail: unknown): boolean;
  requestUpdate(): void;
  mainRect(): Rect | undefined;
  fitBox(b: Box): Box;
  dockToEdge(id: string, edge: EdgeZone): void;
  dropBetween(id: string, path: number[], after: number, win?: string): void;
  dropIntoDocs(id: string, path: number[], win?: string): void;
  place(id: string, target: string, zone: DropZone): void;
  detach(id: string, box?: Partial<Box>): void;
  popIn(id: string): void;
  popOut(id: string, options?: { into?: string; box?: Partial<Box> }): boolean;
  getViewElement(id: string): Element | null;
}
