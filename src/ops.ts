import type { ViewSpot, OutsideWindow, LayoutMigrations, SizeLimits,
  Box, DockNode, DropZone, EdgeZone, DockoramaModel, Side, SplitNode, StackNode, ViewInfo, Whereabouts
} from "./model.js";

const SIDES: Side[] = ["start", "end", "top", "bottom"];

/** Deep copy (models are plain JSON). */
export function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** An empty model. */
export function emptyModel(): DockoramaModel {
  return { v: 1, views: {}, root: null, windows: [], drawers: { start: [], end: [], top: [], bottom: [] }, parked: [] };
}

/** Builders for concise layout authoring. */
export const row = (children: DockNode[], weights?: number[]): SplitNode =>
  ({ kind: "split", axis: "row", children, weights: weights ?? children.map(() => 1) });
export const column = (children: DockNode[], weights?: number[]): SplitNode =>
  ({ kind: "split", axis: "column", children, weights: weights ?? children.map(() => 1) });
export const stack = (views: string[], current?: string): StackNode =>
  ({ kind: "stack", views, current: current ?? views[0] ?? "" });
export const docs = (views: string[], current?: string): StackNode => ({ ...stack(views, current), docs: true });

/** Create a model from a registry and a tree; fills in defaults and normalises. */
export function createModel(views: Record<string, ViewInfo>, root: DockNode | null, extra: Partial<DockoramaModel> = {}): DockoramaModel {
  return normalize({ ...emptyModel(), ...extra, views, root });
}

/** Every stack in a tree, depth first, with its path. */
export function stacksOf(node: DockNode | null, path: number[] = []): Array<{ stack: StackNode; path: number[] }> {
  if (!node) return [];
  if (node.kind === "stack") return [{ stack: node, path }];
  return node.children.flatMap((child, i) => stacksOf(child, [...path, i]));
}

/** View ids in a tree, in visual order. */
export function viewsIn(node: DockNode | null): string[] {
  return stacksOf(node).flatMap((s) => s.stack.views);
}

/** Find where a view is. */
export function locate(model: DockoramaModel, id: string): Whereabouts {
  for (const s of stacksOf(model.root)) if (s.stack.views.includes(id)) return { place: "tree", stack: s.stack, path: s.path };
  for (const w of model.windows) {
    for (const s of stacksOf(w.tree)) if (s.stack.views.includes(id)) return { place: "tree", window: w.key, stack: s.stack, path: s.path };
  }
  for (const side of SIDES) if (model.drawers[side].includes(id)) return { place: "drawer", side };
  if (model.parked.includes(id)) return { place: "parked" };
  return { place: "nowhere" };
}

/** Node at a path. */
export function nodeAt(node: DockNode | null, path: number[]): DockNode | null {
  let cur = node;
  for (const i of path) {
    if (!cur || cur.kind !== "split") return null;
    cur = cur.children[i] ?? null;
  }
  return cur;
}

/** Per-child extras of a split, kept aligned with `children`. */
const EXTRAS = ["fixed", "limits", "folded"] as const;
type Extra = (typeof EXTRAS)[number];
const blank: Record<Extra, null | false> = { fixed: null, limits: null, folded: false };

/** Rebuild a split's per-child extras for a new child list, given where each new child came from (old index or -1). */
function carryExtras(node: SplitNode, from: number[]): Partial<SplitNode> {
  const out: Partial<SplitNode> = {};
  for (const k of EXTRAS) {
    const arr = node[k] as unknown[] | undefined;
    if (!arr) continue;
    const next = from.map((i) => (i >= 0 ? (arr[i] ?? blank[k]) : blank[k]));
    if (next.some((v) => v !== null && v !== false)) (out as Record<string, unknown>)[k] = next;
  }
  return out;
}
function withoutExtras(node: SplitNode): SplitNode {
  const { fixed: _f, limits: _l, folded: _d, ...rest } = node;
  void _f; void _l; void _d;
  return rest;
}

/** Remove a view from a tree. Prunes empty non-document stacks and collapses single-child splits. */
function pluck(node: DockNode | null, id: string, keepEmpty: boolean): DockNode | null {
  return mapTree(node, (s) => {
    const idx = s.views.indexOf(id);
    if (idx < 0) return s;
    const views = s.views.filter((v) => v !== id);
    const current = s.current === id ? (views[Math.min(idx, views.length - 1)] ?? "") : s.current;
    if (!views.length && !s.docs && !keepEmpty) return null;
    return { ...s, views, current };
  });
}

