import type { ChangeReason, DockoramaManager } from "./manager.js";
import type { TabMenuItem } from "./components/index.js";
import type { BeforeAddDetail, CommandDetail, DragKind, DragOverDetail, DropDetail, DockoramaStateEvents, ResizeDetail } from "./events.js";
import type { DropZone, EdgeZone, DockoramaModel, LayoutMigrations, LayoutSource } from "./model.js";
import type { DockoramaLabels } from "./labels.js";

/** Settable element properties shared by every framework wrapper. */
export interface DockoramaProps {
  model?: DockoramaModel;
  theme?: "light" | "dark" | "auto";
  snap?: number;
  storageKey?: string;
  keepEmpty?: boolean;
  labels?: Partial<DockoramaLabels>;
  /** Managers sharing a drag group accept each other's views. */
  dragGroup?: string;
  /** Customise the tab context menu. */
  tabMenu?: (viewId: string, items: TabMenuItem[]) => TabMenuItem[];
  /** Asked before a view with unsaved changes closes. */
  confirmClose?: (viewId: string) => boolean | Promise<boolean>;
  /** Current layout version; older saved layouts are upgraded with `migrations`. */
  layoutVersion?: number;
  retain?: "all" | "active";
  migrations?: LayoutMigrations;
}

/** Event callbacks shared by every framework wrapper (names are wrapper-neutral). */
export interface DockoramaHandlers {
  change?: (detail: { model: DockoramaModel; reason: ChangeReason }) => void;
  focus?: (detail: { id: string; previous?: string }) => void;
  viewshow?: (detail: { id: string; first: boolean }) => void;
  viewhide?: (detail: { id: string }) => void;
  close?: (detail: { id: string }) => void;
  /** Call `event.preventDefault()` to stop the view being added. */
  beforeadd?: (event: CustomEvent<BeforeAddDetail>) => void;
  /** Call `event.preventDefault()` to stop a menu command. */
  command?: (event: CustomEvent<CommandDetail>) => void;
  /** Call `event.preventDefault()` to stop the drag. */
  dragstart?: (event: CustomEvent<{ id: string; kind: DragKind }>) => void;
  dragover?: (detail: DragOverDetail) => void;
  drop?: (detail: DropDetail) => void;
  resize?: (detail: ResizeDetail) => void;
  resizing?: (detail: ResizeDetail) => void;
  float?: (detail: DockoramaStateEvents["dockorama-float"]) => void;
  dock?: (detail: DockoramaStateEvents["dockorama-dock"]) => void;
  stow?: (detail: DockoramaStateEvents["dockorama-stow"]) => void;
  unstow?: (detail: DockoramaStateEvents["dockorama-unstow"]) => void;
  pin?: (detail: DockoramaStateEvents["dockorama-pin"]) => void;
  unpin?: (detail: DockoramaStateEvents["dockorama-unpin"]) => void;
  popout?: (detail: DockoramaStateEvents["dockorama-popout"]) => void;
  popin?: (detail: DockoramaStateEvents["dockorama-popin"]) => void;
  collapse?: (detail: DockoramaStateEvents["dockorama-collapse"]) => void;
  expand?: (detail: DockoramaStateEvents["dockorama-expand"]) => void;
  viewremove?: (detail: DockoramaStateEvents["dockorama-viewremove"]) => void;
  /** Call `event.preventDefault()` to keep the view open. */
  beforeclose?: (event: CustomEvent<{ id: string }>) => void;
  /** Call `event.preventDefault()` to stop the move. */
  beforemove?: (event: CustomEvent<{ id: string; target?: string; zone: DropZone | EdgeZone | "between" }>) => void;
  dragcancel?: (detail: { id: string }) => void;
  /** A view moved to (`direction: "out"`) or from (`"in"`) another manager. */
  transfer?: (detail: { id: string; from: DockoramaManager; to: DockoramaManager; direction: "in" | "out" }) => void;
  /** A view's unsaved-changes flag changed. */
  dirty?: (detail: { id: string; dirty: boolean }) => void;
  /** A layout from code, `restore()` or storage had problems (`fatal`: it was not used). */
  layoutissue?: (detail: { source: LayoutSource; problems: string[]; fatal: boolean }) => void;
}

const PROP_KEYS = ["model", "theme", "snap", "storageKey", "keepEmpty", "labels", "dragGroup", "tabMenu", "confirmClose", "layoutVersion", "migrations", "retain"] as const;
const EVENT_KEYS = [
  "change", "focus", "viewshow", "viewhide", "beforeclose", "close", "beforemove", "beforeadd", "command", "dragstart", "dragover", "drop",
  "dragcancel", "transfer", "dirty", "layoutissue", "resize", "resizing", "float", "dock", "stow", "unstow", "pin", "unpin", "popout", "popin",
  "collapse", "expand", "viewremove"
] as const;
const RAW = new Set<string>(["beforeclose", "beforemove", "beforeadd", "command", "dragstart"]);

/** Copy defined props onto the element (skips unchanged values so models are not set twice). */
export function applyProps(el: DockoramaManager, props: DockoramaProps): void {
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
export function bindEvents(el: HTMLElement, get: () => DockoramaHandlers): () => void {
  const off: Array<() => void> = [];
  for (const key of EVENT_KEYS) {
    const fn = (e: Event) => {
      const h = get()[key] as ((arg: unknown) => void) | undefined;
      if (!h) return;
      h(RAW.has(key) ? e : (e as CustomEvent).detail);
    };
    el.addEventListener(`dockorama-${key}`, fn);
    off.push(() => el.removeEventListener(`dockorama-${key}`, fn));
  }
  return () => off.forEach((f) => f());
}
