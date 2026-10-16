import { describe, expect, it } from "vitest";
import * as o from "./ops.js";
import type { DockoramaModel, SplitNode } from "./model.js";

const views = Object.fromEntries(["a", "b", "c", "d", "e"].map((id) => [id, { title: id.toUpperCase() }]));
const base = (): DockoramaModel =>
  o.createModel(views, o.row([o.stack(["a"]), o.docs(["b", "c"]), o.column([o.stack(["d"]), o.stack(["e"])])], [1, 2, 1]));

describe("createModel / normalize", () => {
  it("fills defaults", () => {
    const m = base();
    expect(m.windows).toEqual([]);
    expect(m.drawers).toEqual({ start: [], end: [], top: [], bottom: [] });
    expect(o.viewsIn(m.root)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("drops unknown and duplicate ids, fixes weights and current", () => {
    const m = o.normalize({
      ...o.emptyModel(), views,
      root: { kind: "split", axis: "row", weights: [0], children: [{ kind: "stack", views: ["a", "zz", "a"], current: "zz" }, o.stack(["b"])] },
      drawers: { start: ["a", "c"], end: [], top: [], bottom: [] }, parked: ["q"], focus: "zz", zoom: "q"
    } as DockoramaModel);
    const r = m.root as SplitNode;
    expect(r.weights).toEqual([1, 1]);
    expect(r.children[0]).toMatchObject({ views: ["a"], current: "a" });
    expect(m.drawers.start).toEqual(["c"]);
    expect(m.parked).toEqual([]);
    expect(m.focus).toBeUndefined();
    expect(m.zoom).toBeUndefined();
  });
  it("collapses single-child splits and flattens same-axis nesting", () => {
    const m = o.createModel(views, o.row([o.row([o.stack(["a"]), o.stack(["b"])], [1, 3]), o.column([o.stack(["c"])])], [2, 2]));
    const r = m.root as SplitNode;
    expect(r.children).toHaveLength(3);
    expect(r.weights).toEqual([0.5, 1.5, 2]);
    expect(r.children[2]).toMatchObject({ kind: "stack", views: ["c"] });
  });
  it("handles missing optional fields and wrong axis", () => {
    const m = o.normalize({ v: 1, views, root: { kind: "split", axis: "diag", children: [o.stack(["a"]), o.stack(["b"])] } } as unknown as DockoramaModel);
    expect((m.root as SplitNode).axis).toBe("row");
    expect(m.parked).toEqual([]);
  });
  it("isModel validates", () => {
    expect(o.isModel(base())).toBe(true);
    expect(o.isModel(null)).toBe(false);
    expect(o.isModel({ v: 2, views: {} })).toBe(false);
  });
});

describe("locate / nodeAt / catalogue", () => {
  it("finds views everywhere", () => {
    let m = o.detach(base(), "e", { x: 1, y: 2, w: 3, h: 4 });
    m = o.stow(m, "a", "start");
    m = o.dismiss(m, "d");
    expect(o.locate(m, "b")).toMatchObject({ place: "tree" });
    expect(o.locate(m, "e")).toMatchObject({ place: "tree", window: m.windows[0]!.key });
    expect(o.locate(m, "a")).toEqual({ place: "drawer", side: "start" });
    expect(o.locate(m, "d")).toEqual({ place: "parked" });
    expect(o.locate(m, "nope")).toEqual({ place: "nowhere" });
    expect(o.catalogue(m).map((c) => c.where)).toEqual(["drawer", "tree", "tree", "parked", "tree"]);
    expect(o.nodeAt(m.root, [])).toMatchObject({ kind: "stack" });
    expect(o.nodeAt(m.root, [0])).toBeNull();
    expect(o.nodeAt(base().root, [2, 1])).toMatchObject({ views: ["e"] });
  });
});

describe("place", () => {
  it("joins a group as a tab at an index", () => {
    const m = o.place(base(), "a", "b", "into", 1);
    expect(o.locate(m, "a")).toMatchObject({ stack: { views: ["b", "a", "c"], current: "a" } });
    expect(m.focus).toBe("a");
    expect((m.root as SplitNode).children).toHaveLength(2);
  });
  it("splits beside a target on each side", () => {
    for (const zone of ["left", "right", "above", "below"] as const) {
      const m = o.place(base(), "a", "d", zone);
      const order = o.viewsIn(m.root);
      const i = order.indexOf("a");
      const j = order.indexOf("d");
      expect(zone === "left" || zone === "above" ? i < j : i > j).toBe(true);
    }
  });
  it("splits within same axis by flattening", () => {
    const m = o.place(base(), "a", "d", "below");
    const col = (m.root as SplitNode).children[1] as SplitNode;
    expect(col.axis).toBe("column");
    expect(o.viewsIn(col)).toEqual(["d", "a", "e"]);
  });
  it("is a no-op for invalid targets", () => {
    const m = base();
    expect(o.place(m, "a", "a", "into")).toBe(m);
    expect(o.place(m, "a", "a", "left")).toBe(m);
    expect(o.place(m, "a", "zz", "left")).toBe(m);
  });
  it("can split a tab off its own group", () => {
    const m = o.place(base(), "c", "b", "right");
    expect(o.locate(m, "b")).toMatchObject({ stack: { views: ["b"] } });
    expect(o.locate(m, "c")).toMatchObject({ stack: { views: ["c"] } });
  });
  it("places into window trees", () => {
    let m = o.detach(base(), "e", { x: 0, y: 0, w: 100, h: 100 });
    m = o.place(m, "a", "e", "into");
    expect(o.viewsIn(m.windows[0]!.tree)).toEqual(["e", "a"]);
  });
  it("keeps an emptied document area", () => {
    let m = o.place(base(), "b", "a", "into");
    m = o.place(m, "c", "a", "into");
    expect(o.stacksOf(m.root).some((s) => s.stack.docs && s.stack.views.length === 0)).toBe(true);
  });
});

describe("edges, windows, drawers", () => {
  it("docks at each edge with a weight", () => {
    const m = o.placeAtEdge(base(), "e", "edge-below", 0.2);
    expect(m.root).toMatchObject({ kind: "split", axis: "column", weights: [0.8, 0.2] });
    const l = o.placeAtEdge(base(), "e", "edge-left");
    expect(o.viewsIn(l.root)[0]).toBe("e");
    expect(o.placeAtEdge(o.createModel(views, null), "a", "edge-above").root).toMatchObject({ kind: "stack", views: ["a"] });
  });
  it("detaches, moves, raises windows", () => {
    let m = o.detach(base(), "a", { x: 1, y: 1, w: 10, h: 10 });
    m = o.detach(m, "d", { x: 2, y: 2, w: 10, h: 10 });
    const [w1, w2] = m.windows;
    m = o.moveWindow(m, w1!.key, { x: 5, y: 6, w: 7, h: 8 });
    expect(m.windows[0]!.box).toEqual({ x: 5, y: 6, w: 7, h: 8 });
    m = o.raiseWindow(m, w1!.key);
    expect(m.windows.map((w) => w.key)).toEqual([w2!.key, w1!.key]);
    expect(o.raiseWindow(m, w1!.key)).toBe(m);
    m = o.place(m, "a", "b", "into");
    expect(m.windows).toHaveLength(1);
  });
  it("stows by inferred side and unstows to that edge", () => {
    let m = o.stow(base(), "a");
    expect(m.drawers.start).toEqual(["a"]);
    m = o.stow(m, "e");
    expect(m.drawers.end).toEqual(["e"]);
    m = o.unstow(m, "a");
    expect(o.viewsIn(m.root)[0]).toBe("a");
    expect(o.unstow(m, "b")).toBe(m);
    const col = o.createModel(views, o.column([o.stack(["a"]), o.stack(["b"]), o.stack(["c"])]));
    expect(o.stow(col, "a").drawers.top).toEqual(["a"]);
    expect(o.stow(col, "c").drawers.bottom).toEqual(["c"]);
    expect(o.stow(o.createModel(views, o.stack(["a"])), "a").drawers.start).toEqual(["a"]);
  });
  it("refuses to stow documents or windowed views", () => {
    const m = base();
    expect(o.stow(m, "b")).toBe(m);
    const w = o.detach(m, "a", { x: 0, y: 0, w: 9, h: 9 });
    expect(o.stow(w, "a")).toBe(w);
  });
});

describe("dismiss / reveal / forget / addView", () => {
  it("parks and reveals into the docs area", () => {
    let m = o.dismiss(base(), "a");
    expect(m.parked).toEqual(["a"]);
    m = o.reveal(m, "a");
    expect(o.locate(m, "a")).toMatchObject({ stack: { docs: true, current: "a" } });
  });
  it("reveals into an empty docs area and at the edge when none", () => {
    let m = o.dismiss(o.dismiss(base(), "b"), "c");
    m = o.reveal(o.dismiss(m, "a"), "a");
    expect(o.locate(m, "a")).toMatchObject({ stack: { docs: true, views: ["a"] } });
    const plain = o.dismiss(o.createModel(views, o.row([o.stack(["a"]), o.stack(["b"])])), "a");
    expect(o.viewsIn(o.reveal(plain, "a").root).at(-1)).toBe("a");
    expect(o.reveal(plain, "zz")).toBe(plain);
  });
  it("reveal selects tabs and unstows", () => {
    expect(o.locate(o.reveal(base(), "c"), "c")).toMatchObject({ stack: { current: "c" } });
    const s = o.stow(base(), "a");
    expect(o.locate(o.reveal(s, "a"), "a").place).toBe("tree");
  });
  it("forget removes registration", () => {
    const m = o.forget(base(), "a");
    expect(m.views["a"]).toBeUndefined();
  });
  it("addView places near a target or reveals", () => {
    let m = o.addView(base(), "x", { title: "X" }, { view: "d", zone: "above" });
    expect(o.viewsIn(m.root)).toContain("x");
    m = o.addView(m, "y", { title: "Y" });
    expect(o.locate(m, "y")).toMatchObject({ stack: { docs: true } });
  });
});

describe("select / reorder / setWeights / zoom", () => {
  it("selects and reorders", () => {
    let m = o.select(base(), "c");
    expect(o.locate(m, "c")).toMatchObject({ stack: { current: "c" } });
    m = o.reorder(m, "c", 0);
    expect(o.locate(m, "c")).toMatchObject({ stack: { views: ["c", "b"] } });
    m = o.reorder(m, "c", 99);
    expect(o.locate(m, "c")).toMatchObject({ stack: { views: ["b", "c"] } });
  });
  it("sets weights only when valid", () => {
    let m = o.setWeights(base(), [], [1, 1, 1]);
    expect((m.root as SplitNode).weights).toEqual([1, 1, 1]);
    m = o.setWeights(m, [], [1, -1, 1]);
    expect((m.root as SplitNode).weights).toEqual([1, 1, 1]);
    m = o.setWeights(m, [2], [3, 1]);
    expect(((m.root as SplitNode).children[2] as SplitNode).weights).toEqual([3, 1]);
    const w = o.detach(m, "a", { x: 0, y: 0, w: 1, h: 1 });
    expect(o.setWeights(w, [], [1], w.windows[0]!.key).windows[0]!.tree).toMatchObject({ kind: "stack" });
  });
  it("toggles zoom", () => {
    let m = o.toggleZoom(base(), "d");
    expect(m.zoom).toBe("d");
    m = o.toggleZoom(m, "d");
    expect(m.zoom).toBeUndefined();
    expect(o.toggleZoom(o.dismiss(base(), "a"), "a").zoom).toBeUndefined();
  });
});

describe("insertBetween / fillDocs", () => {
  const v = { a: { title: "A" }, b: { title: "B" }, c: { title: "C" }, d: { title: "D" } };
  it("inserts between siblings, in windows too, and ignores bad targets", async () => {
    const { createModel, row, column, stack, docs, insertBetween, fillDocs, detach, viewsIn } = await import("../index.js");
    const m = createModel(v, row([stack(["a"]), stack(["b"]), column([stack(["c"]), stack(["d"])])]));
    const r = insertBetween(m, "d", [], 0);
    expect(viewsIn(r.root)).toEqual(["a", "d", "b", "c"]);
    expect(insertBetween(m, "a", [], 0)).toBe(m);
    expect(insertBetween(m, "a", [], 5)).toBe(m);
    expect(insertBetween(m, "a", [0], 0)).toBe(m);
    expect(insertBetween(m, "a", [2], 0).root).toMatchObject({ kind: "split" });
    const w = detach(createModel(v, row([stack(["a"]), stack(["b"])])), "c", { x: 0, y: 0, w: 1, h: 1 });
    const key = w.windows[0]!.key;
    const w2 = { ...w, windows: [{ ...w.windows[0]!, tree: row([stack(["c"]), stack(["d"])]) }] };
    expect(viewsIn(insertBetween(w2, "a", [], 0, key).windows[0]!.tree)).toEqual(["c", "a", "d"]);
    const e = createModel(v, row([stack(["a"]), docs([])]));
    expect(fillDocs(e, "a", [0])).toBe(e);
    expect(fillDocs(e, "a", [1]).root).toMatchObject({ kind: "stack", docs: true, views: ["a"] });
    const ew = { ...w, windows: [{ ...w.windows[0]!, tree: row([stack(["c"]), docs([])]) }] };
    expect(fillDocs(ew, "a", [1], key).windows[0]!.tree).toMatchObject({ children: [{ views: ["c"] }, { views: ["a"] }] });
  });
});

describe("enlist", () => {
  it("registers and places at every kind of spot", () => {
    const at = (spot: Parameters<typeof o.enlist>[3]) => o.enlist(base(), "x", { title: "X" }, spot);
    expect(o.locate(at(undefined), "x")).toMatchObject({ place: "tree", stack: { docs: true } });
    expect(o.locate(at("docs"), "x")).toMatchObject({ place: "tree", stack: { docs: true } });
    expect(at("parked").parked).toEqual(["x"]);
    const near = at({ near: "d", zone: "below" });
    expect(o.locate(near, "x").place).toBe("tree");
    expect(near.focus).toBe("x");
    expect(o.locate(at({ near: "a" }), "x")).toMatchObject({ stack: { views: ["a", "x"] } });
    expect((at({ edge: "edge-left", weight: 0.2 }).root as SplitNode).weights[0]).toBeCloseTo(0.2);
    expect(at({ float: { x: 1, y: 2, w: 3, h: 4 } }).windows[0]!.box).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    expect(at({ stow: "end" }).drawers.end).toEqual(["x"]);
    expect(at("auto").views["x"]).toEqual({ title: "X" });
  });
  it("throws clear errors", () => {
    expect(() => o.enlist(base(), "a", { title: "A" })).toThrow(/already exists/);
    expect(() => o.enlist(base(), "", { title: "?" })).toThrow(/non-empty id/);
    expect(() => o.enlist(base(), "x", { title: "X" }, { near: "nope" })).toThrow(/"nope".*not in the layout/);
    const plain = o.createModel(views, o.row([o.stack(["a"])]));
    expect(() => o.enlist(plain, "x", { title: "X" }, "docs")).toThrow(/document area/);
    expect(o.locate(o.enlist(plain, "x", { title: "X" }), "x").place).toBe("tree");
  });
});

describe("dismiss hands focus on", () => {
  const two = () => o.select(o.createModel({ a: { title: "A" }, b: { title: "B" }, c: { title: "C" } }, o.row([o.stack(["a", "b"]), o.stack(["c"])])), "b");
  it("moves focus to the group's new current tab", () => {
    const m = o.dismiss(two(), "b");
    expect(m.focus).toBe("a");
  });
  it("moves focus to another group when the group empties, and keeps focus elsewhere untouched", () => {
    const m = o.dismiss(o.select(two(), "c"), "c");
    expect(m.focus).toBe("b");
    expect(o.dismiss(two(), "c").focus).toBe("b");
  });
  it("leaves focus empty when nothing is left", () => {
    const solo = o.select(o.createModel({ a: { title: "A" } }, o.row([o.stack(["a"])])), "a");
    expect(o.dismiss(solo, "a").focus).toBeUndefined();
  });
});
