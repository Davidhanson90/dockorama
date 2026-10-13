import type { ChangeReason, FlexdockManager } from "./manager.js";
import type { DropZone, EdgeZone, FlexdockModel } from "./model.js";
import type { FlexdockLabels } from "./labels.js";

/** Settable element properties shared by every framework wrapper. */
export interface FlexdockProps {
  model?: FlexdockModel;
  theme?: "light" | "dark" | "auto";
  snap?: number;
  storageKey?: string;
  keepEmpty?: boolean;
  labels?: Partial<FlexdockLabels>;
}

/** Event callbacks shared by every framework wrapper (names are wrapper-neutral). */
export interface FlexdockHandlers {
  change?: (detail: { model: FlexdockModel; reason: ChangeReason }) => void;
  focus?: (detail: { id: string; previous?: string }) => void;
  viewshow?: (detail: { id: string }) => void;
  /** Call `event.preventDefault()` to keep the view open. */
  beforeclose?: (event: CustomEvent<{ id: string }>) => void;
  /** Call `event.preventDefault()` to stop the move. */
  beforemove?: (event: CustomEvent<{ id: string; target?: string; zone: DropZone | EdgeZone | "between" }>) => void;
  dragcancel?: (detail: { id: string }) => void;
}

export const PROP_KEYS = ["model", "theme", "snap", "storageKey", "keepEmpty", "labels"] as const;
export const EVENT_KEYS = ["change", "focus", "viewshow", "beforeclose", "beforemove", "dragcancel"] as const;
const RAW = new Set<string>(["beforeclose", "beforemove"]);

/** Copy defined props onto the element (skips unchanged values so models are not set twice). */
export function applyProps(el: FlexdockManager, props: FlexdockProps): void {
  for (const key of PROP_KEYS) {
    const value = props[key];
    if (value === undefined) continue;
    if ((el as unknown as Record<string, unknown>)[key] === value) continue;
    if (key === "model" && el.model === value) continue;
    (el as unknown as Record<string, unknown>)[key] = value;
  }
}

/**
 * Subscribe to element events; `get` is read on every event so handlers may change between renders.
 * Returns an unsubscribe function.
 */
export function bindEvents(el: HTMLElement, get: () => FlexdockHandlers): () => void {
  const off: Array<() => void> = [];
  for (const key of EVENT_KEYS) {
    const fn = (e: Event) => {
      const h = get()[key] as ((arg: unknown) => void) | undefined;
      if (!h) return;
      h(RAW.has(key) ? e : (e as CustomEvent).detail);
    };
    el.addEventListener(`flexdock-${key}`, fn);
    off.push(() => el.removeEventListener(`flexdock-${key}`, fn));
  }
  return () => off.forEach((f) => f());
}
