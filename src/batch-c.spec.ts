import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlexdockManager, cellOf, clampPair, column, createModel, fixSize, fold, limitSize, resizeCells, row, stack } from "./index.js";
import { FlexdockMenu, VIRTUAL_AFTER, type MenuEntry } from "./components/menu.js";
import type { FlexdockModel, SplitNode } from "./model.js";

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
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.innerHTML = "";
});

const views = { a: { title: "A" }, b: { title: "B" }, c: { title: "C" }, d: { title: "D", keepAlive: true } };
const three = (): FlexdockModel => createModel(views, row([stack(["a"]), stack(["b"]), stack(["c", "d"])]));
const sr = (el: FlexdockManager) => el.shadowRoot!;
async function mount(model = three(), setup?: (el: FlexdockManager) => void) {
  const el = document.createElement("flexdock-manager");
  for (const id of Object.keys(model.views)) {
    const d = document.createElement("div");
    d.dataset["view"] = id;
    el.append(d);
  }
  setup?.(el);
  document.body.append(el);
  el.model = model;
  await el.updateComplete;
  await (el as unknown as { settled: Promise<void> }).settled;
  cells(el);
  return el;
}
function cells(el: FlexdockManager) {
  Array.from(sr(el).querySelectorAll(".split > .cell")).forEach((c, i) => rects.set(c, { left: i * 300, top: 0, width: 294, height: 600 }));
}
const gutter = (el: FlexdockManager, i = 0) => sr(el).querySelectorAll<HTMLElement>(".gutter")[i]!;
const pd = (t: Element, x: number) => t.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, clientX: x, clientY: 0, button: 0 }));
const pm = (x: number) => window.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: 0 }));
const pu = (x: number) => window.dispatchEvent(new PointerEvent("pointerup", { clientX: x, clientY: 0 }));
const key = (t: Element, k: string) => t.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, composed: true, cancelable: true }));
const split = (el: FlexdockManager) => el.model.root as Extract<FlexdockModel["root"], { kind: "split" }>;

describe("split extras (ops)", () => {
  it("finds cells, fixes sizes, limits, folds and resizes", () => {
    let m = three();
    const c = cellOf(m, "b")!;
    expect(c).toMatchObject({ path: [], index: 1 });
    expect(cellOf(m, "zz")).toBeUndefined();
    m = fixSize(m, [], 0, 200.4);
    expect((m.root as SplitNode).fixed).toEqual([200, null, null]);
    m = fixSize(m, [], 0, null);
    expect((m.root as SplitNode).fixed).toBeUndefined();
    m = limitSize(m, [], 1, { min: 100, max: 400 });
    expect((m.root as SplitNode).limits![1]).toEqual({ min: 100, max: 400 });
    expect((limitSize(m, [], 1, {}).root as SplitNode).limits).toBeUndefined();
    m = fold(m, [], 0);
    expect((m.root as SplitNode).folded).toEqual([true, false, false]);
    m = fold(m, [], 1);
    expect(fold(m, [], 2)).toBe(m); // the last open cell cannot fold
    m = fold(fold(m, [], 0, false), [], 1, false);
    expect((m.root as SplitNode).folded).toBeUndefined();
    m = fixSize(m, [], 2, 150);
    m = resizeCells(m, [], [300, 200, 180]);
    expect(m.root as SplitNode).toMatchObject({ weights: [300, 200, 180], fixed: [null, null, 180] });
    expect(resizeCells(m, [], [1])).toBe(m);
    expect(fold(m, [9], 0)).toBe(m);
  });
  it("clamps a pair to its limits and keeps the sum", () => {
    expect(clampPair(50, 250, { min: 100 }, null)).toEqual([100, 200]);
    expect(clampPair(280, 20, null, { min: 60 })).toEqual([240, 60]);
    expect(clampPair(250, 50, { max: 200 }, undefined)).toEqual([200, 100]);
    expect(clampPair(100, 100, { min: 300 }, { min: 300 })).toEqual([100, 100]);
  });
  it("keeps extras aligned when a view moves out of a split", () => {
    let m = fixSize(limitSize(three(), [], 2, { min: 80 }), [], 0, 120);
    const r = createModel(views, column([stack(["a"]), stack(["b"])]));
    expect(cellOf(r, "b")?.split.axis).toBe("column");
    m = { ...m };
    expect((m.root as SplitNode).fixed!.length).toBe(3);
  });
});

