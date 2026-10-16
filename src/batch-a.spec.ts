import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DockoramaManager, adopt, closeSet, comeInside, createModel, docs, goOutside, locate, normalize, outsideOf, pin, row, stack, tuneOutside,
  type TabMenuItem
} from "./index.js";
import type { DockoramaModel } from "./core/model.js";

type R = { left: number; top: number; width: number; height: number };
const rects = new Map<Element, R>();
const orig = Element.prototype.getBoundingClientRect;
const rect = (r: R) => ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON() { return r; } }) as DOMRect;
const innerW = window.innerWidth;
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return rect(rects.get(this) ?? { left: 0, top: 0, width: 0, height: 0 });
  };
  Object.defineProperty(window, "innerWidth", { value: 3000, configurable: true });
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = orig;
  Object.defineProperty(window, "innerWidth", { value: innerW, configurable: true });
  rects.clear();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const views = { a: { title: "A" }, b: { title: "B" }, c: { title: "C" }, d: { title: "D" } };
const sr = (el: DockoramaManager) => el.shadowRoot!;

async function mount(model: DockoramaModel, ids: string[], left = 0, group?: string) {
  const el = document.createElement("dockorama-manager");
  if (group) el.dragGroup = group;
  for (const id of ids) {
    const d = document.createElement("div");
    d.dataset["view"] = id;
    d.textContent = id;
    el.append(d);
  }
  document.body.append(el);
  el.model = model;
  await el.updateComplete;
  lay(el, left);
  return el;
}
/** Host at `left`..+900 x 0..600; stacks 300px wide; tabs 80px. */
function lay(el: DockoramaManager, left: number) {
  rects.set(el, { left, top: 0, width: 900, height: 600 });
  rects.set(sr(el).querySelector(".main")!, { left, top: 0, width: 900, height: 600 });
  const stacks = Array.from(sr(el).querySelectorAll<HTMLElement>("[data-stack]")).filter((s) => !s.dataset["win"]);
  stacks.forEach((s, i) => rects.set(s, { left: left + i * 300, top: 0, width: 294, height: 600 }));
  Array.from(sr(el).querySelectorAll(".tabs")).forEach((t) => {
    const r = rects.get(t.closest<HTMLElement>("[data-stack]")!)!;
    rects.set(t, { left: r.left, top: 0, width: r.width, height: 28 });
    Array.from(t.querySelectorAll(".tab")).forEach((x, i) => rects.set(x, { left: r.left + i * 80, top: 0, width: 80, height: 28 }));
  });
}
const pe = (type: string, x: number, y: number, extra: PointerEventInit = {}) =>
  new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, button: 0, pointerId: 1, ...extra });
const tab = (el: DockoramaManager, id: string) => sr(el).querySelector<HTMLElement>(`.tab[data-view="${id}"]`)!;

/** A stand-in browser window for outside-window tests. */
function fakeWin(over: Record<string, unknown> = {}) {
  const doc = document.implementation.createHTMLDocument("x");
  const ls: Record<string, Array<(e?: unknown) => void>> = {};
  const w = {
    document: doc, closed: false, screenX: 2000, screenY: 100, outerWidth: 600, outerHeight: 400, innerWidth: 600, innerHeight: 370,
    close: vi.fn(() => { w.closed = true; ls["pagehide"]?.forEach((f) => f()); }),
    addEventListener: (t: string, f: (e?: unknown) => void) => { (ls[t] ??= []).push(f); },
    removeEventListener: (t: string, f: (e?: unknown) => void) => { ls[t] = (ls[t] ?? []).filter((x) => x !== f); },
    fire: (t: string, e?: unknown) => [...(ls[t] ?? [])].forEach((f) => f(e)),
    ...over
  };
  return w;
}

