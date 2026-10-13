import { afterEach, describe, expect, it, vi } from "vitest";
import { FlexdockManager, FlexdockMinimap, VERSION, column, createModel, docs, locate, row, stack } from "./index.js";
import type { FlexdockModel } from "./model.js";

const views = {
  files: { title: "Files", icon: "📁" },
  edit: { title: "Editor" },
  readme: { title: "Readme" },
  out: { title: "Output" },
  props: { title: "Properties", caps: { dismiss: false, hide: false, zoom: false, float: false, popout: false, move: false } },
  locked: { title: "Locked", caps: { docsOnly: true, inert: true } }
};
const layout = (): FlexdockModel =>
  createModel(views, row([stack(["files"]), column([docs(["edit", "readme"]), stack(["out", "props"])]), stack(["locked"])]));

async function mount(model = layout()) {
  const el = document.createElement("flexdock-manager");
  for (const id of Object.keys(views)) {
    const d = document.createElement("div");
    d.dataset["view"] = id;
    d.textContent = id;
    el.append(d);
  }
  document.body.append(el);
  el.model = model;
  await el.updateComplete;
  return el;
}
const q = (el: FlexdockManager, sel: string) => el.shadowRoot!.querySelector<HTMLElement>(sel);
const qa = (el: FlexdockManager, sel: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(sel));
const key = (el: FlexdockManager, k: string, o: KeyboardEventInit = {}) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, ...o }));

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("<flexdock-manager>", () => {
  it("registers elements and exports a version", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(customElements.get("flexdock-manager")).toBe(FlexdockManager);
    expect(customElements.get("flexdock-minimap")).toBe(FlexdockMinimap);
  });

  it("assigns slots to light-DOM content and renders groups, tabs and gutters", async () => {
    const el = await mount();
    expect(el.querySelector('[data-view="files"]')!.getAttribute("slot")).toBe("v:files");
    expect(qa(el, "[data-stack]")).toHaveLength(4);
    expect(qa(el, '[role="tab"]').map((t) => t.textContent!.trim().replace(/\s+/g, " "))).toEqual(["Editor", "Readme", "Output", "Properties"]);
    expect(qa(el, '[role="separator"]')).toHaveLength(3);
    expect(qa(el, "slot").map((s) => (s as HTMLSlotElement).name)).toEqual(["v:files", "v:edit", "v:out", "v:locked"]);
    const late = document.createElement("p");
    late.dataset["view"] = "edit";
    el.append(late);
    await new Promise((r) => setTimeout(r));
    expect(late.slot).toBe("v:edit");
  });

  it("emits change, focus and viewshow events and supports undo/redo", async () => {
    const el = await mount();
    const changes: string[] = [];
    el.addEventListener("flexdock-change", (e) => changes.push(e.detail.reason));
    const focus = vi.fn();
    el.addEventListener("flexdock-focus", focus);
    const shown: string[] = [];
    el.addEventListener("flexdock-viewshow", (e) => shown.push(e.detail.id));
    el.reveal("readme");
    await el.updateComplete;
    expect(shown).toContain("readme");
    expect(focus).toHaveBeenCalled();
    el.place("files", "out", "into");
    expect(locate(el.model, "files")).toMatchObject({ stack: { views: ["out", "props", "files"] } });
    expect(el.canUndo).toBe(true);
    el.undo();
    expect(locate(el.model, "files")).toMatchObject({ stack: { views: ["files"] } });
    el.redo();
    expect(locate(el.model, "files")).toMatchObject({ stack: { views: ["out", "props", "files"] } });
    expect(el.canRedo).toBe(false);
    expect(changes).toEqual(["select", "place", "undo", "redo"]);
  });

  it("respects capabilities and cancellable before-events", async () => {
    const el = await mount();
    const before = el.model;
    el.dismiss("props");
    el.stow("props");
    el.toggleZoom("props");
    el.detach("props");
    expect(el.popOut("props")).toBe(false);
    el.place("props", "files", "left");
    el.place("locked", "files", "left");
    el.dockToEdge("locked", "edge-left");
    expect(el.model).toBe(before);
    el.place("locked", "edit", "into");
    expect(locate(el.model, "locked")).toMatchObject({ stack: { docs: true } });
    el.addEventListener("flexdock-beforeclose", (e) => e.preventDefault(), { once: true });
    el.dismiss("files");
    expect(locate(el.model, "files").place).toBe("tree");
    el.dismiss("files");
    expect(el.model.parked).toEqual(["files"]);
    el.reveal("files");
    expect(locate(el.model, "files").place).toBe("tree");
  });

  it("stows to a rail, peeks a drawer and unstows", async () => {
    const el = await mount();
    el.stow("files");
    await el.updateComplete;
    const item = q(el, ".rail-item")!;
    expect(item.textContent!.trim()).toBe("Files");
    item.click();
    await el.updateComplete;
    expect(q(el, ".drawer")).not.toBeNull();
    key(el, "Escape");
    await el.updateComplete;
    expect(q(el, ".drawer")).toBeNull();
    el.reveal("files");
    await el.updateComplete;
    expect(q(el, ".drawer")).not.toBeNull();
    (q(el, '.drawer [part~="unstow"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(q(el, ".rail")).toBeNull();
  });

  it("floats views in windows and docks them back", async () => {
    const el = await mount();
    el.snap = 10;
    el.detach("files", { x: 33, y: 41, w: 300, h: 200 });
    await el.updateComplete;
    const win = q(el, '[role="dialog"]')!;
    expect(win.getAttribute("aria-label")).toBe("Files");
    expect(el.model.windows[0]!.box).toMatchObject({ x: 30, y: 40 });
    el.dockToEdge("files", "edge-right");
    expect(el.model.windows).toHaveLength(0);
  });

  it("zooms with buttons, double-click and Escape", async () => {
    const el = await mount();
    (q(el, '[part~="zoom"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.model.zoom).toBe("files");
    expect(qa(el, "[data-stack]")).toHaveLength(1);
    key(el, "Escape");
    await el.updateComplete;
    expect(el.model.zoom).toBeUndefined();
    q(el, ".bar")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(el.model.zoom).toBe("files");
  });

  it("handles tab clicks, middle-click and close buttons in documents", async () => {
    const el = await mount();
    const tabs = qa(el, '[role="tab"]');
    tabs[1]!.click();
    expect(locate(el.model, "readme")).toMatchObject({ stack: { current: "readme" } });
    await el.updateComplete;
    (q(el, '[part~="tab-close"]') as HTMLButtonElement).click();
    expect(el.model.parked).toEqual(["edit"]);
    await el.updateComplete;
    qa(el, '[role="tab"]')[0]!.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true }));
    expect(el.model.parked).toEqual(["edit", "readme"]);
  });

  it("opens the more menu and runs actions", async () => {
    const el = await mount();
    (qa(el, '[part~="more"]')[2] as HTMLButtonElement).click();
    await el.updateComplete;
    const items = qa(el, ".menu button");
    expect(items.map((b) => b.textContent!.trim())).toEqual(["Output", "Properties", "Float in window", "Open in new browser window", "Auto-hide to edge", "Close"]);
    q(el, ".menu")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    items[2]!.click();
    await el.updateComplete;
    expect(el.model.windows).toHaveLength(1);
    expect(q(el, ".menu")).toBeNull();
  });

  it("keyboard shortcuts: focus, nudge, cycle, zoom, stow, float, close, undo", async () => {
    const el = await mount();
    el.activate("edit");
    key(el, "PageDown", { altKey: true });
    expect(el.model.focus).toBe("readme");
    key(el, "ArrowRight", { altKey: true, shiftKey: true });
    expect(locate(el.model, "readme")).toMatchObject({ stack: { views: ["readme"] } });
    key(el, "z", { ctrlKey: true, altKey: true });
    expect(locate(el.model, "readme")).toMatchObject({ stack: { views: ["edit", "readme"] } });
    key(el, "y", { ctrlKey: true, altKey: true });
    el.activate("out");
    key(el, "z", { altKey: true });
    expect(el.model.zoom).toBe("out");
    key(el, "z", { altKey: true });
    key(el, "h", { altKey: true });
    expect(el.model.drawers.bottom.concat(el.model.drawers.end, el.model.drawers.start)).toContain("out");
    el.activate("files");
    key(el, "f", { altKey: true });
    expect(el.model.windows).toHaveLength(1);
    key(el, "Backspace", { altKey: true });
    expect(el.model.parked).toContain("files");
    el.activate("locked");
    key(el, "ArrowLeft", { altKey: true });
  });

  it("command palette filters and runs", async () => {
    const el = await mount();
    key(el, ".", { ctrlKey: true });
    await el.updateComplete;
    const input = q(el, ".palette input") as HTMLInputElement;
    input.value = "read";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    expect(qa(el, ".palette li").map((l) => l.textContent!.trim())).toEqual(["Readme"]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(locate(el.model, "readme")).toMatchObject({ stack: { current: "readme" } });
    expect(el.paletteItems("undo")).toHaveLength(1);
    el.openPalette();
    await el.updateComplete;
    const i2 = q(el, ".palette input") as HTMLInputElement;
    i2.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    i2.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    i2.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await el.updateComplete;
    expect(q(el, ".palette")).toBeNull();
  });

  it("keyboard resizes splitters", async () => {
    const el = await mount();
    const g = qa(el, '[role="separator"]')[0]!;
    g.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    const w = (el.model.root as { weights: number[] }).weights;
    expect(w[0]).toBeGreaterThan(1);
    g.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect((el.model.root as { weights: number[] }).weights[0]).toBeLessThan(1);
    g.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));
  });

  it("persists to and restores from localStorage", async () => {
    const el = await mount();
    el.storageKey = "fd-test";
    el.stow("files");
    expect(JSON.parse(localStorage.getItem("fd-test")!).drawers.start).toEqual(["files"]);
    const el2 = document.createElement("flexdock-manager");
    el2.storageKey = "fd-test";
    el2.model = layout();
    expect(el2.restored).toBe(true);
    expect(el2.model.drawers.start).toEqual(["files"]);
    localStorage.setItem("fd-test", "{oops");
    el2.model = layout();
    expect(el2.restored).toBe(false);
  });

  it("snapshot/restore, addView, forget, labels", async () => {
    const el = await mount();
    const snap = el.snapshot();
    el.addView("new", { title: "New" }, { view: "files", zone: "below" });
    expect(locate(el.model, "new").place).toBe("tree");
    el.forget("new");
    expect(el.model.views["new"]).toBeUndefined();
    el.restore(snap);
    expect(el.model.root).toEqual(snap.root);
    expect(() => el.restore({} as FlexdockModel)).toThrow();
    el.labels = { dismiss: "Fermer" };
    await el.updateComplete;
    expect(q(el, '[part~="close"]')!.getAttribute("aria-label")).toBe("Fermer");
  });

  it("pops content out to a window and back", async () => {
    const el = await mount();
    const fake = document.implementation.createHTMLDocument("x");
    const win = { document: fake, closed: false, close: vi.fn(), addEventListener: vi.fn() } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(win);
    expect(el.popOut("files")).toBe(true);
    expect(el.popOut("files")).toBe(false);
    await el.updateComplete;
    expect(q(el, ".away")).not.toBeNull();
    (q(el, ".away button") as HTMLButtonElement).click();
    expect(el.querySelector('[data-view="files"]')).not.toBeNull();
    open.mockRestore();
  });

  it("renders an empty state and the minimap", async () => {
    const el = await mount(createModel(views, null));
    expect(q(el, ".empty")).not.toBeNull();
    el.id = "mgr";
    el.model = layout();
    const mm = document.createElement("flexdock-minimap");
    mm.for = "mgr";
    document.body.append(mm);
    await new Promise((r) => setTimeout(r));
    await mm.updateComplete;
    expect(mm.shadowRoot!.querySelectorAll("button")).toHaveLength(4);
    (mm.shadowRoot!.querySelector("button") as HTMLButtonElement).click();
    el.stow("files");
    await mm.updateComplete;
    expect(mm.shadowRoot!.querySelectorAll("button")).toHaveLength(3);
  });

  it("drags a title bar out to float and closes menus on outside click", async () => {
    const el = await mount();
    const bar = q(el, ".bar")!;
    const ev = (type: string, x: number, y: number) => new PointerEvent(type, { clientX: x, clientY: y, button: 0, pointerId: 1, bubbles: true, composed: true });
    bar.dispatchEvent(ev("pointerdown", 10, 10));
    window.dispatchEvent(ev("pointermove", 80, 90));
    await el.updateComplete;
    expect(q(el, ".ghost")).not.toBeNull();
    window.dispatchEvent(ev("pointerup", 80, 90));
    expect(el.model.windows).toHaveLength(1);
    el.openPalette();
    await el.updateComplete;
    document.body.dispatchEvent(ev("pointerdown", 0, 0));
    await el.updateComplete;
    expect(q(el, ".palette")).toBeNull();
  });
});
