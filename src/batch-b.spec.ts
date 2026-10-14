import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlexdockManager, createModel, docs, locate, previewOf, promote, row, setPreview, stack, upgrade, validate } from "./index.js";
import type { FlexdockModel } from "./model.js";

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

const views = { a: { title: "A" }, b: { title: "B" }, c: { title: "C" }, d: { title: "D" } };
const layout = (): FlexdockModel => createModel(views, row([stack(["a"]), stack(["b"]), docs(["c", "d"])]));
const sr = (el: FlexdockManager) => el.shadowRoot!;
async function mount(model = layout(), setup?: (el: FlexdockManager) => void) {
  const el = document.createElement("flexdock-manager");
  for (const id of Object.keys(model.views)) {
    const d = document.createElement("div");
    d.dataset["view"] = id;
    d.innerHTML = `<input name="${id}">`;
    el.append(d);
  }
  setup?.(el);
  document.body.append(el);
  el.model = model;
  await el.updateComplete;
  lay(el);
  return el;
}
function lay(el: FlexdockManager) {
  rects.set(el, { left: 0, top: 0, width: 900, height: 600 });
  rects.set(sr(el).querySelector(".main")!, { left: 0, top: 0, width: 900, height: 600 });
  Array.from(sr(el).querySelectorAll<HTMLElement>("[data-stack]")).forEach((s, i) => rects.set(s, { left: i * 300, top: 0, width: 294, height: 600 }));
}
const tab = (el: FlexdockManager, id: string) => sr(el).querySelector<HTMLElement>(`.tab[data-view="${id}"]`)!;
const key = (el: FlexdockManager, k: string, extra: KeyboardEventInit = {}) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));

describe("preview tabs (ops)", () => {
  it("sets, replaces, promotes and reads previews", () => {
    let m = setPreview(layout(), "c").model;
    expect(previewOf(m)).toBe("c");
    expect(previewOf(m, "d")).toBe("c");
    expect(previewOf(m, "a")).toBeUndefined();
    expect(previewOf(m, "zz")).toBeUndefined();
    const r = setPreview(m, "d");
    expect(r.replaced).toBe("c");
    expect(r.model.parked).toContain("c");
    m = promote(r.model, "d");
    expect(previewOf(m)).toBeUndefined();
    expect(promote(m, "d")).toBe(m);
    expect(setPreview(m, "zz").model).toBe(m);
    expect(setPreview(setPreview(m, "d").model, "d").replaced).toBeUndefined();
  });
});

describe("layout versions (ops)", () => {
  it("upgrades step by step and validates", () => {
    const v0 = layout();
    const steps = { 0: (m: FlexdockModel) => ({ ...m, focus: "a" }), 1: (m: FlexdockModel) => m };
    const v2 = upgrade(v0, steps, 2);
    expect(v2.version).toBe(2);
    expect(v2.focus).toBe("a");
    expect(upgrade(v2, steps, 2)).toEqual(v2);
    expect(() => upgrade(v2, steps, 1)).toThrow(/newer/);
    expect(() => upgrade(v0, {}, 1)).toThrow(/no migration from layout version 0/);
    expect(() => upgrade(v0, { 0: () => ({}) as FlexdockModel }, 1)).toThrow(/did not return/);
    expect(validate(v0)).toEqual([]);
    expect(validate({})).toEqual([expect.stringMatching(/not a layout model/)]);
    const bad = {
      ...v0, focus: "zz", parked: ["a"], drawers: { start: ["q"], end: [], top: [], bottom: [] },
      root: { kind: "split", axis: "row", children: [stack(["a"]), { kind: "weird" }], weights: [1] },
      windows: [{ key: "w", box: { x: 0, y: 0, w: 1, h: 1 }, tree: stack(["b"]) }]
    } as unknown as FlexdockModel;
    expect(validate(bad)).toEqual([
      "bad weights in root", "bad node in root", 'unknown view "q" in drawer start', 'view "a" is placed more than once', 'focus "zz" is not placed'
    ]);
  });
});

