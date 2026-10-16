import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DockoramaManager, createModel, docs, locate, row, column, stack } from "./index.js";
import type { DockoramaModel } from "./model.js";

// jsdom has no layout: give elements rectangles from a map (default: zero box).
type R = { left: number; top: number; width: number; height: number };
const rects = new Map<Element, R>();
const orig = Element.prototype.getBoundingClientRect;
const rect = (r: R) => ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON() { return r; } }) as DOMRect;
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return rect(rects.get(this) ?? { left: 0, top: 0, width: 0, height: 0 });
  };
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = orig;
  rects.clear();
  document.body.innerHTML = "";
});

const views = { a: { title: "A" }, b: { title: "B" }, c: { title: "C" }, d: { title: "D" }, e: { title: "E" } };
const layout = (): DockoramaModel => createModel(views, row([stack(["a"]), stack(["b", "c"]), docs([])]));

async function mount(model = layout()) {
  const el = document.createElement("dockorama-manager");
  for (const id of Object.keys(views)) {
    const d = document.createElement("div");
    d.dataset["view"] = id;
    el.append(d);
  }
  document.body.append(el);
  el.model = model;
  await el.updateComplete;
  layoutRects(el);
  return el;
}
const sr = (el: DockoramaManager) => el.shadowRoot!;
/** Lay out: host/main 0..900 x 0..600; stacks side by side 300px each; gutters 6px at 300 and 600. */
function layoutRects(el: DockoramaManager) {
  rects.set(el, { left: 0, top: 0, width: 900, height: 600 });
  rects.set(sr(el).querySelector(".main")!, { left: 0, top: 0, width: 900, height: 600 });
  sr(el).querySelectorAll("[data-stack]:not([data-win])").forEach(() => undefined);
  const stacks = Array.from(sr(el).querySelectorAll<HTMLElement>("[data-stack]")).filter((s) => !s.dataset["win"]);
  stacks.forEach((s, i) => rects.set(s, { left: i * 300, top: 0, width: 294, height: 600 }));
  Array.from(sr(el).querySelectorAll(".gutter")).forEach((g, i) => rects.set(g, { left: 294 + i * 300, top: 0, width: 6, height: 600 }));
  Array.from(sr(el).querySelectorAll(".tabs")).forEach((t) => {
    const s = t.closest<HTMLElement>("[data-stack]")!;
    const r = rects.get(s)!;
    rects.set(t, { left: r.left, top: 0, width: r.width, height: 28 });
    Array.from(t.querySelectorAll(".tab")).forEach((x, i) => rects.set(x, { left: r.left + i * 80, top: 0, width: 80, height: 28 }));
  });
}
const pd = (target: Element, x: number, y: number) =>
  target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, clientX: x, clientY: y, button: 0, pointerId: 1 }));
const pm = (x: number, y: number) => window.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, pointerId: 1 }));
const pu = (x: number, y: number) => window.dispatchEvent(new PointerEvent("pointerup", { clientX: x, clientY: y, pointerId: 1 }));
const tab = (el: DockoramaManager, id: string) => sr(el).querySelector<HTMLElement>(`.tab[data-view="${id}"]`)!;

async function dragTab(el: DockoramaManager, id: string, to: [number, number], drop = true) {
  pd(tab(el, id), 320, 10);
  pm(330, 10);
  pm(to[0], 200);
  pm(to[0], to[1]);
  await el.updateComplete;
  if (drop) pu(to[0], to[1]);
  await el.updateComplete;
}

