import type { DockoramaLabels } from "./labels.js";
import type { ChangeReason, DockoramaManager } from "./manager.js";
import type { Box, Caps, DropZone, EdgeZone, DockoramaModel } from "./model.js";
import type { Rect } from "./geometry.js";

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
  peer?: DockoramaManager;
  /** The pointer left the browser window (dropping pops the view out). */
  beyond?: boolean;
  sx?: number;
  sy?: number;
}

/**
 * What the controllers split out of `DockoramaManager` need from it. The manager keeps these members private
 * (so its published typings are unchanged) and hands itself over as a `DockHost`.
 */
export interface DockHost extends HTMLElement {
  theme: string;
  _model: DockoramaModel;
  store: import("./storage.js").LayoutStore;
  factories: Map<string, () => Element>;
  stash: Map<string, Element>;
  _guest?: DragState;
  _blocked: string[];
  readonly t: DockoramaLabels;
  caps(id: string): Caps;
  commit(next: DockoramaModel, reason: ChangeReason, record?: boolean): void;
  hoverAt(id: string, x: number, y: number, caps?: Caps): void;
  clearGuest(): void;
  applyDrop(model: DockoramaModel, id: string, d: DragState): DockoramaModel | undefined;
  popIn(id: string): void;
  popOut(id: string, options?: { into?: string; box?: Partial<Box> }): boolean;
  getViewElement(id: string): Element | null;
}