describe("ops for batch A", () => {
  const m = () => createModel(views, row([stack(["a", "b", "c"]), docs(["d"])]));
  it("pins views first and keeps them out of close sets", () => {
    let x = pin(m(), "c");
    expect(locate(x, "c")).toMatchObject({ stack: { views: ["c", "a", "b"], pinned: ["c"] } });
    expect(pin(x, "c")).toBe(x);
    expect(closeSet(x, "a", "others")).toEqual(["b"]);
    expect(closeSet(x, "a", "right")).toEqual(["b"]);
    expect(closeSet(x, "a", "all")).toEqual(["a", "b"]);
    expect(closeSet(x, "zz", "all")).toEqual([]);
    x = pin(x, "c", false);
    expect(locate(x, "c")).toMatchObject({ stack: { views: ["c", "a", "b"] } });
    expect((locate(x, "c") as { stack: { pinned?: string[] } }).stack.pinned).toBeUndefined();
    expect(pin(x, "zz")).toBe(x);
  });
  it("records outside windows and drops stale ones on normalise", () => {
    let x = goOutside(m(), "a", "k1", { x: 1, y: 2, w: 3, h: 4 });
    x = goOutside(x, "b", "k1");
    expect(outsideOf(x, "b")).toMatchObject({ key: "k1", views: ["a", "b"], current: "b", box: { x: 1 } });
    x = goOutside(x, "b", "k2", { x: 0, y: 0, w: 10, h: 10 });
    x = goOutside(x, "a", "k2", { x: 5, y: 5, w: 10, h: 10 });
    expect(x.outside).toEqual([{ key: "k2", views: ["b", "a"], current: "a", box: { x: 5, y: 5, w: 10, h: 10 } }]);
    expect(goOutside(x, "zz", "k3")).toBe(x);
    x = tuneOutside(x, "k2", { current: "b", box: { x: 9, y: 9, w: 1, h: 1 } });
    x = tuneOutside(x, "k2", { current: "nope" });
    expect(x.outside![0]).toMatchObject({ current: "b", box: { x: 9 } });
    expect(comeInside(x, "c")).toBe(x);
    x = comeInside(comeInside(x, "a"), "b");
    expect(x.outside).toBeUndefined();
    const stale = normalize({ ...m(), outside: [{ key: "q", views: ["a", "zz"], current: "zz" }, { key: "", views: ["b"], current: "b" }] });
    expect(stale.outside).toEqual([{ key: "q", views: ["a"], current: "a" }]);
  });
  it("adopts views from elsewhere as parked", () => {
    const x = adopt(m(), "e", { title: "E" });
    expect(x.parked).toEqual(["e"]);
    expect(() => adopt(x, "e", { title: "E" })).toThrow(/already exists/);
  });
});