describe("dragging", () => {
  it("drops onto a gutter between two groups", async () => {
    const el = await mount(createModel(views, row([stack(["a"]), stack(["b", "c"]), stack(["d"])])));
    await dragTab(el, "c", [597, 300], false);
    expect(sr(el).querySelector('.target[data-zone="between"]')).not.toBeNull();
    expect(sr(el).querySelector(".gutter[data-drop]")).not.toBeNull();
    pu(597, 300);
    await el.updateComplete;
    const root = el.model.root!;
    expect(root.kind === "split" && root.children.map((c) => (c.kind === "stack" ? c.views : []))).toEqual([["a"], ["b"], ["c"], ["d"]]);
    expect(el.model.focus).toBe("c");
  });

  it("drops into an empty document area", async () => {
    const el = await mount();
    await dragTab(el, "c", [750, 300]);
    const where = locate(el.model, "c");
    expect(where.place === "tree" && where.stack.docs).toBe(true);
  });

  it("shows only the centre target over an empty document area and ignores misses", async () => {
    const el = await mount();
    await dragTab(el, "c", [700, 400], false);
    const zones = Array.from(sr(el).querySelectorAll<HTMLElement>(".target")).map((t) => t.dataset["zone"]);
    expect(zones.filter((z) => !z!.startsWith("edge-"))).toEqual(["into"]);
    pu(700, 400);
    await el.updateComplete;
    expect(el.model.windows).toHaveLength(1);
  });

  it("docks at an outer edge and onto the compass of a group", async () => {
    const el = await mount();
    await dragTab(el, "c", [24, 300]);
    const root = el.model.root!;
    expect(root.kind === "split" && root.children[0]).toMatchObject({ views: ["c"] });
    layoutRects(el);
    // Compass "left" of the middle group (b) at cx-40.
    const bar = Array.from(sr(el).querySelectorAll<HTMLElement>("[data-stack]")).find((x) => x.dataset["stack"] === "a")!.querySelector(".bar")!;
    pd(bar, 100, 10);
    pm(120, 10);
    pm(447 - 40, 300);
    pu(447 - 40, 300);
    expect(locate(el.model, "a").place).toBe("tree");
  });

  it("Escape cancels a drag and restores the original layout", async () => {
    const el = await mount();
    const before = el.model;
    const cancel = vi.fn();
    el.addEventListener("dockorama-dragcancel", cancel);
    // Reorder within the strip first (live), then tear off and press Escape.
    pd(tab(el, "c"), 420, 10);
    pm(310, 10);
    await el.updateComplete;
    expect(locate(el.model, "c")).toMatchObject({ stack: { views: ["c", "b"] } });
    pm(450, 300);
    await el.updateComplete;
    expect(sr(el).querySelector(".overlay")).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await el.updateComplete;
    expect(el.model).toBe(before);
    expect(sr(el).querySelector(".overlay")).toBeNull();
    expect(cancel).toHaveBeenCalledWith(expect.objectContaining({ detail: { id: "c" } }));
    pu(450, 300);
    expect(el.model).toBe(before);
    expect(el.canUndo).toBe(false);
  });

  it("pointercancel aborts and moving floating windows can be cancelled", async () => {
    const el = await mount();
    el.detach("a", { x: 100, y: 100, w: 200, h: 150 });
    await el.updateComplete;
    layoutRects(el);
    const win = sr(el).querySelector<HTMLElement>("[data-window]")!;
    const before = el.model;
    pd(win.querySelector(".bar")!, 150, 110);
    pm(170, 130);
    pm(260, 230);
    await el.updateComplete;
    expect(el.model.windows[0]!.box.x).toBe(210);
    window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));
    await el.updateComplete;
    expect(el.model).toBe(before);
    // A real move commits once.
    pd(sr(el).querySelector("[data-window] .bar")!, 150, 110);
    pm(170, 130);
    pm(200, 140);
    pu(200, 140);
    expect(el.model.windows[0]!.box).toMatchObject({ x: 150, y: 130 });
    el.undo();
    expect(el.model.windows[0]!.box).toMatchObject({ x: 100, y: 100 });
  });

  it("small movements are clicks, other pointers are ignored", async () => {
    const el = await mount();
    const before = el.model;
    pd(tab(el, "c"), 450, 10);
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 600, clientY: 300, pointerId: 9 }));
    pm(452, 11);
    pu(452, 11);
    expect(el.model.root).toEqual(before.root);
  });

  it("refuses gutter drops for document-only views and cancelled moves", async () => {
    const el = await mount(createModel({ ...views, d: { title: "D", caps: { docsOnly: true } } }, row([stack(["a"]), docs(["d", "e"]), stack(["b"])])));
    const before = el.model;
    el.dropBetween("d", [], 0);
    expect(el.model).toBe(before);
    el.addEventListener("dockorama-beforemove", (e) => e.preventDefault(), { once: true });
    el.dropBetween("b", [], 0);
    expect(el.model).toBe(before);
    el.dropBetween("b", [], 0);
    expect(locate(el.model, "b")).toMatchObject({ path: [1] });
    el.dropIntoDocs("a", [9]);
    expect(locate(el.model, "a")).toMatchObject({ path: [0] });
  });
});