/** Collapse single-child splits and flatten nested same-axis splits. */
function tidySplit(node: SplitNode): DockNode | null {
  if (!node.children.length) return null;
  if (node.children.length === 1) return node.children[0]!;
  if (!node.children.some((c) => c.kind === "split" && c.axis === node.axis)) return node;
  const children: DockNode[] = [];
  const weights: number[] = [];
  const extras: Record<Extra, unknown[]> = { fixed: [], limits: [], folded: [] };
  const at = (n: SplitNode, k: Extra, i: number) => (n[k] as unknown[] | undefined)?.[i] ?? blank[k];
  node.children.forEach((child, i) => {
    const w = node.weights[i] ?? 1;
    if (child.kind === "split" && child.axis === node.axis) {
      const total = child.weights.reduce((a, b) => a + b, 0) || 1;
      child.children.forEach((c, j) => {
        children.push(c);
        weights.push((w * (child.weights[j] ?? 1)) / total);
        for (const k of EXTRAS) extras[k].push(at(child, k, j));
      });
    } else {
      children.push(child);
      weights.push(w);
      for (const k of EXTRAS) extras[k].push(at(node, k, i));
    }
  });
  const out: SplitNode = { ...withoutExtras(node), children, weights };
  for (const k of EXTRAS) if (extras[k].some((v) => v !== null && v !== false)) (out as unknown as Record<string, unknown>)[k] = extras[k];
  return out;
}

/** Normalise a model: fix weights, drop unknown ids, tidy trees, remove empty windows. */
export function normalize(input: DockoramaModel): DockoramaModel {
  const m = copy(input);
  m.v = 1;
  m.windows ??= [];
  m.parked ??= [];
  const d: Partial<DockoramaModel["drawers"]> = m.drawers ?? {};
  m.drawers = { start: d.start ?? [], end: d.end ?? [], top: d.top ?? [], bottom: d.bottom ?? [] };
  const known = (id: string) => id in m.views;
  const seen = new Set<string>();
  /** True the first time a known view id is met (so each view is kept once). */
  const firstKnown = (v: string) => known(v) && !seen.has(v) && (seen.add(v), true);
  const fix = (node: DockNode | null): DockNode | null => {
    if (!node) return null;
    if (node.kind === "stack") {
      let views = node.views.filter(firstKnown);
      if (!views.length && !node.docs) return null;
      const out: StackNode = { ...node, views, current: views.includes(node.current) ? node.current : (views[0] ?? "") };
      if (node.preview && !views.includes(node.preview)) delete out.preview;
      if (node.pinned) {
        const pinned = views.filter((v) => node.pinned!.includes(v));
        views = [...pinned, ...views.filter((v) => !pinned.includes(v))];
        out.views = views;
        if (pinned.length) out.pinned = pinned;
        else delete out.pinned;
      }
      return out;
    }
    const children: DockNode[] = [];
    const weights: number[] = [];
    const from: number[] = [];
    node.children.forEach((c, i) => {
      const f = fix(c);
      if (f) {
        children.push(f);
        from.push(i);
        const w = node.weights?.[i];
        weights.push(typeof w === "number" && w > 0 ? w : 1);
      }
    });
    const clean: SplitNode = { ...withoutExtras(node), axis: node.axis === "column" ? "column" : "row", children, weights };
    const kept = carryExtras(node, from);
    if (kept.fixed) kept.fixed = kept.fixed.map((v) => (typeof v === "number" && v > 0 ? v : null));
    if (kept.folded) kept.folded = kept.folded.map(Boolean);
    return tidySplit({ ...clean, ...kept });
  };
  m.root = fix(m.root);
  m.windows = m.windows
    .map((w) => ({ ...w, tree: fix(w.tree) as DockNode }))
    .filter((w) => w.tree && viewsIn(w.tree).length > 0);
  for (const side of SIDES) m.drawers[side] = m.drawers[side].filter(firstKnown);
  m.parked = m.parked.filter(firstKnown);
  if (m.focus && !seen.has(m.focus)) delete m.focus;
  if (m.zoom && !seen.has(m.zoom)) delete m.zoom;
  if (m.outside) {
    const inTree = new Set([...viewsIn(m.root), ...m.windows.flatMap((w) => viewsIn(w.tree))]);
    const taken = new Set<string>();
    m.outside = m.outside
      .map((o) => {
        const views = (o.views ?? []).filter((v) => inTree.has(v) && !taken.has(v) && (taken.add(v), true));
        return { ...o, views, current: views.includes(o.current) ? o.current : (views[0] ?? "") };
      })
      .filter((o) => o.key && o.views.length);
    if (!m.outside.length) delete m.outside;
  }
  return m;
}