describe("split extras (manager)", () => {
  it("double-click folds the smaller neighbour and restores it, Enter too", async () => {
    const el = await mount();
    rects.set(sr(el).querySelectorAll(".split > .cell")[1]!, { left: 300, top: 0, width: 200, height: 600 });
    gutter(el).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await el.updateComplete;
    expect(split(el).folded).toEqual([false, true, false]);
    expect(el.isFolded("b")).toBe(true);
    expect(sr(el).querySelector(".cell[data-folded]")).not.toBeNull();
    expect(gutter(el).hasAttribute("data-folded")).toBe(true);
    key(gutter(el), "Enter");
    await el.updateComplete;
    expect(el.isFolded("b")).toBe(false);
    // Weights decide without a layout (all zero sizes): ties fold the first.
    rects.clear();
    key(gutter(el), "Enter");
    expect(el.isFolded("a")).toBe(true);
    el.undo();
    expect(el.isFolded("a")).toBe(false);
  });
  it("view-based fold, fixed size and limits", async () => {
    const el = await mount();
    el.foldView("c");
    expect(el.isFolded("d")).toBe(true);
    el.foldView("d", false);
    el.fixViewSize("a", 240);
    expect(split(el).fixed).toEqual([240, null, null]);
    await el.updateComplete;
    expect((sr(el).querySelector(".split > .cell") as HTMLElement).getAttribute("style")).toContain("240px");
    el.limitViewSize("b", { min: 100, max: 320 });
    await el.updateComplete;
    expect((sr(el).querySelectorAll(".split > .cell")[1] as HTMLElement).getAttribute("style")).toContain("320px");
    el.fixViewSize("a", null);
    el.limitViewSize("b", null);
    expect(split(el).fixed).toBeUndefined();
    expect(split(el).limits).toBeUndefined();
    el.foldView("zz");
    el.fixViewSize("zz", 1);
    el.limitViewSize("zz", { min: 1 });
    expect(el.isFolded("zz")).toBe(false);
  });
  it("drag keeps fixed cells in px and respects limits", async () => {
    const el = await mount();
    el.limitViewSize("a", { max: 350 });
    el.fixViewSize("b", 294);
    await el.updateComplete;
    cells(el);
    pd(gutter(el), 297);
    pm(500);
    pu(500);
    expect(split(el).weights[0]).toBe(350);
    expect(split(el).weights[1]).toBe(238);
    expect(split(el).fixed).toEqual([null, 238, null]);
  });
  it("dragging next to a folded cell restores it", async () => {
    const el = await mount();
    el.foldView("a");
    await el.updateComplete;
    cells(el);
    pd(gutter(el), 297);
    pm(320);
    pu(320);
    expect(el.isFolded("a")).toBe(false);
  });
  it("keyboard resizes in px when the split has fixed or limited cells", async () => {
    const el = await mount();
    el.limitViewSize("a", { min: 280 });
    await el.updateComplete;
    cells(el);
    key(gutter(el), "Home");
    expect(split(el).weights[0]).toBe(280);
    key(gutter(el), "ArrowRight");
    expect(split(el).weights[0]).toBeGreaterThan(280);
    key(gutter(el), "x");
    // Plain weighted splits still use weights.
    el.limitViewSize("a", null);
    const before = split(el).weights.slice();
    key(gutter(el), "ArrowLeft");
    expect(split(el).weights[0]).toBeLessThan(before[0]!);
  });
});