describe("document-only views and floating", () => {
  const make = () => mount(createModel({ ...views, d: { title: "D", caps: { docsOnly: true } } }, row([stack(["a"]), docs(["d", "e"]), stack(["b"])])));
  it("detach() leaves a document-only view in its area, and other views still float", async () => {
    const el = await make();
    const before = el.model;
    el.detach("d");
    expect(el.model).toBe(before);
    el.detach("e");
    expect(el.model.windows).toHaveLength(1);
  });
  it("dropping a document-only tab on empty space does not float it", async () => {
    const el = await make();
    el.addEventListener("dockorama-drop", () => {});
    pd(tab(el, "d"), 320, 10);
    pm(330, 10);
    pm(330, 200);
    pm(5000, 5000);
    await el.updateComplete;
    pu(5000, 5000);
    await el.updateComplete;
    expect(el.model.windows).toHaveLength(0);
    expect(locate(el.model, "d").place).toBe("tree");
  });
});

describe("tab overflow", () => {
  function overflow(strip: HTMLElement, scrollWidth: number, clientWidth: number) {
    Object.defineProperty(strip, "scrollWidth", { configurable: true, value: scrollWidth });
    Object.defineProperty(strip, "clientWidth", { configurable: true, value: clientWidth });
  }
  it("scrolls with buttons and the wheel and flags available directions", async () => {
    const el = await mount(createModel(views, row([stack(["a", "b", "c", "d", "e"])])));
    const strip = sr(el).querySelector<HTMLElement>(".tabs")!;
    const bar = strip.parentElement!;
    overflow(strip, 600, 200);
    strip.dispatchEvent(new Event("scroll"));
    expect(bar.hasAttribute("data-overflow")).toBe(true);
    expect(bar.hasAttribute("data-can-back")).toBe(false);
    expect(bar.hasAttribute("data-can-fwd")).toBe(true);
    bar.querySelector<HTMLElement>('.scroll[data-dir="1"]')!.click();
    expect(strip.scrollLeft).toBeGreaterThan(0);
    expect(bar.hasAttribute("data-can-back")).toBe(true);
    const wheel = new WheelEvent("wheel", { deltaY: 50, cancelable: true });
    const x = strip.scrollLeft;
    strip.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(strip.scrollLeft).toBe(x + 50);
    strip.dispatchEvent(new WheelEvent("wheel", { deltaX: -30, cancelable: true }));
    expect(strip.scrollLeft).toBe(x + 20);
    const y = strip.scrollLeft;
    bar.querySelector<HTMLElement>('.scroll[data-dir="-1"]')!.click();
    expect(strip.scrollLeft).toBeLessThan(y);
    // Not overflowing: wheel is left alone.
    overflow(strip, 200, 200);
    const idle = new WheelEvent("wheel", { deltaY: 50, cancelable: true });
    strip.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);
    strip.dispatchEvent(new Event("scroll"));
    expect(bar.hasAttribute("data-overflow")).toBe(false);
  });

  it("keeps the selected tab in view", async () => {
    const el = await mount(createModel(views, column([stack(["a", "b", "c", "d", "e"])])));
    const strip = sr(el).querySelector<HTMLElement>(".tabs")!;
    overflow(strip, 600, 200);
    const e = tab(el, "e");
    rects.set(strip, { left: 0, top: 0, width: 200, height: 30 });
    // The tab sits at x=500 inside a 600px-wide scrolled strip; its viewport position follows the scroll.
    const at = (x: number) => () => ({ left: x - strip.scrollLeft, right: x + 90 - strip.scrollLeft, top: 0, bottom: 30, width: 90, height: 30 }) as DOMRect;
    e.getBoundingClientRect = at(500);
    el.reveal("e");
    await el.updateComplete;
    expect(strip.scrollLeft).toBe(390);
    const a = tab(el, "a");
    a.getBoundingClientRect = at(0);
    el.reveal("a");
    await el.updateComplete;
    expect(strip.scrollLeft).toBe(0);
  });
});