describe("<flexdock-manager> preview tabs", () => {
  it("opens previews from addView and showPreview, replaces them and promotes on double-click, typing or dirty", async () => {
    const el = await mount();
    el.addView("p1", "one", { at: "docs", preview: true });
    await el.updateComplete;
    expect(tab(el, "p1").hasAttribute("data-preview")).toBe(true);
    el.addView("p2", "two", { at: "docs", preview: true });
    await el.updateComplete;
    expect(el.model.parked).toContain("p1");
    expect(tab(el, "p1")).toBeNull();
    tab(el, "p2").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(previewOf(el.model)).toBeUndefined();
    tab(el, "c").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(el.model.views["c"]).toBeDefined();
    // showPreview: a parked view comes back as the preview; already placed + not preview: just revealed.
    el.showPreview("p1");
    expect(previewOf(el.model)).toBe("p1");
    el.showPreview("a");
    expect(previewOf(el.model)).toBe("p1");
    el.showPreview("nope");
    // A placed preview re-shown keeps preview status.
    el.showPreview("p1");
    expect(previewOf(el.model)).toBe("p1");
    // Typing in it keeps it.
    await el.updateComplete;
    el.addView("p3", Object.assign(document.createElement("div"), { innerHTML: "<input>" }), { at: "docs", preview: true });
    expect(previewOf(el.model)).toBe("p3");
    el.querySelector('[data-view="p3"] input')!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(previewOf(el.model)).toBeUndefined();
    document.body.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("input"));
    el.addView("p4", "four", { at: "docs", preview: true });
    el.setDirty("p4");
    expect(previewOf(el.model)).toBeUndefined();
  });
});

describe("<flexdock-manager> unsaved changes", () => {
  it("shows a dot, asks before closing with its own dialog, and can be cancelled", async () => {
    const el = await mount();
    const events: string[] = [];
    el.addEventListener("flexdock-dirty", (e) => events.push(`${e.detail.id}:${e.detail.dirty}`));
    el.setDirty("c");
    el.setDirty("c");
    el.setDirty("a");
    await el.updateComplete;
    expect(el.isDirty("c")).toBe(true);
    expect(el.dirtyViews).toEqual(["c", "a"]);
    expect(tab(el, "c").hasAttribute("data-dirty")).toBe(true);
    expect(tab(el, "c").querySelector('[part~="tab-dirty"]')!.getAttribute("aria-label")).toBe("Unsaved changes");
    expect(sr(el).querySelector('[data-stack="a"] .title [part~="tab-dirty"]')).not.toBeNull();
    // Cancel keeps it.
    let closing = el.dismiss("c");
    await el.updateComplete;
    const dlg = sr(el).querySelector("flexdock-confirm")!;
    expect(dlg.getAttribute("aria-label")).toBe("C has unsaved changes. Close it anyway?");
    expect(sr(el).activeElement?.hasAttribute("data-cancel")).toBe(true);
    dlg.querySelector<HTMLButtonElement>("[data-cancel]")!.click();
    expect(await closing).toBe(false);
    expect(locate(el.model, "c").place).toBe("tree");
    // A second request replaces a pending one (which answers false).
    const first = el.dismiss("c");
    closing = el.dismiss("c");
    expect(await first).toBe(false);
    await el.updateComplete;
    sr(el).querySelector<HTMLButtonElement>("flexdock-confirm [data-primary]")!.click();
    expect(await closing).toBe(true);
    expect(el.model.parked).toContain("c");
    expect(el.isDirty("c")).toBe(false);
    expect(events).toEqual(["c:true", "a:true", "c:false"]);
    el.setDirty("zz", false);
  });

  it("uses a confirmClose hook (sync, async, throwing) and dismissMany asks per dirty view", async () => {
    const el = await mount();
    el.setDirty("c");
    el.confirmClose = () => false;
    expect(await el.dismiss("c")).toBe(false);
    el.confirmClose = () => Promise.reject(new Error("x"));
    expect(await el.dismiss("c")).toBe(false);
    el.confirmClose = () => { throw new Error("boom"); };
    expect(await el.dismiss("c")).toBe(false);
    const asked: string[] = [];
    el.confirmClose = async (id) => { asked.push(id); return true; };
    el.setDirty("d");
    expect(el.dismissMany(["a", "c", "d"])).toEqual(["a"]);
    await vi.waitFor(() => expect(el.model.parked).toEqual(expect.arrayContaining(["a", "c", "d"])));
    expect(asked).toEqual(["c", "d"]);
    expect(await el.dismiss("a")).toBe(false);
  });
});