describe("retain=active", () => {
  it("detaches hidden content, keeps keepAlive views and re-attaches on show", async () => {
    const el = await mount(three(), (m) => { m.retain = "active"; });
    const c = el.getViewElement("c")!;
    const d = el.getViewElement("d")!;
    // c is current in the third stack, d is keepAlive.
    expect(c.isConnected).toBe(true);
    expect(d.isConnected).toBe(true);
    el.model = createModel(views, row([stack(["a", "b"]), stack(["c", "d"], "d")]));
    await el.updateComplete;
    await (el as unknown as { settled: Promise<void> }).settled;
    expect(el.isRetained("b")).toBe(true);
    expect(el.isRetained("c")).toBe(true);
    expect(c.isConnected).toBe(false);
    expect(el.getViewElement("c")).toBe(c);
    expect(el.isRetained("d")).toBe(false);
    el.reveal("c");
    await el.updateComplete;
    await (el as unknown as { settled: Promise<void> }).settled;
    expect(c.isConnected).toBe(true);
    expect(el.isRetained("c")).toBe(false);
    // Removing a retained view hands its element back.
    expect(el.removeView("b")).not.toBeNull();
    expect(el.isRetained("b")).toBe(false);
    // Back to "all": everything returns.
    el.model = createModel({ a: views.a, c: views.c, d: views.d }, row([stack(["a", "c"])]));
    await el.updateComplete;
    await (el as unknown as { settled: Promise<void> }).settled;
    expect(el.isRetained("c")).toBe(true);
    el.retain = "all";
    await el.updateComplete;
    await (el as unknown as { settled: Promise<void> }).settled;
    expect(el.isRetained("c")).toBe(false);
    expect(c.isConnected).toBe(true);
  });
});

describe("virtual tab list", () => {
  const many = (n: number): MenuEntry[] => [
    ...Array.from({ length: n }, (_, i) => ({ label: `View ${i}`, action: "reveal", id: `v${i}`, checked: i === 0 })),
    "separator",
    { label: "Close", action: "close", id: "v0" }
  ];
  async function menu(n: number) {
    const m = document.createElement("flexdock-menu") as FlexdockMenu;
    m.entries = many(n);
    document.body.append(m);
    await m.updateComplete;
    return m;
  }
  it("renders every row below the threshold", async () => {
    const m = await menu(10);
    expect(m.virtual).toBe(false);
    expect(m.querySelectorAll("button").length).toBe(11);
  });
  it("renders only a window of rows above it, scrolls and keys through", async () => {
    const m = await menu(500);
    expect(VIRTUAL_AFTER).toBeLessThan(500);
    expect(m.virtual).toBe(true);
    expect(m.hasAttribute("data-virtual")).toBe(true);
    expect(m.querySelectorAll(".menu-rows button").length).toBeLessThan(30);
    const box = m.querySelector<HTMLElement>(".menu-scroll")!;
    box.scrollTop = 3000;
    box.dispatchEvent(new Event("scroll"));
    await m.updateComplete;
    expect(m.querySelector('button[data-index="100"]')).not.toBeNull();
    const first = m.querySelector<HTMLButtonElement>('button[data-index="100"]')!;
    first.focus();
    key(first, "ArrowDown");
    await m.updateComplete;
    await m.updateComplete;
    expect(document.activeElement?.getAttribute("data-index")).toBe("101");
    key(document.activeElement!, "End");
    await new Promise((r) => setTimeout(r));
    expect(document.activeElement?.getAttribute("data-index")).toBe("499");
    key(document.activeElement!, "ArrowDown");
    expect(document.activeElement?.textContent).toBe("Close");
    key(document.activeElement!, "ArrowUp");
    key(m.querySelector('button[data-index="499"]')!, "Home");
    await new Promise((r) => setTimeout(r));
    expect(document.activeElement?.getAttribute("data-index")).toBe("0");
    key(document.activeElement!, "ArrowUp");
    await new Promise((r) => setTimeout(r));
    expect(document.activeElement?.getAttribute("data-index")).toBe("0");
    const seen: string[] = [];
    m.addEventListener("flexdock-request", (e) => seen.push((e as CustomEvent).detail.action ?? (e as CustomEvent).detail.type));
    (document.activeElement as HTMLElement).click();
    expect(seen.length).toBe(1);
    key(document.activeElement!, "Escape");
    m.remove();
    await m.showRow(3);
  });
});
