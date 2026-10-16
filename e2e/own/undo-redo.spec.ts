import { expect, test } from "./helpers/index.js";

test.describe("undo and redo", () => {
  test("every structural change is undoable and redoable @smoke", async ({ dock }) => {
    const start = await dock.order("main");
    await dock.dragTabToZone("notes.md", "log", "right");
    await expect(dock.stack("notes")).toBeVisible();
    await dock.call("undo");
    await expect(dock.stack("notes")).toHaveCount(0);
    expect(await dock.order("main")).toEqual(start);
    await dock.call("redo");
    await expect(dock.stack("notes")).toBeVisible();
  });

  test("Ctrl+Alt+Z undoes and Ctrl+Alt+Y redoes", async ({ dock, page }) => {
    await dock.call("detach", "props", { x: 300, y: 150, w: 300, h: 200 });
    await expect(dock.windows()).toHaveCount(1);
    await dock.tab("main.ts").click();
    await page.keyboard.press("Control+Alt+z");
    await expect(dock.windows()).toHaveCount(0);
    await page.keyboard.press("Control+Alt+y");
    await expect(dock.windows()).toHaveCount(1);
  });

  test("selecting tabs and focusing are not recorded", async ({ dock }) => {
    await dock.call("detach", "props", { x: 300, y: 150, w: 300, h: 200 });
    await dock.tab("notes.md").click();
    await dock.tab("readme.md").click();
    await dock.call("undo");
    await expect(dock.windows()).toHaveCount(0);
  });

  test("a splitter drag is a single undo step", async ({ dock }) => {
    const w0 = await dock.width(dock.stack("files"));
    await dock.dragGutter(0, 90);
    await expect.poll(() => dock.width(dock.stack("files"))).toBeGreaterThan(w0 + 60);
    await dock.call("undo");
    await expect.poll(() => dock.width(dock.stack("files"))).toBeLessThan(w0 + 5);
  });

  test("a new change after an undo clears the redo history", async ({ dock }) => {
    await dock.call("stow", "props");
    await dock.call("undo");
    await dock.call("stow", "log");
    await dock.call("redo");
    expect(Object.values((await dock.model())["drawers"]).flat()).toEqual(["log"]); // props stayed undone
  });

  test("closing a tab is undoable and brings it back in place", async ({ dock }) => {
    await dock.tabOf("notes").locator('[part~="tab-close"]').click();
    await expect(dock.tab("notes.md")).toHaveCount(0);
    await dock.call("undo");
    await expect(dock.tab("notes.md")).toBeVisible();
    expect(await dock.order("main")).toEqual(["main", "notes", "readme"]);
  });

  test("undo of an addView removes it again and change reasons are reported", async ({ dock }) => {
    await dock.call("addView", "extra", "extra text", { title: "Extra", at: { near: "main", zone: "into" } });
    await expect(dock.tab("Extra")).toBeVisible();
    expect((await dock.events("change")).at(-1)!.detail).toEqual({ reason: "add" });
    await dock.call("undo");
    await expect(dock.tab("Extra")).toHaveCount(0);
    expect((await dock.events("change")).at(-1)!.detail).toMatchObject({ reason: expect.stringMatching(/undo/) });
  });

  test("undo with nothing to undo does nothing and does not throw", async ({ dock }) => {
    await dock.call("undo");
    await dock.call("redo");
    await expect(dock.stacks()).toHaveCount(4);
  });

  test("the palette shows undo/redo commands", async ({ dock }) => {
    await dock.call("openPalette");
    await expect(dock.el.locator("dockorama-palette").getByRole("option", { name: /Undo/ })).toBeVisible();
  });
});