describe("pointer resizing, focus navigation and menus", () => {
  it("drags a gutter to resize and records one undo step", async () => {
    const el = await mount(createModel(views, row([stack(["a"]), stack(["b"]), stack(["c"])])));
    Array.from(sr(el).querySelectorAll(".cell")).forEach((c, i) => rects.set(c, { left: i * 300, top: 0, width: 294, height: 600 }));
    const g = sr(el).querySelector(".gutter")!;
    pd(g, 297, 300);
    expect(g.hasAttribute("data-live")).toBe(true);
    pm(357, 300);
    pu(357, 300);
    expect(g.hasAttribute("data-live")).toBe(false);
    const root = el.model.root!;
    expect(root.kind === "split" && root.weights[0]! > root.weights[1]!).toBe(true);
    el.undo();
    expect(el.model.root).toMatchObject({ weights: [1, 1, 1] });
    // No movement: nothing recorded.
    pd(sr(el).querySelector(".gutter")!, 297, 300);
    pu(297, 300);
    expect(el.canUndo).toBe(false);
    // Non-primary buttons are ignored.
    sr(el).querySelector(".gutter")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 2 }));
  });

  it("resizes a window from its grip with snapping", async () => {
    const el = await mount();
    el.snap = 10;
    el.detach("a", { x: 100, y: 100, w: 200, h: 150 });
    await el.updateComplete;
    const grip = sr(el).querySelector(".grip")!;
    pd(grip, 300, 250);
    pm(363, 287);
    pu(363, 287);
    expect(el.model.windows[0]!.box).toMatchObject({ w: 260, h: 190 });
    el.undo();
    expect(el.model.windows[0]!.box).toMatchObject({ w: 200, h: 150 });
  });

  it("moves focus to neighbouring groups with Alt+arrows", async () => {
    const el = await mount(createModel(views, row([stack(["a"]), column([stack(["b"]), stack(["c", "d"])])])));
    const stacks = Array.from(sr(el).querySelectorAll<HTMLElement>("[data-stack]"));
    rects.set(stacks[0]!, { left: 0, top: 0, width: 300, height: 600 });
    rects.set(stacks[1]!, { left: 300, top: 0, width: 300, height: 300 });
    rects.set(stacks[2]!, { left: 300, top: 300, width: 300, height: 300 });
    el.focusNeighbour("right");
    expect(el.model.focus).toBe("a");
    el.activate("a");
    await el.updateComplete;
    el.focusNeighbour("right");
    expect(el.model.focus).toBe("b");
    await el.updateComplete;
    el.focusNeighbour("below");
    expect(el.model.focus).toBe("c");
    await el.updateComplete;
    el.focusNeighbour("left");
    expect(el.model.focus).toBe("a");
    await el.updateComplete;
    el.focusNeighbour("above");
    expect(el.model.focus).toBe("b");
    el.cycleTab("c", 1);
    expect(el.model.focus).toBe("d");
    el.cycleTab("zzz", 1);
    el.nudge("zzz", "left");
  });

  it("lists tabs in the more menu, navigates it with keys and closes on outside clicks", async () => {
    const el = await mount(createModel(views, row([stack(["a", "b", "c"])])));
    sr(el).querySelector<HTMLElement>('[part~="more"]')!.click();
    await el.updateComplete;
    await el.updateComplete;
    const menu = sr(el).querySelector<HTMLElement>(".menu")!;
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>("button"));
    expect(items.slice(0, 3).map((b) => b.textContent!.trim())).toEqual(["A", "B", "C"]);
    items[0]!.focus();
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));
    items[2]!.click();
    await el.updateComplete;
    expect(el.model.focus).toBe("c");
    sr(el).querySelector<HTMLElement>('[part~="more"]')!.click();
    await el.updateComplete;
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await el.updateComplete;
    expect(sr(el).querySelector(".menu")).toBeNull();
    sr(el).querySelector<HTMLElement>('[part~="more"]')!.click();
    await el.updateComplete;
    sr(el).querySelector(".menu")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await el.updateComplete;
    expect(sr(el).querySelector(".menu")).toBeNull();
  });

  it("a second click on a rail item closes a flyout that a click opened, even straight away", async () => {
    const el = await mount(createModel(views, row([stack(["a"]), stack(["b"])])));
    el.stow("a");
    await el.updateComplete;
    const item = sr(el).querySelector<HTMLElement>(".rail-item")!;
    item.click();
    await el.updateComplete;
    expect(sr(el).querySelector(".drawer")).not.toBeNull();
    item.click();
    await el.updateComplete;
    expect(sr(el).querySelector(".drawer")).toBeNull();
  });

  it("peeks drawers on hover and toggles them by click", async () => {
    const el = await mount(createModel(views, row([stack(["a"]), stack(["b"])])));
    el.stow("a");
    await el.updateComplete;
    const item = sr(el).querySelector<HTMLElement>(".rail-item")!;
    item.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "touch" }));
    await el.updateComplete;
    expect(sr(el).querySelector(".drawer")).toBeNull();
    item.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    await el.updateComplete;
    expect(sr(el).querySelector(".drawer")).not.toBeNull();
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 1000);
    item.click();
    await el.updateComplete;
    expect(sr(el).querySelector(".drawer")).toBeNull();
    vi.restoreAllMocks();
    el.reveal("a");
    await el.updateComplete;
    sr(el).querySelector<HTMLElement>('.drawer [part~="close"]')!.click();
    expect(el.model.parked).toContain("a");
  });

  it("popOut returns false when the browser blocks the window", async () => {
    const el = await mount();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    expect(el.popOut("a")).toBe(false);
    open.mockRestore();
  });
});

