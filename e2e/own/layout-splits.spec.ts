import { expect, test } from "./helpers/index.js";
import { Dock } from "./helpers/index.js";

test.describe("layout and splits", () => {
  test("renders the standard layout as nested splits with one group per stack @smoke", async ({ dock }) => {
    await expect(dock.stacks()).toHaveCount(4);
    await expect(dock.stack("files")).toBeVisible();
    await expect(dock.stack("main")).toBeVisible();
    await expect(dock.stack("log")).toBeVisible();
    await expect(dock.gutters()).toHaveCount(3);
    const files = (await dock.stack("files").boundingBox())!;
    const main = (await dock.stack("main").boundingBox())!;
    const props = (await dock.stack("props").boundingBox())!;
    expect(files.x).toBeLessThan(main.x);
    expect(main.x).toBeLessThan(props.x);
    const log = (await dock.stack("log").boundingBox())!;
    expect(log.y).toBeGreaterThan(main.y + main.height - 2);
  });

  test("initial weights decide the proportions", async ({ dock }) => {
    const [w1, w2, w3] = [await dock.width(dock.stack("files")), await dock.width(dock.stack("main")), await dock.width(dock.stack("props"))];
    expect(w2 / w1).toBeGreaterThan(2.5);
    expect(w2 / w1).toBeLessThan(3.5);
    expect(Math.abs(w1 - w3)).toBeLessThan(4);
  });

  test("dragging a splitter resizes both neighbours and keeps the total", async ({ dock }) => {
    const [a0, b0] = [await dock.width(dock.stack("files")), await dock.width(dock.stack("main"))];
    await dock.dragGutter(0, 100);
    await expect.poll(() => dock.width(dock.stack("files"))).toBeGreaterThan(a0 + 80);
    const [a1, b1] = [await dock.width(dock.stack("files")), await dock.width(dock.stack("main"))];
    expect(Math.abs(a1 + b1 - (a0 + b0))).toBeLessThan(4);
    expect((await dock.model())["root"].weights[0]).toBeGreaterThan(1);
  });

  test("dragging the horizontal splitter resizes the documents and output groups", async ({ dock }) => {
    const h0 = await dock.height(dock.stack("log"));
    await dock.dragGutter(1, 0, -80);
    await expect.poll(() => dock.height(dock.stack("log"))).toBeGreaterThan(h0 + 60);
  });

  test("a resize fires dockorama-resizing while dragging and dockorama-resize when done", async ({ dock }) => {
    await dock.dragGutter(0, 60);
    await dock.waitForEvent("resize");
    expect((await dock.events("resizing")).length).toBeGreaterThan(0);
    const names = await dock.eventNames();
    expect(names.lastIndexOf("resizing")).toBeLessThan(names.lastIndexOf("resize"));
  });

  test("keyboard: arrow keys, Home and End resize a focused splitter", async ({ dock }) => {
    const gutter = dock.gutters().first();
    await gutter.focus();
    const w0 = await dock.width(dock.stack("files"));
    await page(dock).keyboard.press("ArrowRight");
    await expect.poll(() => dock.width(dock.stack("files"))).toBeGreaterThan(w0);
    const w1 = await dock.width(dock.stack("files"));
    await page(dock).keyboard.press("ArrowLeft");
    await expect.poll(() => dock.width(dock.stack("files"))).toBeLessThan(w1);
    await page(dock).keyboard.press("End");
    await expect.poll(() => dock.width(dock.stack("files"))).toBeGreaterThan(w0 * 2);
    await page(dock).keyboard.press("Home");
    await expect.poll(() => dock.width(dock.stack("files"))).toBeLessThan(w0);
  });

  test("a splitter reports its position through aria-valuenow", async ({ dock }) => {
    const gutter = dock.gutters().first();
    const before = Number(await gutter.getAttribute("aria-valuenow"));
    await dock.dragGutter(0, 80);
    await expect.poll(async () => Number(await gutter.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
  });

  test("double-click collapses the smaller neighbour and again restores it", async ({ dock }) => {
    const w0 = await dock.width(dock.stack("files"));
    await dock.gutters().first().dblclick();
    await expect.poll(() => dock.call<boolean>("isFolded", "files")).toBe(true);
    await expect.poll(() => dock.width(dock.stack("files"))).toBeLessThan(w0 / 2);
    expect((await dock.events("collapse")).length).toBe(1);
    await dock.gutters().first().dblclick();
    await expect.poll(() => dock.call<boolean>("isFolded", "files")).toBe(false);
    await expect.poll(() => dock.width(dock.stack("files"))).toBeGreaterThan(w0 - 6);
    expect((await dock.events("expand")).length).toBe(1);
  });

  test("Enter on a focused splitter collapses and restores", async ({ dock, page }) => {
    await dock.gutters().first().focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => dock.call<boolean>("isFolded", "files")).toBe(true);
    await page.keyboard.press("Enter");
    await expect.poll(() => dock.call<boolean>("isFolded", "files")).toBe(false);
  });

  test("foldView / isFolded work from code and are stored in the model", async ({ dock }) => {
    await dock.call("foldView", "props");
    expect(await dock.call("isFolded", "props")).toBe(true);
    expect(JSON.stringify((await dock.model())["root"].folded)).toContain("true");
    await dock.call("foldView", "props", false);
    expect(await dock.call("isFolded", "props")).toBe(false);
  });

  test("fixViewSize keeps a pixel size when the dock is resized, null makes it proportional again", async ({ dock, page }) => {
    await dock.call("fixViewSize", "files", 240);
    await expect.poll(() => dock.width(dock.stack("files"))).toBeCloseTo(240, -1);
    await page.evaluate(() => { document.getElementById("stage")!.style.width = "1000px"; });
    await expect.poll(() => dock.width(dock.stack("files"))).toBeCloseTo(240, -1);
    await dock.call("fixViewSize", "files", null);
    await page.evaluate(() => { document.getElementById("stage")!.style.width = "1200px"; });
    await expect.poll(() => dock.width(dock.stack("files"))).toBeLessThan(260);
    expect((await dock.model())["root"].fixed?.[0] ?? null).toBeNull();
  });

  test("limitViewSize stops a drag at the minimum and maximum", async ({ dock }) => {
    await dock.call("limitViewSize", "files", { min: 150, max: 260 });
    await dock.dragGutter(0, 500);
    await expect.poll(() => dock.width(dock.stack("files"))).toBeLessThanOrEqual(262);
    await dock.dragGutter(0, -600);
    await expect.poll(() => dock.width(dock.stack("files"))).toBeGreaterThanOrEqual(148);
    expect((await dock.model())["root"].limits[0]).toEqual({ min: 150, max: 260 });
  });

  test("an empty dock shows nothing but a manager can be given a model later", async ({ page }) => {
    const d = await Dock.mount(page, { model: undefined, name: "main" });
    await d.call("restore", { v: 1, views: {}, root: null, windows: [], drawers: { start: [], end: [], top: [], bottom: [] }, parked: [] });
    await expect(d.stacks()).toHaveCount(0);
    await d.call("addView", "late", "I came late", { title: "Late" });
    await expect(d.stack("late")).toContainText("Late");
  });

  test("three levels of nesting render and each leaf is reachable", async ({ page }) => {
    const d = await Dock.mountWith(page, ({ dk }) => ({
      model: dk.createModel(
        { a: { title: "A" }, b: { title: "B" }, c: { title: "C" }, d: { title: "D" }, e: { title: "E" } },
        dk.row([dk.stack(["a"]), dk.column([dk.stack(["b"]), dk.row([dk.stack(["c"]), dk.column([dk.stack(["d"]), dk.stack(["e"])], [1, 1])], [1, 1])], [1, 2])], [1, 2])
      )
    }), null);
    await expect(d.stacks()).toHaveCount(5);
    for (const id of "abcde") expect((await d.stack(id).boundingBox())!.width).toBeGreaterThan(40);
  });

  test("two managers on one page lay out independently", async ({ dock, page }) => {
    const other = await dock.mountAnother("second");
    await expect(other.el).toBeAttached();
    await page.evaluate(() => { const m = document.getElementById("second")!; m.style.cssText = "position:absolute;left:0;top:0;width:300px;height:200px"; });
    await expect(other.stacks()).toHaveCount(4);
    await expect(dock.stacks()).toHaveCount(4);
  });
});

const page = (d: Dock) => d.page;