describe("dragging between managers", () => {
  it("moves a view, with its element, into a manager in the same drag group", async () => {
    const one = await mount(createModel({ a: views.a, b: views.b }, row([stack(["a", "b"]), stack([])])), ["a", "b"], 0, "g");
    const two = await mount(createModel({ c: views.c, d: views.d }, row([stack(["c"]), stack(["d"])])), ["c", "d"], 1000, "g");
    const events: string[] = [];
    for (const el of [one, two]) el.addEventListener("dockorama-transfer", (e) => events.push(`${e.detail.direction}:${e.detail.id}`));
    const el = one.querySelector('[data-view="b"]');
    tab(one, "b").dispatchEvent(pe("pointerdown", 100, 10));
    window.dispatchEvent(pe("pointermove", 110, 60));
    window.dispatchEvent(pe("pointermove", 1147, 300));
    await two.updateComplete;
    expect(sr(two).querySelector("dockorama-drop-guide")).not.toBeNull();
    expect(sr(one).querySelector("dockorama-drop-guide")).toBeNull();
    window.dispatchEvent(pe("pointermove", 1147 + 40, 300));
    window.dispatchEvent(pe("pointerup", 1147 + 40, 300));
    await two.updateComplete;
    expect(one.hasView("b")).toBe(false);
    expect(locate(two.model, "b")).toMatchObject({ place: "tree" });
    expect(two.querySelector('[data-view="b"]')).toBe(el);
    expect(events).toEqual(["out:b", "in:b"]);
    expect(sr(two).querySelector("dockorama-drop-guide")).toBeNull();
    one.undo();
    two.undo();
    expect(one.hasView("b")).toBe(true);
    expect(two.hasView("b")).toBe(false);
  });

  it("ignores managers in other groups, misses and duplicate ids, and cancels on Escape", async () => {
    const one = await mount(createModel({ a: views.a, b: views.b }, row([stack(["a", "b"])])), ["a", "b"], 0, "g");
    const two = await mount(createModel({ b: views.b, d: views.d }, row([stack(["b"]), stack(["d"])])), ["b", "d"], 1000, "g");
    const drag = async (x: number, y: number, up = true) => {
      lay(one, 0);
      tab(one, "a").dispatchEvent(pe("pointerdown", 20, 10));
      window.dispatchEvent(pe("pointermove", 30, 60));
      window.dispatchEvent(pe("pointermove", x, y));
      await two.updateComplete;
      if (up) window.dispatchEvent(pe("pointerup", x, y));
      await one.updateComplete;
    };
    // Into a group-less spot of the peer (no target): nothing happens.
    await drag(1200, 590);
    expect(one.hasView("a")).toBe(true);
    // Duplicate id "b": refused.
    tab(one, "b").dispatchEvent(pe("pointerdown", 100, 10));
    window.dispatchEvent(pe("pointermove", 110, 60));
    window.dispatchEvent(pe("pointermove", 1147 + 40, 300));
    window.dispatchEvent(pe("pointerup", 1147 + 40, 300));
    expect(one.hasView("b")).toBe(true);
    // Escape while over the peer clears its guide.
    await drag(1147, 300, false);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await two.updateComplete;
    expect(sr(two).querySelector("dockorama-drop-guide")).toBeNull();
    // Moving back over the source clears the peer's guide.
    await drag(1147, 300, false);
    window.dispatchEvent(pe("pointermove", 400, 300));
    await two.updateComplete;
    expect(sr(two).querySelector("dockorama-drop-guide")).toBeNull();
    window.dispatchEvent(pe("pointermove", 147, 300));
    window.dispatchEvent(pe("pointerup", 147, 300));
    expect(one.model.windows).toHaveLength(0);
    // Different group: no peer.
    two.dragGroup = "other";
    await drag(1147 + 40, 300);
    expect(two.hasView("a")).toBe(false);
    expect(one.model.windows).toHaveLength(1);
    one.undo();
    await one.updateComplete;
    // A vetoed move is refused too.
    two.dragGroup = "g";
    two.addEventListener("dockorama-beforemove", (e) => e.preventDefault(), { once: true });
    await drag(1147 + 40, 300);
    expect(two.hasView("a")).toBe(false);
  });

  it("drops into an empty peer and transfers from code, including lazy views", async () => {
    const one = await mount(createModel({ a: views.a, b: views.b }, row([stack(["a", "b"])])), ["a"], 0, "g");
    const two = await mount(createModel({}, null), [], 1000, "g");
    tab(one, "a").dispatchEvent(pe("pointerdown", 20, 10));
    window.dispatchEvent(pe("pointermove", 30, 60));
    window.dispatchEvent(pe("pointermove", 1450, 300));
    window.dispatchEvent(pe("pointerup", 1450, 300));
    expect(locate(two.model, "a").place).toBe("tree");
    one.addView("lazy", () => Object.assign(document.createElement("p"), { textContent: "made" }), { at: { stow: "end" } });
    one.transferView("lazy", two, { float: true });
    expect(two.model.windows).toHaveLength(1);
    await two.updateComplete;
    await two.updateComplete;
    expect(two.querySelector('[data-view="lazy"]')?.textContent).toBe("made");
    one.transferView("b", two, "auto");
    expect(() => two.transferView("b", two)).not.toThrow();
    expect(() => one.transferView("nope", two)).not.toThrow();
    one.addView("b2", "x");
    two.addView("b2", "y");
    expect(() => one.transferView("b2", two)).toThrow(/already has/);
  });
});

