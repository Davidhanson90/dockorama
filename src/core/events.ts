// The pure model diff that derives state events, and the global event-name → detail type map.
// The event detail types themselves live in ./contracts.js.
import type {
  BeforeAddDetail, ChangeReason, CommandDetail, DockNode, DockOrigin, DockoramaModel, DockoramaStateEvents, DragKind,
  DragOverDetail, DropDetail, DropZone, EdgeZone, FoldDetail, LayoutSource, ResizeDetail, Side, StateEvent
} from "./contracts.js";
import { stacksOf, viewsIn } from "./ops.js";
import type { DockoramaManager } from "../engine/manager.js";

type Spot = { kind: "tree"; window?: string } | { kind: "drawer"; side: Side } | { kind: "parked" } | { kind: "gone" };

function spots(m: DockoramaModel): Map<string, Spot> {
  const out = new Map<string, Spot>();
  for (const id of viewsIn(m.root)) out.set(id, { kind: "tree" });
  for (const w of m.windows) for (const id of viewsIn(w.tree)) out.set(id, { kind: "tree", window: w.key });
  for (const side of Object.keys(m.drawers) as Side[]) for (const id of m.drawers[side]) out.set(id, { kind: "drawer", side });
  for (const id of m.parked) out.set(id, { kind: "parked" });
  return out;
}

function pinned(m: DockoramaModel): Set<string> {
  const trees = [m.root, ...m.windows.map((w) => w.tree)];
  return new Set(trees.flatMap((t) => stacksOf(t).flatMap((s) => s.stack.pinned ?? [])));
}

function outside(m: DockoramaModel): Map<string, string> {
  const out = new Map<string, string>();
  for (const o of m.outside ?? []) for (const id of o.views) out.set(id, o.key);
  return out;
}

/** Collapsed split cells, keyed by the views inside them (stable across unrelated path changes). */
function folds(m: DockoramaModel): Map<string, FoldDetail> {
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
 * (the manager fires `dockorama-close` itself, so only real closes count).
 */
export function stateEvents(prev: DockoramaModel, next: DockoramaModel): StateEvent[] {
  if (prev === next) return [];
  const out: StateEvent[] = [];
  const a = spots(prev);
  const b = spots(next);
  for (const [id, now] of b) {
    const was = a.get(id) ?? { kind: "gone" };
    if (now.kind === "tree" && now.window && !(was.kind === "tree" && was.window)) out.push({ type: "dockorama-float", detail: { id, window: now.window } });
    if (now.kind === "tree" && !now.window && !(was.kind === "tree" && !was.window) && was.kind !== "gone") {
      const from: DockOrigin = was.kind === "tree" ? "floating" : was.kind === "drawer" ? "drawer" : "closed";
      out.push({ type: "dockorama-dock", detail: { id, from } });
    }
    if (now.kind === "drawer" && was.kind !== "drawer") out.push({ type: "dockorama-stow", detail: { id, side: now.side } });
    if (was.kind === "drawer" && now.kind !== "drawer") out.push({ type: "dockorama-unstow", detail: { id } });
  }
  for (const [id, was] of a) {
    if (b.has(id)) continue;
    if (was.kind === "drawer") out.push({ type: "dockorama-unstow", detail: { id } });
  }
  for (const id of Object.keys(prev.views)) if (!(id in next.views)) out.push({ type: "dockorama-viewremove", detail: { id } });

  const pa = pinned(prev);
  const pb = pinned(next);
  for (const id of pb) if (!pa.has(id)) out.push({ type: "dockorama-pin", detail: { id } });
  for (const id of pa) if (!pb.has(id) && id in next.views) out.push({ type: "dockorama-unpin", detail: { id } });

  const oa = outside(prev);
  const ob = outside(next);
  for (const [id, key] of ob) if (!oa.has(id)) out.push({ type: "dockorama-popout", detail: { id, window: key } });
  for (const id of oa.keys()) if (!ob.has(id)) out.push({ type: "dockorama-popin", detail: { id } });

  const fa = folds(prev);
  const fb = folds(next);
  for (const [k, d] of fb) if (!fa.has(k)) out.push({ type: "dockorama-collapse", detail: d });
  for (const [k, d] of fa) if (!fb.has(k)) out.push({ type: "dockorama-expand", detail: d });
  return out;
}

declare global {
  interface HTMLElementTagNameMap {
    "dockorama-manager": DockoramaManager;
  }
  interface HTMLElementEventMap {
    "dockorama-change": CustomEvent<{ model: DockoramaModel; reason: ChangeReason }>;
    "dockorama-focus": CustomEvent<{ id: string; previous?: string }>;
    "dockorama-viewshow": CustomEvent<{ id: string; first: boolean }>;
    "dockorama-beforeclose": CustomEvent<{ id: string }>;
    "dockorama-beforemove": CustomEvent<{ id: string; target?: string; zone: DropZone | EdgeZone | "between" }>;
    "dockorama-dragcancel": CustomEvent<{ id: string }>;
    "dockorama-dirty": CustomEvent<{ id: string; dirty: boolean }>;
    "dockorama-layoutissue": CustomEvent<{ source: LayoutSource; problems: string[]; fatal: boolean }>;
    "dockorama-transfer": CustomEvent<{ id: string; from: DockoramaManager; to: DockoramaManager; direction: "in" | "out" }>;
    "dockorama-viewhide": CustomEvent<{ id: string }>;
    "dockorama-close": CustomEvent<{ id: string }>;
    "dockorama-beforeadd": CustomEvent<BeforeAddDetail>;
    "dockorama-command": CustomEvent<CommandDetail>;
    "dockorama-dragstart": CustomEvent<{ id: string; kind: DragKind }>;
    "dockorama-dragover": CustomEvent<DragOverDetail>;
    "dockorama-drop": CustomEvent<DropDetail>;
    "dockorama-resize": CustomEvent<ResizeDetail>;
    "dockorama-resizing": CustomEvent<ResizeDetail>;
    "dockorama-float": CustomEvent<DockoramaStateEvents["dockorama-float"]>;
    "dockorama-dock": CustomEvent<DockoramaStateEvents["dockorama-dock"]>;
    "dockorama-stow": CustomEvent<DockoramaStateEvents["dockorama-stow"]>;
    "dockorama-unstow": CustomEvent<DockoramaStateEvents["dockorama-unstow"]>;
    "dockorama-pin": CustomEvent<DockoramaStateEvents["dockorama-pin"]>;
    "dockorama-unpin": CustomEvent<DockoramaStateEvents["dockorama-unpin"]>;
    "dockorama-popout": CustomEvent<DockoramaStateEvents["dockorama-popout"]>;
    "dockorama-popin": CustomEvent<DockoramaStateEvents["dockorama-popin"]>;
    "dockorama-collapse": CustomEvent<DockoramaStateEvents["dockorama-collapse"]>;
    "dockorama-expand": CustomEvent<DockoramaStateEvents["dockorama-expand"]>;
    "dockorama-viewremove": CustomEvent<DockoramaStateEvents["dockorama-viewremove"]>;
  }
}