/** Take a view out of wherever it is (it stays registered). */
export function unplace(model: DockoramaModel, id: string, keepEmpty = false): DockoramaModel {
  const m = copy(model);
  m.root = pluck(m.root, id, keepEmpty);
  m.windows = m.windows
    .map((w) => ({ ...w, tree: pluck(w.tree, id, false) as DockNode }))
    .filter((w) => w.tree && viewsIn(w.tree).length > 0);
  for (const side of SIDES) m.drawers[side] = m.drawers[side].filter((v) => v !== id);
  m.parked = m.parked.filter((v) => v !== id);
  if (m.zoom === id) delete m.zoom;
  return m;
}

function mapTree(node: DockNode | null, fn: (s: StackNode) => DockNode | null): DockNode | null {
  if (!node) return null;
  if (node.kind === "stack") return fn(node);
  const mapped = node.children.map((c) => mapTree(c, fn));
  const from = mapped.flatMap((c, i) => (c ? [i] : []));
  return tidySplit({ ...withoutExtras(node), ...carryExtras(node, from), children: mapped.filter(Boolean) as DockNode[], weights: from.map((i) => node.weights[i] ?? 1) });
}

function insertBeside(target: StackNode, id: string, zone: Exclude<DropZone, "into">): DockNode {
  const fresh = stack([id]);
  const axis = zone === "left" || zone === "right" ? "row" : "column";
  const first = zone === "left" || zone === "above";
  return { kind: "split", axis, children: first ? [fresh, target] : [target, fresh], weights: [1, 1] };
}

/** Move a view next to (or into) the group holding `targetView`. */
export function place(model: DockoramaModel, id: string, targetView: string, zone: DropZone, index?: number): DockoramaModel {
  if (id === targetView && zone === "into") return model;
  const target = locate(model, targetView);
  if (target.place !== "tree") return model;
  const lone = target.stack.views.length === 1 && target.stack.views[0] === id;
  if (lone) return model;
  let m = unplace(model, id, true);
  let done = false;
  const apply = (s: StackNode): DockNode => {
    if (done || !s.views.includes(targetView)) return s;
    done = true;
    if (zone === "into") {
      const views = [...s.views];
      views.splice(index ?? views.length, 0, id);
      return { ...s, views, current: id };
    }
    return insertBeside(s, id, zone);
  };
  if (target.window) {
    m.windows = m.windows.map((w) => (w.key === target.window ? { ...w, tree: mapTree(w.tree, apply)! } : w));
  } else {
    m.root = mapTree(m.root, apply);
  }
  m = normalize(m);
  m.focus = id;
  return m;
}

/** Dock a view at an outer edge of the main layout. */
export function placeAtEdge(model: DockoramaModel, id: string, zone: EdgeZone, weight = 0.33): DockoramaModel {
  const m = unplace(model, id);
  const fresh = stack([id]);
  if (!m.root) {
    m.root = fresh;
  } else {
    const axis = zone === "edge-left" || zone === "edge-right" ? "row" : "column";
    const first = zone === "edge-left" || zone === "edge-above";
    const rest = 1 - weight;
    m.root = tidySplit({
      kind: "split", axis,
      children: first ? [fresh, m.root] : [m.root, fresh],
      weights: first ? [weight, rest] : [rest, weight]
    });
  }
  const out = normalize(m);
  out.focus = id;
  return out;
}

/** Float a view in a new window. */
export function detach(model: DockoramaModel, id: string, box: Box): DockoramaModel {
  const m = unplace(model, id);
  m.windows.push({ key: `w-${id}-${Date.now().toString(36)}`, box: { ...box }, tree: stack([id]) });
  m.focus = id;
  return normalize(m);
}

/** Move / resize a floating window. */
export function moveWindow(model: DockoramaModel, key: string, box: Box): DockoramaModel {
  const m = copy(model);
  m.windows = m.windows.map((w) => (w.key === key ? { ...w, box: { ...box } } : w));
  return m;
}

