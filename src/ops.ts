import type { ViewSpot,
  Box, DockNode, DropZone, EdgeZone, FlexdockModel, Side, SplitNode, StackNode, ViewInfo, Whereabouts
} from "./model.js";

export const SIDES: Side[] = ["start", "end", "top", "bottom"];

/** Deep copy (models are plain JSON). */
export function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** An empty model. */
export function emptyModel(): FlexdockModel {
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
export function createModel(views: Record<string, ViewInfo>, root: DockNode | null, extra: Partial<FlexdockModel> = {}): FlexdockModel {
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
export function locate(model: FlexdockModel, id: string): Whereabouts {
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

/** Remove a view from a tree. Prunes empty non-document stacks and collapses single-child splits. */
function pluck(node: DockNode | null, id: string, keepEmpty: boolean): DockNode | null {
  if (!node) return null;
  if (node.kind === "stack") {
    if (!node.views.includes(id)) return node;
    const idx = node.views.indexOf(id);
    const views = node.views.filter((v) => v !== id);
    const current = node.current === id ? (views[Math.min(idx, views.length - 1)] ?? "") : node.current;
    if (!views.length && !node.docs && !keepEmpty) return null;
    return { ...node, views, current };
  }
  const children: DockNode[] = [];
  const weights: number[] = [];
  node.children.forEach((child, i) => {
    const next = pluck(child, id, keepEmpty);
    if (next) {
      children.push(next);
      weights.push(node.weights[i] ?? 1);
    }
  });
  return tidySplit({ ...node, children, weights });
}

/** Collapse single-child splits and flatten nested same-axis splits. */
function tidySplit(node: SplitNode): DockNode | null {
  if (!node.children.length) return null;
  if (node.children.length === 1) return node.children[0]!;
  const children: DockNode[] = [];
  const weights: number[] = [];
  node.children.forEach((child, i) => {
    const w = node.weights[i] ?? 1;
    if (child.kind === "split" && child.axis === node.axis) {
      const total = child.weights.reduce((a, b) => a + b, 0) || 1;
      child.children.forEach((c, j) => {
        children.push(c);
        weights.push((w * (child.weights[j] ?? 1)) / total);
      });
    } else {
      children.push(child);
      weights.push(w);
    }
  });
  return { ...node, children, weights };
}

/** Normalise a model: fix weights, drop unknown ids, tidy trees, remove empty windows. */
export function normalize(input: FlexdockModel): FlexdockModel {
  const m = copy(input);
  m.v = 1;
  m.windows ??= [];
  m.parked ??= [];
  const d: Partial<FlexdockModel["drawers"]> = m.drawers ?? {};
  m.drawers = { start: d.start ?? [], end: d.end ?? [], top: d.top ?? [], bottom: d.bottom ?? [] };
  const known = (id: string) => id in m.views;
  const seen = new Set<string>();
  const fix = (node: DockNode | null): DockNode | null => {
    if (!node) return null;
    if (node.kind === "stack") {
      const views = node.views.filter((v) => known(v) && !seen.has(v) && (seen.add(v), true));
      if (!views.length && !node.docs) return null;
      return { ...node, views, current: views.includes(node.current) ? node.current : (views[0] ?? "") };
    }
    const children: DockNode[] = [];
    const weights: number[] = [];
    node.children.forEach((c, i) => {
      const f = fix(c);
      if (f) {
        children.push(f);
        const w = node.weights?.[i];
        weights.push(typeof w === "number" && w > 0 ? w : 1);
      }
    });
    return tidySplit({ ...node, axis: node.axis === "column" ? "column" : "row", children, weights });
  };
  m.root = fix(m.root);
  m.windows = m.windows
    .map((w) => ({ ...w, tree: fix(w.tree) as DockNode }))
    .filter((w) => w.tree && viewsIn(w.tree).length > 0);
  for (const side of SIDES) m.drawers[side] = m.drawers[side].filter((v) => known(v) && !seen.has(v) && (seen.add(v), true));
  m.parked = m.parked.filter((v) => known(v) && !seen.has(v) && (seen.add(v), true));
  if (m.focus && !seen.has(m.focus)) delete m.focus;
  if (m.zoom && !seen.has(m.zoom)) delete m.zoom;
  return m;
}

/** Take a view out of wherever it is (it stays registered). */
export function unplace(model: FlexdockModel, id: string, keepEmpty = false): FlexdockModel {
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

function mapTree(node: DockNode | null, fn: (s: StackNode) => DockNode): DockNode | null {
  if (!node) return null;
  if (node.kind === "stack") return fn(node);
  return tidySplit({ ...node, children: node.children.map((c) => mapTree(c, fn)!).filter(Boolean) });
}

function insertBeside(target: StackNode, id: string, zone: Exclude<DropZone, "into">): DockNode {
  const fresh = stack([id]);
  const axis = zone === "left" || zone === "right" ? "row" : "column";
  const first = zone === "left" || zone === "above";
  return { kind: "split", axis, children: first ? [fresh, target] : [target, fresh], weights: [1, 1] };
}

/** Move a view next to (or into) the group holding `targetView`. */
export function place(model: FlexdockModel, id: string, targetView: string, zone: DropZone, index?: number): FlexdockModel {
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
export function placeAtEdge(model: FlexdockModel, id: string, zone: EdgeZone, weight = 0.33): FlexdockModel {
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
export function detach(model: FlexdockModel, id: string, box: Box): FlexdockModel {
  const m = unplace(model, id);
  m.windows.push({ key: `w-${id}-${Date.now().toString(36)}`, box: { ...box }, tree: stack([id]) });
  m.focus = id;
  return normalize(m);
}

/** Move / resize a floating window. */
export function moveWindow(model: FlexdockModel, key: string, box: Box): FlexdockModel {
  const m = copy(model);
  m.windows = m.windows.map((w) => (w.key === key ? { ...w, box: { ...box } } : w));
  return m;
}

/** Bring a window to the front (last = topmost). */
export function raiseWindow(model: FlexdockModel, key: string): FlexdockModel {
  const w = model.windows.find((x) => x.key === key);
  if (!w || model.windows[model.windows.length - 1] === w) return model;
  const m = copy(model);
  m.windows = [...m.windows.filter((x) => x.key !== key), copy(w)];
  return m;
}

/** Guess which side a docked view should stow to. */
export function sideFor(model: FlexdockModel, id: string): Side {
  const where = locate(model, id);
  if (where.place !== "tree" || where.window || !model.root || model.root.kind !== "split" || !where.path.length) return "start";
  const top = where.path[0]!;
  const half = (model.root.children.length - 1) / 2;
  if (model.root.axis === "row") return top <= half ? "start" : "end";
  return top <= half ? "top" : "bottom";
}

/** Auto-hide a view into an edge drawer. Views in windows or document areas cannot be stowed. */
export function stow(model: FlexdockModel, id: string, side?: Side): FlexdockModel {
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
export function unstow(model: FlexdockModel, id: string): FlexdockModel {
  const where = locate(model, id);
  if (where.place !== "drawer") return model;
  return placeAtEdge(model, id, EDGE_OF[where.side], 0.25);
}

/** Close a view, keeping it registered (it can be revealed again). */
export function dismiss(model: FlexdockModel, id: string): FlexdockModel {
  const m = unplace(model, id);
  if (!m.parked.includes(id)) m.parked.push(id);
  if (m.focus === id) delete m.focus;
  return normalize(m);
}

/** Close and forget a view entirely. */
export function forget(model: FlexdockModel, id: string): FlexdockModel {
  const m = unplace(model, id);
  delete m.views[id];
  return normalize(m);
}

/** Make a view visible: select its tab, or bring it back from parked/drawer. */
export function reveal(model: FlexdockModel, id: string): FlexdockModel {
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
export function select(model: FlexdockModel, id: string): FlexdockModel {
  const m = copy(model);
  const apply = (s: StackNode): DockNode => (s.views.includes(id) ? { ...s, current: id } : s);
  m.root = mapTree(m.root, apply);
  m.windows = m.windows.map((w) => ({ ...w, tree: mapTree(w.tree, apply)! }));
  m.focus = id;
  return m;
}

/** Reorder a tab inside its own group. */
export function reorder(model: FlexdockModel, id: string, index: number): FlexdockModel {
  const m = copy(model);
  const apply = (s: StackNode): DockNode => {
    if (!s.views.includes(id)) return s;
    const views = s.views.filter((v) => v !== id);
    views.splice(Math.max(0, Math.min(index, views.length)), 0, id);
    return { ...s, views };
  };
  m.root = mapTree(m.root, apply);
  m.windows = m.windows.map((w) => ({ ...w, tree: mapTree(w.tree, apply)! }));
  return m;
}

/** Set the weights of the split at `path` (in the root, or in a window). */
export function setWeights(model: FlexdockModel, path: number[], weights: number[], windowKey?: string): FlexdockModel {
  const m = copy(model);
  const tree = windowKey ? m.windows.find((w) => w.key === windowKey)?.tree ?? null : m.root;
  const node = nodeAt(tree, path);
  if (node?.kind === "split" && weights.length === node.children.length && weights.every((w) => w > 0)) node.weights = [...weights];
  return m;
}

/** Toggle zoom (maximise) of a view's group. */
export function toggleZoom(model: FlexdockModel, id?: string): FlexdockModel {
  const m = copy(model);
  if (!id || m.zoom) delete m.zoom;
  else if (locate(m, id).place === "tree") m.zoom = id;
  return m;
}

/** Register a view and place it (next to `near`, in the docs area, or at the right edge). */
export function addView(model: FlexdockModel, id: string, info: ViewInfo, near?: { view: string; zone: DropZone }): FlexdockModel {
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
export function enlist(model: FlexdockModel, id: string, info: ViewInfo, spot: Exclude<ViewSpot, { float: Partial<Box> | true }> | { float: Box } = "auto"): FlexdockModel {
  if (!id) throw new TypeError("flexdock: a view needs a non-empty id");
  if (id in model.views) throw new Error(`flexdock: a view with id "${id}" already exists`);
  if (typeof spot === "object" && "near" in spot && locate(model, spot.near).place !== "tree") {
    throw new Error(`flexdock: cannot place "${id}" near "${spot.near}": that view is not in the layout`);
  }
  if (spot === "docs" && !stacksOf(model.root).some((s) => s.stack.docs)) {
    throw new Error(`flexdock: cannot place "${id}" in the document area: the layout has none`);
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
export function catalogue(model: FlexdockModel): Array<{ id: string; info: ViewInfo; where: Whereabouts["place"] }> {
  return Object.entries(model.views).map(([id, info]) => ({ id, info, where: locate(model, id).place }));
}

/** Basic structural validation for untrusted (e.g. persisted) models. */
export function isModel(value: unknown): value is FlexdockModel {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<FlexdockModel>;
  return m.v === 1 && typeof m.views === "object" && m.views !== null && Array.isArray(m.windows ?? []);
}

function treeOf(m: FlexdockModel, windowKey?: string): DockNode | null {
  return windowKey ? m.windows.find((w) => w.key === windowKey)?.tree ?? null : m.root;
}

/**
 * Insert a view as a new group between two siblings of the split at `path`
 * (a drop onto the gutter that follows child `after`).
 */
export function insertBetween(model: FlexdockModel, id: string, path: number[], after: number, windowKey?: string): FlexdockModel {
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
  const out = normalize(m);
  out.focus = id;
  return out;
}

/** Put a view into an empty document area at `path` (in the root, or a window). */
export function fillDocs(model: FlexdockModel, id: string, path: number[], windowKey?: string): FlexdockModel {
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