describe("drag and resize events", () => {
  it("fires dragstart, dragover once per spot change, and drop", async () => {
    const el = await mount(createModel(views, row([stack(["a"]), stack(["b", "c"]), stack(["d"])])));
    const log: string[] = [];
    el.addEventListener("dockorama-dragstart", (e) => log.push(`start ${e.detail.id} ${e.detail.kind}`));
    el.addEventListener("dockorama-dragover", (e) => log.push(`over ${e.detail.spot}${e.detail.target ? " " + e.detail.target : ""}`));
    el.addEventListener("dockorama-drop", (e) => log.push(`drop ${e.detail.spot} ${e.detail.moved}`));
    pd(tab(el, "c"), 320, 10);
    pm(330, 10);
    pm(597, 200);
    pm(597, 210);
    pm(597, 300);
    pu(597, 300);
    await el.updateComplete;
    expect(log[0]).toBe("start c tab");
    expect(log.filter((l) => l === "over between")).toHaveLength(1);
    expect(log.at(-1)).toBe("drop between true");
  });

  it("reports moved: false when a beforemove listener vetoes the drop", async () => {
    const el = await mount(createModel(views, row([stack(["a"]), stack(["b", "c"]), stack(["d"])])));
    el.addEventListener("dockorama-beforemove", (e) => e.preventDefault());
    const drops: boolean[] = [];
    el.addEventListener("dockorama-drop", (e) => drops.push(e.detail.moved));
    const placement = (): string[][] => (el.model.root as unknown as { children: Array<{ views: string[] }> }).children.map((c) => c.views);
    const before = placement();
    await dragTab(el, "b", [597, 300]);
    expect(placement()).toEqual(before);
    expect(drops).toEqual([false]);
  });

  it("cancels a drag when dragstart is prevented", async () => {
    const el = await mount();
    const before = el.model.root;
    el.addEventListener("dockorama-dragstart", (e) => e.preventDefault());
    const drop = vi.fn();
    el.addEventListener("dockorama-drop", drop);
    await dragTab(el, "c", [597, 300]);
    expect(el.model.root).toEqual(before);
    expect(drop).not.toHaveBeenCalled();
  });

  it("fires resize (and rAF-throttled resizing) for window grips", async () => {
    const el = await mount();
    el.detach("a", { x: 100, y: 100, w: 200, h: 150 });
    await el.updateComplete;
    const ends: unknown[] = [];
    const live = vi.fn();
    el.addEventListener("dockorama-resize", (e) => ends.push(e.detail));
    el.addEventListener("dockorama-resizing", live);
    pd(sr(el).querySelector(".grip")!, 300, 250);
    pm(320, 260);
    pm(340, 270);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    pu(340, 270);
    expect(live).toHaveBeenCalledTimes(1);
    expect(ends).toEqual([{ kind: "window", window: el.model.windows[0]!.key, box: el.model.windows[0]!.box }]);
  });

  it("fires resize when a splitter drag ends", async () => {
    const el = await mount();
    const ends: Array<{ kind: string }> = [];
    el.addEventListener("dockorama-resize", (e) => ends.push(e.detail));
    const g = sr(el).querySelector(".gutter")!;
    g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, clientX: 297, clientY: 100, button: 0, pointerId: 1 }));
    pm(350, 100);
    pu(350, 100);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ kind: "split", path: [] });
  });
});