/** Bring a window to the front (last = topmost). */
export function raiseWindow(model: DockoramaModel, key: string): DockoramaModel {
  const w = model.windows.find((x) => x.key === key);
  if (!w || model.windows[model.windows.length - 1] === w) return model;
  const m = copy(model);
  m.windows = [...m.windows.filter((x) => x.key !== key), copy(w)];
  return m;
}

/** Guess which side a docked view should stow to. */
function sideFor(model: DockoramaModel, id: string): Side {
  const where = locate(model, id);
  if (where.place !== "tree" || where.window || !model.root || model.root.kind !== "split" || !where.path.length) return "start";
  const top = where.path[0]!;
  const half = (model.root.children.length - 1) / 2;
  if (model.root.axis === "row") return top <= half ? "start" : "end";
  return top <= half ? "top" : "bottom";
}

/** Auto-hide a view into an edge drawer. Views in windows or document areas cannot be stowed. */
export function stow(model: DockoramaModel, id: string, side?: Side): DockoramaModel {
  const where = locate(model, id);
  if (where.place !== "tree" || where.window || where.stack.docs) return model;
  const s = side ?? sideFor(model, id);
  const m = unplace(model, id);
  m.drawers[s] = [...m.drawers[s], id];
  if (m.focus === id) delete m.focus;
  return normalize(m);
}

const EDGE_OF: Record<Side, EdgeZone> = { start: "edge-left", end: "edge-right", top: "edge-above", bottom: "edge-below" };

/** Put a stowed view back into the main layout on its side. */
export function unstow(model: DockoramaModel, id: string): DockoramaModel {
  const where = locate(model, id);
  if (where.place !== "drawer") return model;
  return placeAtEdge(model, id, EDGE_OF[where.side], 0.25);
}

/** Close a view, keeping it registered (it can be revealed again). */
export function dismiss(model: DockoramaModel, id: string): DockoramaModel {
  const where = locate(model, id);
  const siblings = where.place === "tree" ? where.stack.views.filter((v) => v !== id) : [];
  const m = unplace(model, id);
  if (!m.parked.includes(id)) m.parked.push(id);
  const wasFocused = m.focus === id;
  if (wasFocused) delete m.focus;
  const out = normalize(m);
  if (wasFocused) {
    // Hand focus to what the user now sees: the group's new current tab, else the first group left on screen.
    const trees = [out.root, ...out.windows.map((w) => w.tree)];
    const groups = trees.flatMap((t) => stacksOf(t)).map((x) => x.stack);
    const next = groups.find((g) => g.views.some((v) => siblings.includes(v))) ?? groups.find((g) => g.views.length);
    if (next?.current) out.focus = next.current;
  }
  return out;
}

/** Close and forget a view entirely. */
export function forget(model: DockoramaModel, id: string): DockoramaModel {
  const m = unplace(model, id);
  delete m.views[id];
  return normalize(m);
}

/** Make a view visible: select its tab, or bring it back from parked/drawer. */
export function reveal(model: DockoramaModel, id: string): DockoramaModel {
  const where = locate(model, id);
  if (where.place === "tree") return select(model, id);
  if (where.place === "drawer") return unstow(model, id);
  if (!(id in model.views)) return model;
  const docArea = stacksOf(model.root).find((s) => s.stack.docs);
  const m = unplace(model, id);
  if (docArea && docArea.stack.views.length) return place(m, id, docArea.stack.views[0]!, "into");
  if (docArea) {
    m.root = mapTree(m.root, (s) => (s.docs && !s.views.length ? { ...s, views: [id], current: id } : s));
    m.focus = id;
    return normalize(m);
  }
  return placeAtEdge(m, id, "edge-right", 0.3);
}

/** Select a tab (and focus it). */
export function select(model: DockoramaModel, id: string): DockoramaModel {
  const apply = (s: StackNode): DockNode => (s.views.includes(id) ? { ...s, current: id } : s);
  const m = mapStacks(model, apply);
  m.focus = id;
  return m;
}

/** Reorder a tab inside its own group. */
export function reorder(model: DockoramaModel, id: string, index: number): DockoramaModel {
  const apply = (s: StackNode): DockNode => {
    if (!s.views.includes(id)) return s;
    const views = s.views.filter((v) => v !== id);
    views.splice(Math.max(0, Math.min(index, views.length)), 0, id);
    return { ...s, views };
  };
  return normalize(mapStacks(model, apply));
}

