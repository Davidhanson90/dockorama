import { describe, expect, it } from "vitest";
import { Timeline } from "./history.js";
import { Workspaces } from "./workspaces.js";
import { createModel, stack } from "./ops.js";

describe("Timeline", () => {
  it("undoes and redoes with a limit", () => {
    const t = new Timeline<number>(2);
    expect(t.undo(0)).toBeUndefined();
    t.push(1);
    t.push(2);
    t.push(3);
    expect(t.undo(4)).toBe(3);
    expect(t.canRedo).toBe(true);
    expect(t.redo(3)).toBe(4);
    expect(t.redo(4)).toBeUndefined();
    expect(t.undo(4)).toBe(3);
    expect(t.undo(3)).toBe(2);
    expect(t.canUndo).toBe(false);
    t.clear();
    expect(t.canRedo).toBe(false);
  });
});

describe("Workspaces", () => {
  it("saves, lists, loads and removes", () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const ws = new Workspaces("k", store);
    const m = createModel({ a: { title: "A" } }, stack(["a"]));
    ws.save("one", m);
    expect(ws.names()).toEqual(["one"]);
    expect(ws.load("one")).toEqual(m);
    expect(ws.load("none")).toBeUndefined();
    ws.remove("one");
    expect(ws.names()).toEqual([]);
    mem.set("k", "{bad");
    expect(ws.names()).toEqual([]);
  });
});