describe("outside windows", () => {
  const model = () => createModel(views, row([stack(["a", "b"]), docs(["c", "d"])]));
  const ids = ["a", "b", "c", "d"];

  it("opens, groups, persists and closes outside windows in step with the model", async () => {
    localStorage.clear();
    const wins: Array<ReturnType<typeof fakeWin>> = [];
    vi.spyOn(window, "open").mockImplementation(() => {
      const w = fakeWin({ screenX: 2000 + wins.length * 700 });
      wins.push(w);
      return w as unknown as Window;
    });
    const el = await mount(model(), ids);
    el.storageKey = "dk-out";
    expect(el.popOut("a", { box: { x: 10, y: 20 } })).toBe(true);
    expect(el.model.outside).toEqual([{ key: expect.stringMatching(/^o-a-/), views: ["a"], current: "a", box: { x: 10, y: 20, w: 640, h: 480 } }]);
    const key = el.model.outside![0]!.key;
    expect(wins[0]!.document.querySelector('.dko-body > [data-view="a"]')).not.toBeNull();
    expect(el.getViewElement("a")).toBe(wins[0]!.document.querySelector(".dko-body > [data-view=a]"));
    expect(el.popOut("c", { into: key })).toBe(true);
    expect(wins).toHaveLength(1);
    const doc = wins[0]!.document;
    expect(Array.from(doc.querySelectorAll(".dko-tab")).map((t) => t.textContent)).toEqual(["A\u2199", "C\u2199"]);
    expect(doc.querySelector('.dko-body > [data-view="a"]')!.hasAttribute("data-outside-hidden")).toBe(true);
    (doc.querySelector('.dko-tab[data-view="a"]') as HTMLElement).click();
    expect(el.model.outside![0]!.current).toBe("a");
    expect(JSON.parse(localStorage.getItem("dk-out")!).outside[0].views).toEqual(["a", "c"]);
    await el.updateComplete;
    expect(sr(el).querySelectorAll(".away")).toHaveLength(2);
    // Resizing records the box silently.
    vi.useFakeTimers();
    wins[0]!.screenX = 2222;
    wins[0]!.fire("resize");
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    expect(el.model.outside![0]!.box!.x).toBe(2222);
    // The back button docks one view; undo puts it back out.
    (doc.querySelector('.dko-tab[data-view="c"] .dko-back') as HTMLButtonElement).click();
    expect(el.querySelector(':scope > [data-view="c"]')).not.toBeNull();
    el.undo();
    expect(doc.querySelector('[data-view="c"]')).not.toBeNull();
    // Dismissing a popped view brings its element home.
    el.dismiss("c");
    expect(el.querySelector(':scope > [data-view="c"]')).not.toBeNull();
    // The user closing the window brings its views back.
    wins[0]!.close();
    expect(el.model.outside).toBeUndefined();
    expect(el.querySelector(':scope > [data-view="a"]')).not.toBeNull();
    // A closed window is not a target.
    expect(el.popOut("a", { into: key })).toBe(true);
    expect(wins).toHaveLength(2);
    expect(el.popOut("zz")).toBe(false);
    // Page unload notes boxes and closes windows without docking.
    window.dispatchEvent(new Event("pagehide"));
    expect(wins[1]!.closed).toBe(true);
    expect(el.model.outside).toHaveLength(1);
  });

  it("asks before re-opening windows the browser blocked, and can keep them docked", async () => {
    const saved = goOutside(model(), "b", "kb", { x: 1, y: 1, w: 300, h: 200 });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const el = await mount(saved, ids);
    await el.updateComplete;
    expect(el.blockedWindows).toEqual(["kb"]);
    const notice = sr(el).querySelector("dockorama-notice")!;
    expect(notice.getAttribute("role")).toBe("alertdialog");
    const w = fakeWin();
    open.mockReturnValue(w as unknown as Window);
    (notice.querySelector("button[data-primary]") as HTMLButtonElement).click();
    expect(el.blockedWindows).toEqual([]);
    expect(w.document.querySelector('[data-view="b"]')).not.toBeNull();
    expect(open).toHaveBeenLastCalledWith("", "dockorama-kb", "popup,width=300,height=200,left=1,top=1");
    // Blocked again after a restore; this time keep them docked.
    open.mockReturnValue(null);
    el.restore(goOutside(model(), "a", "ka"));
    await el.updateComplete;
    expect(el.blockedWindows).toEqual(["ka"]);
    (sr(el).querySelectorAll("dockorama-notice button")[1] as HTMLButtonElement).click();
    expect(el.model.outside).toBeUndefined();
    expect(el.blockedWindows).toEqual([]);
    open.mockImplementation(() => { throw new Error("nope"); });
    expect(el.popOut("a")).toBe(false);
  });

  it("drags tabs out of the window edge, into outside windows and back", async () => {
    const wins: Array<ReturnType<typeof fakeWin>> = [];
    vi.spyOn(window, "open").mockImplementation(() => {
      const w = fakeWin({ screenX: 2000 + wins.length * 700 });
      wins.push(w);
      return w as unknown as Window;
    });
    const el = await mount(model(), ids);
    // Past the window edge: pops out at the screen point.
    tab(el, "b").dispatchEvent(pe("pointerdown", 100, 10));
    window.dispatchEvent(pe("pointermove", 110, 60));
    window.dispatchEvent(pe("pointermove", 3100, 300, { screenX: 3100, screenY: 300 }));
    await el.updateComplete;
    expect(sr(el).querySelector("dockorama-drop-guide")).toBeNull();
    window.dispatchEvent(pe("pointerup", 3100, 300, { screenX: 3100, screenY: 300 }));
    expect(el.model.outside![0]).toMatchObject({ views: ["b"], box: { x: 3040, y: 280 } });
    // Released over that outside window's screen box: joins it.
    lay(el, 0);
    tab(el, "c").dispatchEvent(pe("pointerdown", 320, 10));
    window.dispatchEvent(pe("pointermove", 330, 60));
    window.dispatchEvent(pe("pointermove", 500, 300, { screenX: 2100, screenY: 200 }));
    window.dispatchEvent(pe("pointerup", 500, 300, { screenX: 2100, screenY: 200 }));
    expect(el.model.outside![0]!.views).toEqual(["b", "c"]);
    // Drag "c" out of the outside window onto the left group of the layout.
    const w = wins[0]!;
    Object.assign(window, { screenX: 0, screenY: 0, outerWidth: 3000, outerHeight: 800, innerHeight: 760 });
    const ctab = w.document.querySelector('.dko-tab[data-view="c"]') as HTMLElement;
    ctab.dispatchEvent(new PointerEvent("pointerdown", { button: 0, screenX: 2100, screenY: 120, bubbles: true }));
    w.fire("pointermove", new PointerEvent("pointermove", { screenX: 2102, screenY: 121, clientX: 102, clientY: 21 }));
    w.fire("pointermove", new PointerEvent("pointermove", { screenX: 147, screenY: 340, clientX: -1800, clientY: 300 }));
    await el.updateComplete;
    expect(sr(el).querySelector("dockorama-drop-guide")).not.toBeNull();
    w.fire("pointermove", new PointerEvent("pointermove", { screenX: 2100, screenY: 200, clientX: 100, clientY: 100 }));
    await el.updateComplete;
    expect(sr(el).querySelector("dockorama-drop-guide")).toBeNull();
    w.fire("pointermove", new PointerEvent("pointermove", { screenX: 147, screenY: 340, clientX: -1800, clientY: 300 }));
    w.fire("pointerup", new PointerEvent("pointerup", { screenX: 147, screenY: 340, clientX: -1800, clientY: 300 }));
    expect(outsideOf(el.model, "c")).toBeUndefined();
    expect(locate(el.model, "c")).toMatchObject({ stack: { views: ["a", "b", "c"] } });
    // Nowhere useful: just comes back. A click without movement does nothing.
    const btab = w.document.querySelector('.dko-tab[data-view="b"]') as HTMLElement;
    btab.dispatchEvent(new PointerEvent("pointerdown", { button: 2 }));
    btab.dispatchEvent(new PointerEvent("pointerdown", { button: 0, screenX: 2100, screenY: 120 }));
    w.fire("pointerup", new PointerEvent("pointerup", { screenX: 2100, screenY: 120 }));
    expect(outsideOf(el.model, "b")).toBeDefined();
    btab.dispatchEvent(new PointerEvent("pointerdown", { button: 0, screenX: 2100, screenY: 120 }));
    w.fire("pointermove", new PointerEvent("pointermove", { screenX: 5000, screenY: 900, clientX: 3000, clientY: 800 }));
    w.fire("pointerup", new PointerEvent("pointerup", { screenX: 5000, screenY: 900, clientX: 3000, clientY: 800 }));
    expect(el.model.outside).toBeUndefined();
    // A view that may not pop out stays put when dropped past the edge.
    const fixed = await mount(createModel({ a: { title: "A", caps: { popout: false } }, b: views.b }, row([stack(["a", "b"])])), ["a", "b"], 0);
    tab(fixed, "a").dispatchEvent(pe("pointerdown", 20, 10));
    window.dispatchEvent(pe("pointermove", 30, 60));
    window.dispatchEvent(pe("pointermove", 3100, 300, { screenX: 3100, screenY: 300 }));
    window.dispatchEvent(pe("pointerup", 3100, 300, { screenX: 3100, screenY: 300 }));
    expect(fixed.model.outside).toBeUndefined();
    expect(fixed.model.windows).toHaveLength(0);
  });

  it("moves a view between two outside windows by dragging its tab", async () => {
    const wins: Array<ReturnType<typeof fakeWin>> = [];
    vi.spyOn(window, "open").mockImplementation(() => {
      const w = fakeWin({ screenX: 2000 + wins.length * 700 });
      wins.push(w);
      return w as unknown as Window;
    });
    const el = await mount(model(), ids);
    el.popOut("a");
    el.popOut("c");
    const [k1, k2] = el.model.outside!.map((o) => o.key);
    const w = wins[0]!;
    (w.document.querySelector(".dko-tab") as HTMLElement).dispatchEvent(new PointerEvent("pointerdown", { button: 0, screenX: 2100, screenY: 120 }));
    w.fire("pointermove", new PointerEvent("pointermove", { screenX: 2800, screenY: 200, clientX: 800, clientY: 100 }));
    w.fire("pointerup", new PointerEvent("pointerup", { screenX: 2800, screenY: 200, clientX: 800, clientY: 100 }));
    expect(el.model.outside!.map((o) => o.key)).toEqual([k2]);
    expect(outsideOf(el.model, "a")?.key).toBe(k2);
    expect(wins[0]!.closed).toBe(true);
    void k1;
  });
});