/** Set the weights of the split at `path` (in the root, or in a window). */
export function setWeights(model: DockoramaModel, path: number[], weights: number[], windowKey?: string): DockoramaModel {
  const m = copy(model);
  const tree = windowKey ? m.windows.find((w) => w.key === windowKey)?.tree ?? null : m.root;
  const node = nodeAt(tree, path);
  if (node?.kind === "split" && weights.length === node.children.length && weights.every((w) => w > 0)) node.weights = [...weights];
  return m;
}

/** Toggle zoom (maximise) of a view's group. */
export function toggleZoom(model: DockoramaModel, id?: string): DockoramaModel {
  const m = copy(model);
  if (!id || m.zoom) delete m.zoom;
  else if (locate(m, id).place === "tree") m.zoom = id;
  return m;
}

/** Register a view and place it (next to `near`, in the docs area, or at the right edge). */
export function addView(model: DockoramaModel, id: string, info: ViewInfo, near?: { view: string; zone: DropZone }): DockoramaModel {
  const m = copy(model);
  m.views[id] = { ...info };
  m.parked = m.parked.filter((v) => v !== id);
  if (near && locate(m, near.view).place === "tree") return place(m, id, near.view, near.zone);
  return reveal(m, id);
}

/**
 * Register a new view and put it at `spot`, as one change. Throws when `id` is taken, the `near`
 * target is not in the layout, or `"docs"` is asked for without a document area.
 * A `float` spot needs a complete box here (the element fills in defaults).
 */
export function enlist(model: DockoramaModel, id: string, info: ViewInfo, spot: Exclude<ViewSpot, { float: Partial<Box> | true }> | { float: Box } = "auto"): DockoramaModel {
  if (!id) throw new TypeError("dockorama: a view needs a non-empty id");
  if (id in model.views) throw new Error(`dockorama: a view with id "${id}" already exists`);
  if (typeof spot === "object" && "near" in spot && locate(model, spot.near).place !== "tree") {
    throw new Error(`dockorama: cannot place "${id}" near "${spot.near}": that view is not in the layout`);
  }
  if (spot === "docs" && !stacksOf(model.root).some((s) => s.stack.docs)) {
    throw new Error(`dockorama: cannot place "${id}" in the document area: the layout has none`);
  }
  const m = copy(model);
  m.views[id] = { ...info };
  if (spot === "parked") {
    m.parked.push(id);
    return m;
  }
  if (spot === "auto" || spot === "docs") return reveal(m, id);
  if ("near" in spot) return place(m, id, spot.near, spot.zone ?? "into", spot.index);
  if ("edge" in spot) return placeAtEdge(m, id, spot.edge, spot.weight);
  if ("float" in spot) return detach(m, id, spot.float);
  const out = normalize(m);
  out.drawers[spot.stow] = [...out.drawers[spot.stow], id];
  return out;
}

/** Every registered view with a short description of its location. */
export function catalogue(model: DockoramaModel): Array<{ id: string; info: ViewInfo; where: Whereabouts["place"] }> {
  return Object.entries(model.views).map(([id, info]) => ({ id, info, where: locate(model, id).place }));
}

/** Basic structural validation for untrusted (e.g. persisted) models. */
export function isModel(value: unknown): value is DockoramaModel {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<DockoramaModel>;
  return m.v === 1 && typeof m.views === "object" && m.views !== null && Array.isArray(m.windows ?? []);
}

function treeOf(m: DockoramaModel, windowKey?: string): DockNode | null {
  return windowKey ? m.windows.find((w) => w.key === windowKey)?.tree ?? null : m.root;
}

/**
 * Insert a view as a new group between two siblings of the split at `path`
 * (a drop onto the gutter that follows child `after`).
 */
