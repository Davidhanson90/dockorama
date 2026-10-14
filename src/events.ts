// Public event names and detail types, plus the pure model diff that derives state events.
import type { Box, DockNode, DropZone, EdgeZone, PazuruModel, Side, ViewSpot } from "./model.js";
import { stacksOf, viewsIn } from "./ops.js";

/** Where a view lived before it was docked into the main layout. */
export type DockOrigin = "floating" | "drawer" | "closed";

/** What the pointer is over during a drag (detail of `pazuru-dragover` and `pazuru-drop`). */
export type DragSpot = DropZone | EdgeZone | "between" | "empty" | "tabs" | "outside" | "other-dock" | "none";

/** How a drag started: reordering in a tab strip, a loose view, or moving a whole floating window. */
export type DragKind = "tab" | "loose" | "window";

/** Detail of `pazuru-dragover`: fired when the drop spot changes. */
export interface DragOverDetail {
  id: string;
  spot: DragSpot;
  /** View whose group is the target, when there is one. */
  target?: string;
}

/** Detail of `pazuru-drop`: the drag ended. `moved` is false when nothing changed (or a listener vetoed it). */
export interface DropDetail extends DragOverDetail {
  moved: boolean;
}

/** Detail of `pazuru-resize` / `pazuru-resizing`. */
export type ResizeDetail =
  | { kind: "split"; path: number[]; window?: string; sizes: number[] }
  | { kind: "window"; window: string; box: Box };

/** Where a menu command came from. */
export type CommandSource = "tab-menu" | "pane-menu";

/** Detail of the cancellable `pazuru-command`. `custom` is true for app-added tab menu items. */
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

/** Every public pazuru event detail, keyed by event name (state, drag, resize and command events). */
export interface PazuruStateEvents {
  "pazuru-float": { id: string; window: string };
  "pazuru-dock": { id: string; from: DockOrigin };
  "pazuru-stow": { id: string; side: Side };
  "pazuru-unstow": { id: string };
  "pazuru-pin": { id: string };
  "pazuru-unpin": { id: string };
  "pazuru-popout": { id: string; window: string };
  "pazuru-popin": { id: string };
  "pazuru-collapse": FoldDetail;
  "pazuru-expand": FoldDetail;
  "pazuru-viewremove": { id: string };
}

export type StateEventName = keyof PazuruStateEvents;
export type StateEvent = { [K in StateEventName]: { type: K; detail: PazuruStateEvents[K] } }[StateEventName];

type Spot = { kind: "tree"; window?: string } | { kind: "drawer"; side: Side } | { kind: "parked" } | { kind: "gone" };

function spots(m: PazuruModel): Map<string, Spot> {
  const out = new Map<string, Spot>();
  for (const id of viewsIn(m.root)) out.set(id, { kind: "tree" });
  for (const w of m.windows) for (const id of viewsIn(w.tree)) out.set(id, { kind: "tree", window: w.key });
  for (const side of Object.keys(m.drawers) as Side[]) for (const id of m.drawers[side]) out.set(id, { kind: "drawer", side });
  for (const id of m.parked) out.set(id, { kind: "parked" });
  return out;
}

function pinned(m: PazuruModel): Set<string> {
  const trees = [m.root, ...m.windows.map((w) => w.tree)];
  return new Set(trees.flatMap((t) => stacksOf(t).flatMap((s) => s.stack.pinned ?? [])));
}

function outside(m: PazuruModel): Map<string, string> {
  const out = new Map<string, string>();
  for (const o of m.outside ?? []) for (const id of o.views) out.set(id, o.key);
  return out;
}

/** Collapsed split cells, keyed by the views inside them (stable across unrelated path changes). */
function folds(m: PazuruModel): Map<string, FoldDetail> {
  const out = new Map<string, FoldDetail>();
  const walk = (node: DockNode | null, path: number[], window?: string): void => {
    if (!node || node.kind !== "split") return;
    node.children.forEach((child, index) => {
      if (node.folded?.[index]) {
        const views = viewsIn(child);
        out.set(`${window ?? ""}|${views.join(",")}`, { views, path, index, ...(window ? { window } : {}) });
      }
      walk(child, [...path, index], window);
    });
  };
  walk(m.root, []);
  for (const w of m.windows) walk(w.tree, [], w.key);
  return out;
}

/**
 * The state events implied by going from `prev` to `next`, in a stable order. Closing is not derived here
 * (the manager fires `pazuru-close` itself, so only real closes count).
 */
export function stateEvents(prev: PazuruModel, next: PazuruModel): StateEvent[] {
  if (prev === next) return [];
  const out: StateEvent[] = [];
  const a = spots(prev);
  const b = spots(next);
  for (const [id, now] of b) {
    const was = a.get(id) ?? { kind: "gone" };
    if (now.kind === "tree" && now.window && !(was.kind === "tree" && was.window)) out.push({ type: "pazuru-float", detail: { id, window: now.window } });
    if (now.kind === "tree" && !now.window && !(was.kind === "tree" && !was.window) && was.kind !== "gone") {
      const from: DockOrigin = was.kind === "tree" ? "floating" : was.kind === "drawer" ? "drawer" : "closed";
      out.push({ type: "pazuru-dock", detail: { id, from } });
    }
    if (now.kind === "drawer" && was.kind !== "drawer") out.push({ type: "pazuru-stow", detail: { id, side: now.side } });
    if (was.kind === "drawer" && now.kind !== "drawer") out.push({ type: "pazuru-unstow", detail: { id } });
  }
  for (const [id, was] of a) {
    if (b.has(id)) continue;
    if (was.kind === "drawer") out.push({ type: "pazuru-unstow", detail: { id } });
  }
  for (const id of Object.keys(prev.views)) if (!(id in next.views)) out.push({ type: "pazuru-viewremove", detail: { id } });

  const pa = pinned(prev);
  const pb = pinned(next);
  for (const id of pb) if (!pa.has(id)) out.push({ type: "pazuru-pin", detail: { id } });
  for (const id of pa) if (!pb.has(id) && id in next.views) out.push({ type: "pazuru-unpin", detail: { id } });

  const oa = outside(prev);
  const ob = outside(next);
  for (const [id, key] of ob) if (!oa.has(id)) out.push({ type: "pazuru-popout", detail: { id, window: key } });
  for (const id of oa.keys()) if (!ob.has(id)) out.push({ type: "pazuru-popin", detail: { id } });

  const fa = folds(prev);
  const fb = folds(next);
  for (const [k, d] of fb) if (!fa.has(k)) out.push({ type: "pazuru-collapse", detail: d });
  for (const [k, d] of fa) if (!fb.has(k)) out.push({ type: "pazuru-expand", detail: d });
  return out;
}

/** Detail of the cancellable `pazuru-beforeadd`. */
export interface BeforeAddDetail {
  id: string;
  title: string;
  at?: ViewSpot;
}