describe("<flexdock-manager> keyboard docking", () => {
  it("cycles targets with Tab, picks sides with arrows, drops with Enter and announces", async () => {
    const el = await mount();
    el.activate("a");
    key(el, "m", { altKey: true });
    await el.updateComplete;
    const live = () => (el as unknown as { _say: string })._say;
    expect(live()).toMatch(/^Moving A\. .* B, into$/);
    expect(sr(el).querySelector("flexdock-drop-guide")).not.toBeNull();
    key(el, "ArrowRight");
    expect(live()).toBe("B, right");
    key(el, "ArrowRight");
    expect(live()).toBe("B, into");
    key(el, "Tab");
    expect(live()).toBe("C, into");
    key(el, "Tab");
    expect(live()).toBe("Outer edge, edge-left");
    key(el, "ArrowDown");
    expect(live()).toBe("Outer edge, edge-below");
    key(el, "Tab", { shiftKey: true });
    key(el, "ArrowUp");
    expect(live()).toBe("C, above");
    expect(key(el, "x")).toBe(true);
    key(el, "Enter");
    expect(live()).toBe("Moved A");
    await el.updateComplete;
    expect(sr(el).querySelector(".sr")!.textContent).toBe("Moved A");
    expect(el.model.root).toMatchObject({ children: [{ views: ["b"] }, { kind: "split", axis: "column" }] });
    await el.updateComplete;
    expect(sr(el).querySelector("flexdock-drop-guide")).toBeNull();
    // Escape cancels; outer-edge drop.
    lay(el);
    expect(el.beginMove("b")).toBe(true);
    key(el, "Escape");
    expect(live()).toBe("Move cancelled");
    el.cancelMove();
    el.beginMove("b");
    key(el, "Tab", { shiftKey: true });
    key(el, "ArrowLeft");
    expect((el as unknown as { _say: string })._say).toBe("Outer edge, edge-left");
    key(el, " ");
    expect((el.model.root as { children: unknown[] }).children[0]).toMatchObject({ views: ["b"] });
    expect(el.beginMove("nope")).toBe(false);
  });

  it("drops into an empty document area and refuses fixed views", async () => {
    const el = await mount(createModel({ a: views.a, b: { title: "B", caps: { move: false } } }, row([stack(["a"]), stack(["b"]), docs([])])));
    el.beginMove("a");
    key(el, "Tab");
    expect((el as unknown as { _say: string })._say).toBe("Drop a view here, into");
    key(el, "ArrowLeft");
    expect((el as unknown as { _say: string })._say).toBe("Drop a view here, into");
    key(el, "Enter");
    expect(locate(el.model, "a")).toMatchObject({ stack: { docs: true } });
    expect(el.beginMove("b")).toBe(false);
    const empty = await mount(createModel({ a: views.a }, row([stack(["a"])])));
    rects.delete(sr(empty).querySelector(".main")!);
    vi.spyOn(empty as unknown as { mainRect(): undefined }, "mainRect").mockReturnValue(undefined);
    expect(empty.beginMove("a")).toBe(false);
  });
});

describe("<flexdock-manager> layout versions", () => {
  const steps = { 0: (m: FlexdockModel) => ({ ...m, parked: [...m.parked, "d"], root: m.root }), 1: (m: FlexdockModel) => m };
  it("stamps assigned models, upgrades stored ones and reports problems", async () => {
    const issues: Array<{ source: string; fatal: boolean; problems: string[] }> = [];
    const old = { ...layout(), root: row([stack(["a"]), stack(["b"]), docs(["c"])]) };
    localStorage.setItem("fd-v", JSON.stringify(old));
    const el = await mount(layout(), (e) => {
      e.layoutVersion = 2;
      e.migrations = steps;
      e.storageKey = "fd-v";
      e.addEventListener("flexdock-layoutissue", (ev) => issues.push(ev.detail));
    });
    expect(el.restored).toBe(true);
    expect(el.model.version).toBe(2);
    expect(el.model.parked).toEqual(["d"]);
    expect(el.snapshot().version).toBe(2);
    // restore(): old snapshots upgrade; broken ones throw and report.
    el.restore({ ...layout(), version: 1 });
    expect(el.model.version).toBe(2);
    expect(() => el.restore({ ...layout(), version: 5 })).toThrow(/not a usable/);
    expect(() => el.restore({} as FlexdockModel)).toThrow();
    el.restore({ ...layout(), version: 2, focus: "zz" });
    expect(issues.map((i) => [i.source, i.fatal])).toEqual([["restore", true], ["restore", true], ["restore", false]]);
    expect(issues[2]!.problems).toEqual(['focus "zz" is not placed']);
  });

  it("falls back to the app layout when stored data cannot be upgraded", async () => {
    const issues: string[] = [];
    localStorage.setItem("fd-v2", JSON.stringify({ ...layout(), version: 0 }));
    const el = await mount(layout(), (e) => {
      e.layoutVersion = 1;
      e.storageKey = "fd-v2";
      e.addEventListener("flexdock-layoutissue", (ev) => issues.push(`${ev.detail.source}:${ev.detail.problems[0]}`));
    });
    expect(el.restored).toBe(false);
    expect(issues).toEqual(["storage:flexdock: no migration from layout version 0"]);
    localStorage.setItem("fd-v2", JSON.stringify({ nope: 1 }));
    el.model = layout();
    expect(issues[1]).toMatch(/^storage:not a layout model/);
    // Without layoutVersion nothing is migrated.
    const plain = await mount({ ...layout(), version: 7 });
    expect(plain.model.version).toBe(7);
  });
});