export function insertBetween(model: DockoramaModel, id: string, path: number[], after: number, windowKey?: string): DockoramaModel {
  const split = nodeAt(treeOf(model, windowKey), path);
  if (split?.kind !== "split" || after < 0 || after >= split.children.length - 1) return model;
  // Mark the split so it can be found again after the view is taken out.
  const marked = copy(model);
  const ms = nodeAt(treeOf(marked, windowKey), path) as SplitNode & { __mark?: true };
  ms.__mark = true;
  const neighbours = [ms.children[after]!, ms.children[after + 1]!].map((c) => viewsIn(c));
  if (neighbours.some((v) => v.length === 1 && v[0] === id)) return model;
  const m = unplace(marked, id, true);
  const find = (n: DockNode | null): (SplitNode & { __mark?: true }) | undefined => {
    if (!n || n.kind !== "split") return undefined;
    if ((n as SplitNode & { __mark?: true }).__mark) return n;
    for (const c of n.children) { const f = find(c); if (f) return f; }
    return undefined;
  };
  const roots = windowKey ? m.windows.filter((w) => w.key === windowKey).map((w) => w.tree) : [m.root];
  const target = roots.map(find).find(Boolean);
  if (!target) return model;
  delete target.__mark;
  // The split may have lost a child that held only the dragged view: locate the gutter by neighbour content.
  const leftViews = neighbours[0]!.filter((v) => v !== id);
  let at = target.children.findIndex((c) => leftViews.length && viewsIn(c).some((v) => leftViews.includes(v)));
  at = at < 0 ? 0 : at + 1;
  const ws = target.weights;
  const share = ((ws[Math.max(0, at - 1)] ?? 1) + (ws[at] ?? ws[at - 1] ?? 1)) / 4;
  if (at > 0) ws[at - 1] = Math.max(0.01, (ws[at - 1] ?? 1) - share / 2);
  if (at < ws.length) ws[at] = Math.max(0.01, (ws[at] ?? 1) - share / 2);
  target.children.splice(at, 0, stack([id]));
  ws.splice(at, 0, share);
  for (const k of EXTRAS) (target[k] as unknown[] | undefined)?.splice(at, 0, blank[k]);
  const out = normalize(m);
  out.focus = id;
  return out;
}

/** Put a view into an empty document area at `path` (in the root, or a window). */
export function fillDocs(model: DockoramaModel, id: string, path: number[], windowKey?: string): DockoramaModel {
  const area = nodeAt(treeOf(model, windowKey), path);
  if (area?.kind !== "stack" || !area.docs) return model;
  const marked = copy(model);
  (nodeAt(treeOf(marked, windowKey), path) as StackNode & { __mark?: true }).__mark = true;
  const m = unplace(marked, id, true);
  const fill = (s: StackNode): DockNode => {
    const t = s as StackNode & { __mark?: true };
    if (!t.__mark) return s;
    const { __mark: _drop, ...rest } = t;
    void _drop;
    return { ...rest, views: [...rest.views.filter((v) => v !== id), id], current: id };
  };
  if (windowKey) m.windows = m.windows.map((w) => (w.key === windowKey ? { ...w, tree: mapTree(w.tree, fill)! } : w));
  else m.root = mapTree(m.root, fill);
  const out = normalize(m);
  out.focus = id;
  return out;
}


/** Pin or unpin a view in its group (pinned views sit first, in pin order). */
export function pin(model: DockoramaModel, id: string, on = true): DockoramaModel {
  const where = locate(model, id);
  if (where.place !== "tree") return model;
  const has = where.stack.pinned?.includes(id) ?? false;
  if (has === on) return model;
  const apply = (s: StackNode): DockNode => {
    if (!s.views.includes(id)) return s;
    const pinned = on ? [...(s.pinned ?? []), id] : (s.pinned ?? []).filter((v) => v !== id);
    return { ...s, pinned };
  };
  return normalize(mapStacks(model, apply));
}

/** The outside (browser) window holding a view's content, if any. */
export function outsideOf(model: DockoramaModel, id: string): OutsideWindow | undefined {
  return model.outside?.find((o) => o.views.includes(id));
}

/** Record that a view's content is in an outside window `key` (created when new). */
export function goOutside(model: DockoramaModel, id: string, key: string, box?: Box): DockoramaModel {
  if (locate(model, id).place !== "tree") return model;
  const m = copy(model);
  const list = (m.outside ?? []).map((o) => ({ ...o, views: o.views.filter((v) => v !== id) }));
  const target = list.find((o) => o.key === key);
  if (target) {
    target.views.push(id);
    target.current = id;
    if (box) target.box = { ...box };
  } else {
    list.push({ key, views: [id], current: id, ...(box ? { box: { ...box } } : {}) });
  }
  m.outside = list;
  return normalize(m);
}

/** Bring a view's content back from its outside window. */
export function comeInside(model: DockoramaModel, id: string): DockoramaModel {
  if (!outsideOf(model, id)) return model;
  const m = copy(model);
  m.outside = m.outside!.map((o) => ({ ...o, views: o.views.filter((v) => v !== id) }));
  return normalize(m);
}

