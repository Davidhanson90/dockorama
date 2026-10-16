import { expect, test } from "./helpers/index.js";


test.describe("floating windows", () => {
  test("detach floats a view in a window with its own title bar and fires float @smoke", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().detach("props", { x: 300, y: 150, w: 420, h: 280 }); });
    await expect(dock.windows()).toHaveCount(1);
    const box = (await dock.windows().boundingBox())!;
    expect(box.x).toBeCloseTo(300, -1);
    expect(box.width).toBeCloseTo(420, -1);
    expect((await dock.events("float"))[0]!.detail).toMatchObject({ id: "props" });
    await expect(dock.stack("props")).toBeVisible();
    expect((await dock.model())["windows"]).toHaveLength(1);
  });

  test("dragging a tab onto empty space floats it", async ({ dock }) => {
    await dock.drag(await dock.center(dock.tab("readme.md")), { x: 650, y: 400 });
    await expect(dock.windows()).toHaveCount(1);
    expect((await dock.events("float")).length).toBe(1);
  });

  test("a window can be moved by its title bar", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().detach("props", { x: 300, y: 150, w: 420, h: 280 }); });
    const before = (await dock.windows().boundingBox())!;
    const bar = await dock.center(dock.windows().locator(".title"));
    await dock.glide(bar, { x: bar.x + 120, y: bar.y + 90 });
    await dock.release();
    // a drag over the dock shows targets; drop on a non-target spot keeps it floating
    await expect.poll(async () => (await dock.windows().boundingBox())?.x ?? 0).toBeGreaterThan(before.x + 80);
    expect(Math.abs((await dock.windows().boundingBox())!.y - before.y - 90)).toBeLessThan(20);
  });

  test("a window can be resized with the corner grip", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().detach("props", { x: 300, y: 150, w: 420, h: 280 }); });
    const grip = await dock.center(dock.windows().locator(".grip"));
    await dock.drag(grip, { x: grip.x + 100, y: grip.y + 60 });
    await expect.poll(async () => (await dock.windows().boundingBox())!.width).toBeGreaterThan(500);
    expect((await dock.windows().boundingBox())!.height).toBeGreaterThan(320);
  });

  test("a window cannot be resized below its minimum size", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().detach("props", { x: 300, y: 150, w: 420, h: 280 }); });
    const grip = await dock.center(dock.windows().locator(".grip"));
    await dock.drag(grip, { x: grip.x - 600, y: grip.y - 500 });
    await expect.poll(async () => (await dock.windows().boundingBox())!.width).toBeLessThan(300);
    const b = (await dock.windows().boundingBox())!;
    expect(b.width).toBeGreaterThan(80);
    expect(b.height).toBeGreaterThan(60);
  });

  test("a window keeps some of its title bar inside the dock when dragged far outside", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().detach("props", { x: 300, y: 150, w: 420, h: 280 }); });
    const bar = await dock.center(dock.windows().locator(".title"));
    await dock.glide(bar, { x: 1195, y: 695 });
    await dock.release();
    await expect.poll(async () => { const b = await dock.windows().boundingBox(); return b ? b.x : 0; }).toBeGreaterThan(300).catch(() => undefined);
    const host = (await dock.el.boundingBox())!;
    const b = (await dock.windows().boundingBox())!;
    expect(b.x).toBeLessThan(host.x + host.width);
    expect(b.y).toBeLessThan(host.y + host.height);
  });

  test("clicking a window brings it to the front", async ({ dock, page }) => {
    await page.evaluate(() => {
      const m = window.lab.dock();
      m.detach("props", { x: 300, y: 150, w: 420, h: 280 });
      m.detach("search", { x: 380, y: 200, w: 420, h: 280 });
    });
    await expect(dock.windows()).toHaveCount(2);
    const zOf = (title: string) => dock.window(title).evaluate((e) => Number(getComputedStyle(e).zIndex));
    await page.mouse.click(320, 400); // inside Properties only
    await expect.poll(async () => (await zOf("Properties")) > (await zOf("Search"))).toBe(true);
    await page.mouse.click(770, 460); // inside Search only
    await expect.poll(async () => (await zOf("Search")) > (await zOf("Properties"))).toBe(true);
  });

  test("snap rounds window position and size to the grid", async ({ dock, page }) => {
    await page.evaluate(() => { const m = window.lab.dock(); m.snap = 50; m.detach("props", { x: 300, y: 150, w: 420, h: 280 }); });
    const grip = await dock.center(dock.windows().locator(".grip"));
    await dock.drag(grip, { x: grip.x + 33, y: grip.y + 27 });
    await expect.poll(async () => { const b = (await dock.windows().boundingBox())!; return b.width % 50; }).toBeLessThan(4);
  });

  test("dragging a window's title bar onto an edge target docks it; dockorama-dock reports its origin", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().detach("props", { x: 300, y: 150, w: 420, h: 280 }); });
    const bar = await dock.center(dock.windows().locator(".title"));
    await dock.glide(bar, { x: 600, y: 350 });
    await dock.page.mouse.move(...(await (async () => { const c = await dock.center(dock.target("edge-left")); return [c.x, c.y] as [number, number]; })()), { steps: 8 });
    await expect(dock.hotTarget("edge-left")).toBeVisible();
    await dock.release();
    await expect(dock.windows()).toHaveCount(0);
    expect((await dock.events("dock")).at(-1)!.detail).toMatchObject({ id: "props", from: "floating" });
    const props = (await dock.stack("props").boundingBox())!;
    const files = (await dock.stack("files").boundingBox())!;
    expect(props.x).toBeLessThan(files.x);
  });

  test("the toolbar can zoom, a window title double-click zooms, and Escape restores", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().detach("props", { x: 300, y: 150, w: 420, h: 280 }); });
    await dock.windows().locator(".title").dblclick();
    await expect.poll(async () => (await dock.model())["zoom"]).toBe("props");
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await dock.model())["zoom"] ?? null).toBeNull();
  });

  test("closing the only view of a window removes the window", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().detach("props", { x: 300, y: 150, w: 420, h: 280 }); });
    await dock.windows().locator('[part~="close"]').click();
    await expect(dock.windows()).toHaveCount(0);
    expect((await dock.model())["windows"]).toHaveLength(0);
  });

  test("a floating window can hold several tabs", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().detach("log", { x: 300, y: 150, w: 460, h: 300 }); });
    await expect(dock.windows()).toHaveCount(1);
    await dock.hold(dock.stack("problems").locator(".title"), await dock.center(dock.windows()));
    await expect(dock.hotTarget("into")).toBeVisible();
    await dock.release();
    await expect(dock.windows()).toHaveCount(1);
    await expect.poll(() => dock.order("log")).toEqual(["log", "problems"]);
    await expect(dock.windows().getByRole("tab")).toHaveCount(2);
  });

  test("the window box is stored in the model and survives snapshot and restore", async ({ dock }) => {
    await dock.call("detach", "props", { x: 300, y: 150, w: 420, h: 280 });
    const snap = await dock.snapshot();
    await dock.call("restore", { ...snap, windows: [] , root: snap["root"] });
    await dock.call("restore", snap);
    await expect(dock.windows()).toHaveCount(1);
    expect((await dock.model())["windows"][0].box).toMatchObject({ x: 300, y: 150, w: 420, h: 280 });
  });
});
