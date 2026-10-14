import type { PazuruLabels } from "../labels.js";
import type { PazuruModel } from "../model.js";

/** Read-only state a manager hands down to its UI parts on every render. */
export interface DockContext {
  model: PazuruModel;
  labels: PazuruLabels;
  /** Views whose content is in a separate browser window. */
  popped: ReadonlySet<string>;
  /** The gutter currently under a drag, if any. */
  gap?: { path: string; after: number; win: string };
  /** True while a pointer drag is in progress. */
  dragging: boolean;
  /** Views with unsaved changes. */
  dirty?: ReadonlySet<string>;
}

/** Slot name for a view's light-DOM content. */
export const slotOf = (id: string): string => `v:${id}`;