/** Set the selected view or box of an outside window. */
export function tuneOutside(model: DockoramaModel, key: string, change: { current?: string; box?: Box }): DockoramaModel {
  const m = copy(model);
  m.outside = (m.outside ?? []).map((o) => (o.key === key
    ? { ...o, ...(change.current && o.views.includes(change.current) ? { current: change.current } : {}), ...(change.box ? { box: { ...change.box } } : {}) }
    : o));
  return normalize(m);
}

/** Register a view coming from another manager as parked (place it afterwards). Throws if the id is taken. */
export function adopt(model: DockoramaModel, id: string, info: ViewInfo): DockoramaModel {
  if (id in model.views) throw new Error(`dockorama: a view with id "${id}" already exists`);
  const m = copy(model);
  m.views[id] = copy(info);
  m.parked.push(id);
  return m;
}

/** Which views a "close …" command covers, relative to `id` in its group. */
export function closeSet(model: DockoramaModel, id: string, which: "others" | "right" | "all"): string[] {
  const where = locate(model, id);
  if (where.place !== "tree") return [];
  const views = where.stack.views;
  const pinned = where.stack.pinned ?? [];
  const pick = which === "all" ? views : which === "others" ? views.filter((v) => v !== id) : views.slice(views.indexOf(id) + 1);
  return pick.filter((v) => !pinned.includes(v));
}

function mapStacks(model: DockoramaModel, fn: (s: StackNode) => DockNode): DockoramaModel {
  const m = copy(model);
  m.root = mapTree(m.root, fn);
  m.windows = m.windows.map((w) => ({ ...w, tree: mapTree(w.tree, fn)! }));
  return m;
}

/** Make a view its group's preview tab; returns the model and the preview it replaced (now closed), if any. */
export function setPreview(model: DockoramaModel, id: string): { model: DockoramaModel; replaced?: string } {
  const where = locate(model, id);
  if (where.place !== "tree") return { model };
  const old = where.stack.preview;
  let m = mapStacks(model, (s) => (s.views.includes(id) ? { ...s, preview: id } : s));
  if (old && old !== id) m = dismiss(m, old);
  return { model: normalize(m), replaced: old && old !== id ? old : undefined };
}

/** Keep a preview tab (it is no longer replaced). */
export function promote(model: DockoramaModel, id: string): DockoramaModel {
  const where = locate(model, id);
  if (where.place !== "tree" || where.stack.preview !== id) return model;
  return mapStacks(model, (s) => {
    if (s.preview !== id) return s;
    const { preview: _p, ...rest } = s;
    void _p;
    return rest;
  });
}

/** The preview view of the group holding `id` (or of the first document area), if any. */
export function previewOf(model: DockoramaModel, id?: string): string | undefined {
  if (id) {
    const where = locate(model, id);
    return where.place === "tree" ? where.stack.preview : undefined;
  }
  return stacksOf(model.root).find((s) => s.stack.docs)?.stack.preview;
}

/**
 * Upgrade a saved model to `target` with `migrations` (`migrations[n]` upgrades n → n + 1). Throws when a step is
 * missing, a step does not return a model, or the model is newer than `target`.
 */
export function upgrade(model: DockoramaModel, migrations: LayoutMigrations, target: number): DockoramaModel {
  let m = copy(model);
  let at = m.version ?? 0;
  if (at > target) throw new Error(`dockorama: saved layout version ${at} is newer than ${target}`);
  while (at < target) {
    const step = migrations[at];
    if (!step) throw new Error(`dockorama: no migration from layout version ${at}`);
    const next = step(copy(m));
    if (!isModel(next)) throw new Error(`dockorama: migration from version ${at} did not return a layout model`);
    at += 1;
    m = { ...next, version: at };
  }
  return m;
}

