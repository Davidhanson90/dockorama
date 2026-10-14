import { afterEach, describe, expect, it } from "vitest";
import { PazuruManager, column, createModel, row, stack, stateEvents } from "./index.js";
import * as ops from "./ops.js";
import type { PazuruModel } from "./model.js";

const views = { a: { title: "A" }, b: { title: "B" }, c: { title: "C" }, d: { title: "D" } };
const layout = (): PazuruModel => createModel(views, row([stack(["a"]), column([stack(["b", "c"]), stack(["d"])])]));
const types = (prev: PazuruModel, next: PazuruModel) => stateEvents(prev, next).map((e) => `${e.type} ${JSON.stringify(e.detail)}`);

describe("stateEvents", () => {
  it("is empty for the same model", () => {
    const m = layout();
    expect(stateEvents(m, m)).toEqual([]);
  });

  it("derives float, dock, stow, unstow, pin, unpin, viewremove", () => {
    const m = layout();
    const floated = ops.detach(m, "a", { x: 0, y: 0, w: 100, h: 100 });
    expect(types(m, floated)).toEqual([`pazuru-float {"id":"a","window":"${floated.windows[0]!.key}"}`]);
    const docked = ops.placeAtEdge(floated, "a", "edge-left");
    expect(types(floated, docked)).toEqual(['pazuru-dock {"id":"a","from":"floating"}']);
    const stowed = ops.stow(m, "d", "end");
    expect(types(m, stowed)).toEqual(['pazuru-stow {"id":"d","side":"end"}']);
    expect(types(stowed, ops.unstow(stowed, "d"))).toEqual(['pazuru-dock {"id":"d","from":"drawer"}', 'pazuru-unstow {"id":"d"}']);
    const pinned = ops.pin(m, "c", true);
    expect(types(m, pinned)).toEqual(['pazuru-pin {"id":"c"}']);
    expect(types(pinned, ops.pin(pinned, "c", false))).toEqual(['pazuru-unpin {"id":"c"}']);
    expect(types(m, ops.forget(m, "d"))).toEqual(['pazuru-viewremove {"id":"d"}']);
    const closed = ops.dismiss(m, "d");
    expect(types(closed, ops.reveal(closed, "d"))).toEqual(['pazuru-dock {"id":"d","from":"closed"}']);
  });

  it("derives collapse and expand keyed by the views in the cell", () => {
    const m = layout();
    const folded = ops.fold(m, [], 0, true);
    expect(stateEvents(m, folded)).toEqual([{ type: "pazuru-collapse", detail: { views: ["a"], path: [], index: 0 } }]);
    expect(stateEvents(folded, ops.fold(folded, [], 0, false))).toEqual([{ type: "pazuru-expand", detail: { views: ["a"], path: [], index: 0 } }]);
  });

  it("derives popout and popin", () => {
    const m = layout();
    const out = ops.goOutside(m, "b", "w1");
    expect(types(m, out)).toEqual(['pazuru-popout {"id":"b","window":"w1"}']);
    expect(types(out, ops.comeInside(out, "b"))).toEqual(['pazuru-popin {"id":"b"}']);
  });
});

async function mount(model = layout()): Promise<PazuruManager> {
  const el = document.createElement("pazuru-manager");
  for (const id of Object.keys(views)) {
    const d = document.createElement("div");
    d.dataset["view"] = id;
    el.append(d);
  }
  document.body.append(el);
  el.model = model;
  await el.updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("manager events", () => {
  it("fires state events alongside pazuru-change, but not for model assignment", async () => {
    const el = await mount();
    const log: string[] = [];
    for (const t of ["pazuru-change", "pazuru-float", "pazuru-dock", "pazuru-stow", "pazuru-collapse"] as const) {
      el.addEventListener(t, () => log.push(t));
    }
    el.model = layout();
    expect(log).toEqual(["pazuru-change"]);
    log.length = 0;
    el.detach("a");
    expect(log).toEqual(["pazuru-change", "pazuru-float"]);
    el.foldView("b");
    el.stow("d");
    expect(log.slice(2)).toEqual(["pazuru-change", "pazuru-collapse", "pazuru-change", "pazuru-stow"]);
  });

  it("fires close after a dismiss, and none when vetoed", async () => {
    const el = await mount();
    const closed: string[] = [];
    el.addEventListener("pazuru-close", (e) => closed.push(e.detail.id));
    el.addEventListener("pazuru-beforeclose", (e) => e.detail.id === "a" && e.preventDefault());
    await el.dismiss("a");
    await el.dismiss("d");
    el.dismissMany(["b", "c"]);
    expect(closed).toEqual(["d", "b", "c"]);
  });

  it("fires viewshow (with first) and viewhide as tabs switch", async () => {
    const el = await mount();
    const log: string[] = [];
    el.addEventListener("pazuru-viewshow", (e) => log.push(`show ${e.detail.id} ${e.detail.first}`));
    el.addEventListener("pazuru-viewhide", (e) => log.push(`hide ${e.detail.id}`));
    el.reveal("c");
    await el.updateComplete;
    el.reveal("b");
    await el.updateComplete;
    expect(log).toEqual(["show c true", "hide b", "show b false", "hide c"]);
  });

  it("lets pazuru-beforeadd veto addView and fires viewremove on removeView", async () => {
    const el = await mount();
    const seen: unknown[] = [];
    el.addEventListener("pazuru-beforeadd", (e) => {
      seen.push(e.detail);
      if (e.detail.id === "no") e.preventDefault();
    });
    el.addView("no", "nope", { at: "parked" });
    expect(el.hasView("no")).toBe(false);
    el.addView("yes", "fine", { title: "Yes", at: "parked" });
    expect(el.hasView("yes")).toBe(true);
    expect(seen).toEqual([{ id: "no", title: "no", at: "parked" }, { id: "yes", title: "Yes", at: "parked" }]);
    const removed: string[] = [];
    el.addEventListener("pazuru-viewremove", (e) => removed.push(e.detail.id));
    el.removeView("yes");
    expect(removed).toEqual(["yes"]);
  });

  it("lets pazuru-command veto tab menu commands", async () => {
    const el = await mount();
    const cmds: string[] = [];
    el.addEventListener("pazuru-command", (e) => {
      cmds.push(`${e.detail.source}:${e.detail.command}:${e.detail.custom}`);
      if (e.detail.command === "pin") e.preventDefault();
    });
    const ask = (action: string, detail: Record<string, unknown>) =>
      el.shadowRoot!.querySelector("[data-stack]")!.dispatchEvent(new CustomEvent("pazuru-request", { detail: { action, ...detail }, bubbles: true, composed: true }));
    ask("tab-menu", { id: "b", keyboard: true });
    await el.updateComplete;
    const items = (el as unknown as { _tabMenu: { items: Array<{ key?: string } | string> } })._tabMenu.items;
    const pinAt = items.findIndex((i) => typeof i === "object" && i.key === "pin");
    ask("tab-menu-choose", { id: "b", index: pinAt });
    expect(el.hasPin("b")).toBe(false);
    ask("float", { id: "d", fromMenu: true });
    expect(cmds).toEqual(["tab-menu:pin:false", "pane-menu:float:false"]);
    expect(el.model.windows).toHaveLength(1);
  });
});
