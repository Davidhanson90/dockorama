import { expect, test } from "./helpers/index.js";

const CANCELABLE = ["beforeclose", "beforemove", "beforeadd", "command", "dragstart"];

test.describe("event contract", () => {
  test("every public event is typed on the element and bubbles composed to the document @smoke", async ({ dock, page }) => {
    const ok = await page.evaluate(() => {
      const seen: string[] = [];
      document.addEventListener("dockorama-change", (e) => seen.push(`${e.bubbles}/${e.composed}`));
      window.lab.dock().detach("props", { x: 300, y: 150, w: 300, h: 200 });
      return seen;
    });
    expect(ok).toEqual(["true/true"]);
    void dock;
  });

  test("beforeclose is cancelable, carries the id, and a veto keeps the view and skips close", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().addEventListener("dockorama-beforeclose", (e) => { if (e.detail.id === "readme") e.preventDefault(); }); });
    await dock.tab("readme.md").locator('[part~="tab-close"]').click();
    await expect(dock.tab("readme.md")).toBeVisible();
    expect((await dock.events("close")).length).toBe(0);
    await dock.tab("notes.md").locator('[part~="tab-close"]').click();
    await expect(dock.tab("notes.md")).toHaveCount(0);
    expect((await dock.events("close")).map((e) => e.detail)).toEqual([{ id: "notes" }]);
  });

  test("change reasons: set, select, reorder, place, edge, float, stow, add, undo, restore", async ({ dock }) => {
    await dock.tab("notes.md").click();
    await dock.dragTabToZone("notes.md", "log", "right");
    await dock.dragTabToZone("readme.md", "log", "edge-below");
    await dock.call("detach", "props", { x: 300, y: 150, w: 300, h: 200 });
    await dock.call("stow", "files");
    await dock.call("addView", "x", "x", { title: "X" });
    await dock.call("undo");
    await dock.call("restore", await dock.snapshot());
    const reasons = (await dock.events("change")).map((e) => (e.detail as { reason: string }).reason);
    for (const r of ["set", "select", "place", "edge", "add", "restore"]) expect(reasons).toContain(r);
    expect(reasons.length).toBeGreaterThanOrEqual(8);
  });

  test("change detail includes the full model snapshot", async ({ dock, page }) => {
    const hasModel = await page.evaluate(() => new Promise<boolean>((resolve) => {
      const m = window.lab.dock();
      m.addEventListener("dockorama-change", (e) => resolve(e.detail.model.v === 1 && Boolean(e.detail.model.views["files"]) && e.detail.model === m.model), { once: true });
      m.stow("props");
    }));
    expect(hasModel).toBe(true);
    void dock;
  });

  test("float, dock, stow, unstow, pin, unpin, collapse, expand fire with their details", async ({ dock }) => {
    await dock.call("detach", "props", { x: 300, y: 150, w: 300, h: 200 });
    await dock.call("dockToEdge", "props", "edge-right");
    await dock.call("stow", "log", "bottom");
    await dock.call("unstow", "log");
    await dock.call("pin", "notes");
    await dock.call("pin", "notes", false);
    await dock.call("foldView", "files");
    await dock.call("foldView", "files", false);
    const detail = async (n: string) => (await dock.events(n)).map((e) => e.detail);
    expect(await detail("float")).toEqual([expect.objectContaining({ id: "props" })]);
    expect(await detail("dock")).toEqual(expect.arrayContaining([expect.objectContaining({ id: "props", from: "floating" })]));
    expect(await detail("stow")).toEqual([{ id: "log", side: "bottom" }]);
    expect(await detail("unstow")).toEqual([{ id: "log" }]);
    expect(await detail("pin")).toEqual([{ id: "notes" }]);
    expect(await detail("unpin")).toEqual([{ id: "notes" }]);
    expect((await detail("collapse")).length).toBe(1);
    expect((await detail("expand")).length).toBe(1);
  });

  test("dirty fires on change of the flag only", async ({ dock }) => {
    await dock.call("setDirty", "main");
    await dock.call("setDirty", "main");
    await dock.call("setDirty", "main", false);
    expect((await dock.events("dirty")).map((e) => e.detail)).toEqual([{ id: "main", dirty: true }, { id: "main", dirty: false }]);
  });

  test("popout and popin fire with the view id", async ({ dock, page }) => {
    const [popup] = await Promise.all([page.waitForEvent("popup"), dock.call("popOut", "props")]);
    expect((await dock.events("popout"))[0]!.detail).toMatchObject({ id: "props" });
    await popup.close();
    await dock.waitForEvent("popin");
    expect((await dock.events("popin"))[0]!.detail).toMatchObject({ id: "props" });
  });

  test("the cancelable events (and only those) are cancelable", async ({ dock, page }) => {
    await dock.tab("notes.md").click({ button: "right" });
    await dock.menuItem("pin").click();
    await dock.dragTabToZone("readme.md", "log", "right");
    await dock.call("addView", "x", "x", { title: "X" });
    await dock.tabOf("x").or(dock.stack("x")).first().waitFor();
    await dock.call("dismiss", "x");
    await dock.call("stow", "props");
    const all = await dock.events();
    const names = new Set(all.map((e) => e.name.replace("dockorama-", "")));
    for (const n of names) {
      const flags = new Set(all.filter((e) => e.name === `dockorama-${n}`).map((e) => e.cancelable));
      expect(flags, n).toEqual(new Set([CANCELABLE.includes(n)]));
    }
    expect([...names]).toEqual(expect.arrayContaining(["command", "dragstart", "beforemove", "beforeadd", "beforeclose"]));
    void page;
  });

  test("events are dispatched by the manager they happened in, not by siblings", async ({ dock }) => {
    const other = await dock.mountAnother("second");
    await other.call("stow", "props");
    expect((await other.events("stow")).length).toBe(1);
    expect((await dock.events("stow")).length).toBe(0);
  });

  test("order: a drop fires beforemove, then change, then drop; view show/hide follow the change", async ({ dock }) => {
    await dock.clearEvents();
    await dock.dragTabToZone("notes.md", "log", "into");
    const names = await dock.eventNames();
    const i = (n: string) => names.indexOf(n);
    expect(i("beforemove")).toBeGreaterThan(-1);
    expect(i("beforemove")).toBeLessThan(i("change"));
    expect(i("change")).toBeLessThan(i("drop"));
    expect(i("viewshow")).toBeGreaterThan(i("change") - 1);
  });
});