/** Problems normalising would silently fix: unknown or repeated ids, bad weights, dangling focus. Empty = clean. */
export function validate(value: unknown): string[] {
  if (!isModel(value)) return ["not a layout model (needs v: 1, views and windows)"];
  const m = value;
  const out: string[] = [];
  const seen = new Set<string>();
  const known = (id: string, where: string) => {
    if (!(id in m.views)) out.push(`unknown view "${id}" in ${where}`);
    else if (seen.has(id)) out.push(`view "${id}" is placed more than once`);
    seen.add(id);
  };
  const walk = (n: DockNode | null | undefined, where: string): void => {
    if (!n) return;
    if (n.kind === "stack") {
      for (const v of n.views ?? []) known(v, where);
      return;
    }
    if (n.kind !== "split" || !Array.isArray(n.children)) {
      out.push(`bad node in ${where}`);
      return;
    }
    if (!Array.isArray(n.weights) || n.weights.length !== n.children.length || n.weights.some((w) => !(w > 0))) out.push(`bad weights in ${where}`);
    n.children.forEach((c) => walk(c, where));
  };
  walk(m.root, "root");
  for (const w of m.windows ?? []) walk(w.tree, `window "${w.key}"`);
  for (const side of SIDES) for (const v of m.drawers?.[side] ?? []) known(v, `drawer ${side}`);
  for (const v of m.parked ?? []) known(v, "parked");
  if (m.focus && !seen.has(m.focus)) out.push(`focus "${m.focus}" is not placed`);
  return out;
}

/** The split holding the group of view `id` and the group's index in it, or undefined at the top of a tree. */
export function cellOf(model: DockoramaModel, id: string): { path: number[]; index: number; win?: string; split: SplitNode } | undefined {
  const where = locate(model, id);
  if (where.place !== "tree" || !where.path.length) return undefined;
  const path = where.path.slice(0, -1);
  const split = nodeAt(treeOf(model, where.window), path);
  if (split?.kind !== "split") return undefined;
  return { path, index: where.path[where.path.length - 1]!, win: where.window, split };
}

function setExtra<K extends Extra>(model: DockoramaModel, path: number[], index: number, key: K, value: NonNullable<SplitNode[K]>[number], windowKey?: string): DockoramaModel {
  const m = copy(model);
  const node = nodeAt(treeOf(m, windowKey), path);
  if (node?.kind !== "split" || index < 0 || index >= node.children.length) return model;
  const arr = ((node[key] as unknown[] | undefined) ?? node.children.map(() => blank[key])).slice();
  arr[index] = value;
  if (arr.some((v) => v !== null && v !== false)) (node as unknown as Record<string, unknown>)[key] = arr;
  else delete node[key];
  return m;
}

/** Give child `index` of the split at `path` a fixed px size (null: share space by weight again). */
export function fixSize(model: DockoramaModel, path: number[], index: number, px: number | null, windowKey?: string): DockoramaModel {
  return setExtra(model, path, index, "fixed", px !== null && px > 0 ? Math.round(px) : null, windowKey);
}

/** Set px bounds for child `index` of the split at `path` (null: none). */
export function limitSize(model: DockoramaModel, path: number[], index: number, limits: SizeLimits | null, windowKey?: string): DockoramaModel {
  const ok = limits && (limits.min !== undefined || limits.max !== undefined) ? { ...limits } : null;
  return setExtra(model, path, index, "limits", ok, windowKey);
}

/** Collapse (or restore) child `index` of the split at `path`. At least one child always stays open. */
export function fold(model: DockoramaModel, path: number[], index: number, on = true, windowKey?: string): DockoramaModel {
  const node = nodeAt(treeOf(model, windowKey), path);
  if (node?.kind !== "split") return model;
  const open = node.children.filter((_, i) => !node.folded?.[i] && i !== index).length;
  if (on && open === 0) return model;
  return setExtra(model, path, index, "folded", on, windowKey);
}

/**
 * Resize two neighbours of the split at `path` to px sizes (from a gutter drag). Every child's weight becomes its
 * px size, fixed children keep their new px, and both sizes are clamped to their limits first.
 */
export function resizeCells(model: DockoramaModel, path: number[], sizes: number[], windowKey?: string): DockoramaModel {
  const m = copy(model);
  const node = nodeAt(treeOf(m, windowKey), path);
  if (node?.kind !== "split" || sizes.length !== node.children.length) return model;
  node.weights = sizes.map((v) => Math.max(1, v));
  if (node.fixed) node.fixed = node.fixed.map((f, i) => (f === null ? null : Math.max(1, Math.round(sizes[i] ?? f))));
  return m;
}

/** Clamp a pair of neighbouring sizes to their limits, keeping their sum. */
export function clampPair(a: number, b: number, la?: SizeLimits | null, lb?: SizeLimits | null): [number, number] {
  const total = a + b;
  const lo = Math.max(la?.min ?? 0, total - (lb?.max ?? Infinity));
  const hi = Math.min(la?.max ?? Infinity, total - (lb?.min ?? 0));
  const na = hi < lo ? a : Math.min(hi, Math.max(lo, a));
  return [na, total - na];
}