describe("tab context menu", () => {
  const model = () => createModel(views, row([stack(["a", "b", "c"]), docs(["d"])]));
  const items = (el: DockoramaManager) => Array.from(sr(el).querySelectorAll<HTMLButtonElement>("dockorama-tab-menu button"));
  const choose = async (el: DockoramaManager, key: string) => {
    sr(el).querySelector<HTMLButtonElement>(`dockorama-tab-menu button[data-key="${key}"]`)!.click();
    await el.updateComplete;
  };
  const open = async (el: DockoramaManager, id: string) => {
    await el.updateComplete;
    tab(el, id).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 50, clientY: 40 }));
    await el.updateComplete;
  };

  it("opens on right-click and Shift+F10 and runs the built-in commands", async () => {
    const el = await mount(model(), ["a", "b", "c", "d"]);
    await open(el, "b");
    expect(items(el).map((b) => b.dataset["key"])).toEqual([
      "close", "close-others", "close-right", "close-all", "pin", "float", "popout", "split-right", "split-down", "stow"
    ]);
    expect(document.activeElement).toBe(el);
    expect(sr(el).activeElement).toBe(items(el)[0]);
    await choose(el, "pin");
    expect(el.hasPin("b")).toBe(true);
    expect(sr(el).activeElement).toBe(tab(el, "b").querySelector(".tab-main"));
    tab(el, "b").dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }));
    await el.updateComplete;
    expect(sr(el).querySelector('button[data-key="pin"]')!.getAttribute("aria-checked")).toBe("true");
    expect(sr(el).querySelector('button[data-key="pin"]')!.textContent).toBe("Unpin tab");
    await choose(el, "close-others");
    expect(locate(el.model, "b")).toMatchObject({ stack: { views: ["b"] } });
    el.undo();
    await open(el, "a");
    await choose(el, "close-right");
    expect(locate(el.model, "a")).toMatchObject({ stack: { views: ["b", "a"] } });
    el.undo();
    await open(el, "a");
    await choose(el, "close-all");
    expect(locate(el.model, "b")).toMatchObject({ stack: { views: ["b"] } });
    el.undo();
    await open(el, "c");
    await choose(el, "split-right");
    expect(el.model.root).toMatchObject({ children: [{ views: ["b", "a"] }, { views: ["c"] }, { views: ["d"] }] });
    lay(el, 0);
    await open(el, "a");
    await choose(el, "split-down");
    el.openTabMenu("a");
    await el.updateComplete;
    expect(items(el).find((b) => b.dataset["key"] === "split-down")!.disabled).toBe(true);
    await choose(el, "float");
    expect(el.model.windows).toHaveLength(1);
    await el.updateComplete;
    el.openTabMenu("a");
    await el.updateComplete;
    expect(sr(el).querySelector('button[data-key="float"]')!.textContent).toBe("Dock back");
    expect(sr(el).querySelector('button[data-key="stow"]')).toBeNull();
    await choose(el, "float");
    expect(el.model.windows).toHaveLength(0);
    el.openTabMenu("a");
    await el.updateComplete;
    await choose(el, "stow");
    expect(locate(el.model, "a").place).toBe("drawer");
    el.openTabMenu("a");
    expect(sr(el).querySelector("dockorama-tab-menu")).toBeNull();
    el.openTabMenu("c");
    await el.updateComplete;
    vi.spyOn(window, "open").mockReturnValue(null);
    await choose(el, "popout");
    el.openTabMenu("c");
    await el.updateComplete;
    await choose(el, "close");
    expect(el.model.parked).toContain("c");
  });

  it("supports keyboard navigation, closing, disabled items and a customisation hook", async () => {
    const el = await mount(model(), ["a", "b", "c", "d"]);
    const ran: string[] = [];
    el.tabMenu = (id, base) => [...base.filter((i) => i === "separator" || i.key !== "stow"), "separator", { key: "copy", label: "Copy name", run: (v) => ran.push(v) }];
    el.openTabMenu("a", { x: 5000, y: 5 });
    await el.updateComplete;
    const menu = sr(el).querySelector<HTMLElement>("dockorama-tab-menu")!;
    expect(menu.style.left).toBe("680px");
    expect(menu.getAttribute("aria-label")).toBe("Tab actions");
    const key = (k: string) => { const e = new KeyboardEvent("keydown", { key: k, cancelable: true, bubbles: true }); menu.dispatchEvent(e); return e; };
    key("End");
    expect(sr(el).activeElement!.textContent).toBe("Copy name");
    key("Home");
    expect(sr(el).activeElement!.textContent).toBe("Close");
    key("ArrowUp");
    expect(sr(el).activeElement!.textContent).toBe("Copy name");
    key("ArrowDown");
    key("p");
    expect(sr(el).activeElement!.textContent).toBe("Pin tab");
    key("m");
    expect(sr(el).activeElement!.textContent).toBe("Move to new group on the right");
    expect(key("q").defaultPrevented).toBe(false);
    expect(key("Shift").defaultPrevented).toBe(false);
    (sr(el).activeElement as HTMLButtonElement).blur();
    sr(el).querySelector<HTMLButtonElement>('button[data-key="copy"]')!.click();
    expect(ran).toEqual(["a"]);
    el.openTabMenu("a");
    await el.updateComplete;
    sr(el).querySelector<HTMLElement>("dockorama-tab-menu")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await el.updateComplete;
    expect(sr(el).querySelector("dockorama-tab-menu")).toBeNull();
    // Disabled entries do nothing; outside clicks close.
    el.tabMenu = (_id, base) => base.map((i) => (i === "separator" ? i : { ...i, disabled: true }));
    el.openTabMenu("a");
    await el.updateComplete;
    const btn = sr(el).querySelector<HTMLButtonElement>('button[data-key="close"]')!;
    btn.disabled = false;
    btn.click();
    expect(el.model.parked).not.toContain("a");
    el.openTabMenu("a");
    await el.updateComplete;
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await el.updateComplete;
    expect(sr(el).querySelector("dockorama-tab-menu")).toBeNull();
    // dismissMany honours vetoes and caps.
    el.addEventListener("dockorama-beforeclose", (e) => { if (e.detail.id === "b") e.preventDefault(); });
    expect(el.dismissMany(["a", "b", "c"])).toEqual(["a", "c"]);
    expect(el.dismissMany(["b"])).toEqual([]);
    const separators: TabMenuItem[] = el.tabMenuItems("b").filter((i) => i === "separator");
    expect(separators).toHaveLength(1);
  });
});
