import { expect, test, Dock, type Zone } from "./helpers/index.js";

const ZONES: Array<[Zone, string]> = [["left", "left"], ["right", "right"], ["above", "above"], ["below", "below"]];

test.describe("drag and drop", () => {
  for (const [zone] of ZONES) {
    test(`dropping on the ${zone} target of a group puts the tab ${zone} of it @smoke`, async ({ dock }) => {
      await dock.dragTabToZone("notes.md", "log", zone);
      await expect(dock.stack("notes")).toBeVisible();
      const a = (await dock.stack("notes").boundingBox())!;
      const b = (await dock.stack("log").boundingBox())!;
      if (zone === "left") expect(a.x + a.width).toBeLessThanOrEqual(b.x + 2);
      if (zone === "right") expect(a.x).toBeGreaterThanOrEqual(b.x + b.width - 2);
      if (zone === "above") expect(a.y + a.height).toBeLessThanOrEqual(b.y + 2);
      if (zone === "below") expect(a.y).toBeGreaterThanOrEqual(b.y + b.height - 2);
      expect((await dock.events("change")).at(-1)!.detail).toEqual({ reason: "place" });
    });
  }

  test("dropping on the centre target joins the group as a tab", async ({ dock }) => {
    await dock.dragTabToZone("notes.md", "log", "into");
    await expect.poll(() => dock.order("log")).toEqual(["log", "problems", "notes"]);
    await expect(dock.selectedTab().filter({ hasText: "notes.md" })).toBeVisible();
  });

  for (const zone of ["edge-left", "edge-right", "edge-above", "edge-below"] as Zone[]) {
    test(`the outer ${zone} target docks the tab to the dock's edge`, async ({ dock }) => {
      await dock.dragTabToZone("notes.md", "log", zone);
      await expect(dock.stack("notes")).toBeVisible();
      const n = (await dock.stack("notes").boundingBox())!;
      const host = (await dock.el.boundingBox())!;
      if (zone === "edge-left") expect(n.x).toBeLessThan(host.x + 30);
      if (zone === "edge-right") expect(n.x + n.width).toBeGreaterThan(host.x + host.width - 30);
      if (zone === "edge-above") expect(n.y).toBeLessThan(host.y + 30);
      if (zone === "edge-below") expect(n.y + n.height).toBeGreaterThan(host.y + host.height - 30);
      expect((await dock.events("change")).at(-1)!.detail).toEqual({ reason: "edge" });
    });
  }

  test("while hovering a target a preview shows where the view will land", async ({ dock }) => {
    await dock.dragTabToZone("notes.md", "log", "right", false);
    const preview = dock.el.locator(".preview");
    await expect(preview).toBeVisible();
    const p = (await preview.boundingBox())!;
    const log = (await dock.stack("log").boundingBox())!;
    expect(p.x).toBeGreaterThan(log.x + log.width / 2 - 5);
    await dock.release();
  });

  test("the drag fires dragstart, dragover and drop with details, and change after the drop", async ({ dock }) => {
    await dock.clearEvents();
    await dock.dragTabToZone("notes.md", "log", "right");
    const names = await dock.eventNames();
    expect(names.indexOf("dragstart")).toBeLessThan(names.indexOf("dragover"));
    expect(names.indexOf("dragover")).toBeLessThan(names.indexOf("drop"));
    expect(names.indexOf("beforemove")).toBeLessThan(names.indexOf("change"));
    expect(names.indexOf("change")).toBeLessThan(names.indexOf("drop") + 1);
    expect((await dock.events("dragstart"))[0]!.detail).toEqual({ id: "notes", kind: "tab" });
    expect((await dock.events("dragstart"))[0]!.cancelable).toBe(true);
    expect((await dock.events("drop"))[0]!.detail).toMatchObject({ id: "notes", spot: "right", target: "log", moved: true });
    expect((await dock.events("beforemove"))[0]!.detail).toEqual({ id: "notes", target: "log", zone: "right" });
  });

  test("Escape cancels a drag: nothing moves and dragcancel fires", async ({ dock, page }) => {
    const before = JSON.stringify(await dock.order("main"));
    await dock.dragTabToZone("notes.md", "log", "right", false);
    await page.keyboard.press("Escape");
    await dock.release();
    expect(JSON.stringify(await dock.order("main"))).toBe(before);
    expect((await dock.events("dragcancel")).length).toBe(1);
    expect((await dock.events("drop")).length).toBe(0);
    await expect(dock.el.locator(".preview")).toHaveCount(0);
  });

  test("preventDefault on beforemove vetoes the drop; the view stays where it was", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().addEventListener("dockorama-beforemove", (e) => e.preventDefault()); });
    await dock.dragTabToZone("notes.md", "log", "right");
    expect(await dock.order("main")).toEqual(["main", "notes", "readme"]);
    expect((await dock.events("beforemove")).length).toBe(1);
  });

  // KNOWN ISSUE: dockorama-drop reports moved:true although a beforemove veto kept the view in place.
  test("a vetoed drop reports moved:false in the drop event", async ({ dock, page }) => {
    test.fail(true, "dockorama-drop says moved:true after a beforemove veto");
    await page.evaluate(() => { window.lab.dock().addEventListener("dockorama-beforemove", (e) => e.preventDefault()); });
    await dock.dragTabToZone("notes.md", "log", "right");
    expect((await dock.events("drop"))[0]!.detail).toMatchObject({ moved: false });
  });

  test("preventDefault on dragstart stops the drag from starting", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().addEventListener("dockorama-dragstart", (e) => e.preventDefault()); });
    await dock.hold(dock.tab("notes.md"), { x: 700, y: 450 });
    await expect(dock.el.locator(".target")).toHaveCount(0);
    await dock.release();
    expect(await dock.order("main")).toEqual(["main", "notes", "readme"]);
  });

  test("a view with caps.move=false cannot be dragged", async ({ dock }) => {
    await dock.call("addView", "pinned", "fixed", { title: "Fixed", caps: { move: false }, at: { near: "log", zone: "into" } });
    await dock.hold(dock.tab("Fixed"), { x: 700, y: 200 });
    await expect(dock.el.locator(".target")).toHaveCount(0);
    await dock.release();
    expect(await dock.order("pinned")).toContain("pinned");
  });

  test("dropping on a splitter gap slots the view between the two groups", async ({ dock }) => {
    const gutter = dock.gutters().first();
    await dock.hold(dock.tab("notes.md"), await dock.center(gutter));
    await expect(dock.el.locator(".gutter[data-drop]")).toHaveCount(1);
    await dock.release();
    await expect(dock.stack("notes")).toBeVisible();
    const f = (await dock.stack("files").boundingBox())!;
    const n = (await dock.stack("notes").boundingBox())!;
    const m = (await dock.stack("main").boundingBox())!;
    expect(f.x).toBeLessThan(n.x);
    expect(n.x).toBeLessThan(m.x);
  });

  test("dropping outside every target floats the view; an empty document area accepts a drop", async ({ dock }) => {
    await dock.drag(await dock.center(dock.tab("notes.md")), { x: 650, y: 420 });
    await expect(dock.windows()).toHaveCount(1);
  });

  test("a single-view group's title bar can be dragged to re-dock it", async ({ dock }) => {
    await dock.hold(dock.stack("props").locator(".title"), await dock.center(dock.stack("log")));
    await dock.page.mouse.move(...(await (async () => { const c = await dock.center(dock.target("right")); return [c.x, c.y] as [number, number]; })()), { steps: 6 });
    await expect(dock.hotTarget("right")).toBeVisible();
    await dock.release();
    const p = (await dock.stack("props").boundingBox())!;
    const l = (await dock.stack("log").boundingBox())!;
    expect(p.x).toBeGreaterThanOrEqual(l.x + l.width - 2);
  });

  test("touch: dragging a tab with a finger docks it", async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1300, height: 760 } });
    const page = await ctx.newPage();
    const d = await Dock.mount(page);
    await d.dragTabToZone("notes.md", "log", "right");
    await expect(d.stack("notes")).toBeVisible();
    await ctx.close();
  });

  test("dragging a tab shows ghost and targets only for the manager under the pointer", async ({ dock }) => {
    await dock.hold(dock.tab("notes.md"), await dock.center(dock.stack("log")));
    await expect(dock.el.locator(".ghost")).toBeVisible();
    await expect(dock.el.locator(".target")).toHaveCount(9);
    await dock.release();
    await expect(dock.el.locator(".ghost")).toHaveCount(0);
  });
});
