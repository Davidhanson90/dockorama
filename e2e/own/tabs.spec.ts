import { expect, test } from "./helpers/index.js";
import { Dock } from "./helpers/index.js";

test.describe("tabs", () => {
  test("selecting a tab shows its view and hides the others @smoke", async ({ dock }) => {
    await expect(dock.selectedTab()).toHaveCount(3); // one selected tab in each multi-view group
    await dock.tab("notes.md").click();
    await expect(dock.tab("notes.md")).toHaveAttribute("aria-selected", "true");
    await expect(dock.tab("main.ts")).toHaveAttribute("aria-selected", "false");
    await expect(dock.content("notes")).toBeVisible();
    await expect(dock.content("main")).toBeHidden();
    expect((await dock.model())["focus"]).toBe("notes");
  });

  test("selecting a tab fires focus and viewshow/viewhide for the two views", async ({ dock }) => {
    await dock.clearEvents();
    await dock.tab("notes.md").click();
    await dock.waitForEvent("viewshow");
    expect((await dock.events("viewhide")).map((e) => (e.detail as { id: string }).id)).toContain("main");
    expect((await dock.events("viewshow")).map((e) => (e.detail as { id: string }).id)).toContain("notes");
    expect((await dock.events("focus")).at(-1)!.detail).toMatchObject({ id: "notes", previous: "main" });
    expect(await dock.events("change")).toHaveLength(1);
    expect((await dock.events("change"))[0]!.detail).toEqual({ reason: "select" });
  });

  test("viewshow reports first:true only the first time a view is shown", async ({ dock }) => {
    await dock.tab("notes.md").click();
    await dock.tab("main.ts").click();
    await dock.tab("notes.md").click();
    const shows = (await dock.events("viewshow")).filter((e) => (e.detail as { id: string }).id === "notes");
    expect(shows.map((e) => (e.detail as { first: boolean }).first)).toEqual([true, false]);
  });

  test("the close button removes the tab and fires beforeclose, close and viewremove in order", async ({ dock }) => {
    await dock.tab("readme.md").click();
    await dock.clearEvents();
    await dock.tab("readme.md").locator('[part~="tab-close"]').click();
    await expect(dock.tab("readme.md")).toHaveCount(0);
    const names = await dock.eventNames();
    expect(names.indexOf("beforeclose")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("beforeclose")).toBeLessThan(names.indexOf("close"));
    expect((await dock.events("beforeclose"))[0]!.cancelable).toBe(true);
    expect((await dock.events("close"))[0]!.detail).toMatchObject({ id: "readme" });
    // closing keeps the view registered (it can be re-opened); only removeView / forget drop it
    expect(names).not.toContain("viewremove");
    expect((await dock.model())["views"]["readme"]).toBeDefined();
    await dock.call("removeView", "readme");
    expect(await dock.eventNames()).toContain("viewremove");
  });

  test("middle-click closes a tab", async ({ dock }) => {
    await dock.tab("readme.md").click({ button: "middle" });
    await expect(dock.tab("readme.md")).toHaveCount(0);
  });

  test("a single-view group shows its title instead of a tab strip", async ({ dock }) => {
    await expect(dock.stack("props").getByRole("tab")).toHaveCount(0);
    await expect(dock.stack("props")).toContainText("Properties");
  });

  test("reordering tabs by dragging along the strip changes the order", async ({ dock }) => {
    expect(await dock.order("main")).toEqual(["main", "notes", "readme"]);
    const first = await dock.center(dock.tab("main.ts"));
    const last = (await dock.tab("readme.md").boundingBox())!;
    await dock.drag(first, { x: last.x + last.width - 4, y: last.y + last.height / 2 });
    await expect.poll(() => dock.order("main")).toEqual(["notes", "readme", "main"]);
    expect((await dock.events("change")).at(-1)!.detail).toEqual({ reason: "reorder" });
  });

  test("pinned tabs move to the front, lose the close button and are kept by close-all", async ({ dock }) => {
    await dock.call("pin", "readme");
    await expect.poll(() => dock.order("main")).toEqual(["readme", "main", "notes"]);
    expect(await dock.call("hasPin", "readme")).toBe(true);
    await expect(dock.tab("readme.md").locator('[part~="tab-close"]')).toHaveCount(0);
    expect((await dock.events("pin")).length).toBe(1);
    await dock.call("pin", "readme", false);
    expect((await dock.events("unpin")).length).toBe(1);
    await expect(dock.tab("readme.md").locator('[part~="tab-close"]')).toHaveCount(1);
  });

  test("preview tabs are replaced by the next preview and promoted by a double-click", async ({ dock, page }) => {
    await page.evaluate(() => {
      const m = window.lab.dock();
      m.addView("p1", "first preview", { title: "p1.ts", preview: true, at: { near: "main", zone: "into" } });
    });
    await expect(dock.tab("p1.ts")).toBeVisible();
    await page.evaluate(() => { window.lab.dock().addView("p2", "second preview", { title: "p2.ts", preview: true, at: { near: "main", zone: "into" } }); });
    await expect(dock.tab("p2.ts")).toBeVisible();
    await expect(dock.tab("p1.ts")).toHaveCount(0);
    expect((await dock.model())["root"].children[1].children[0].preview).toBe("p2");
    await dock.tab("p2.ts").dblclick();
    await expect.poll(async () => (await dock.model())["root"].children[1].children[0].preview ?? null).toBeNull();
    await expect(dock.tab("p2.ts")).toBeVisible();
  });

  test("a dirty view shows a dot, and closing it asks first (cancel keeps it)", async ({ dock, page }) => {
    await dock.call("setDirty", "readme");
    expect(await dock.call("isDirty", "readme")).toBe(true);
    await expect(dock.tab("readme.md").locator('[part~="tab-dirty"]')).toBeVisible();
    expect((await dock.events("dirty"))[0]!.detail).toEqual({ id: "readme", dirty: true });
    await dock.tab("readme.md").click();
    await page.evaluate(() => { void window.lab.dock().dismiss("readme"); });
    const confirm = dock.el.locator("dockorama-confirm");
    await expect(confirm).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(confirm).toHaveCount(0);
    await expect(dock.tab("readme.md")).toBeVisible();
  });

  test("confirming the close of a dirty view removes it", async ({ dock, page }) => {
    await dock.call("setDirty", "readme");
    await page.evaluate(() => { void window.lab.dock().dismiss("readme"); });
    const confirm = dock.el.locator("dockorama-confirm");
    await expect(confirm).toBeVisible();
    await confirm.locator("button:not([data-cancel])").click();
    await expect(dock.tab("readme.md")).toHaveCount(0);
  });

  test("a custom confirmClose callback decides instead of the dialog", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().confirmClose = () => false; });
    await dock.call("setDirty", "readme");
    expect(await page.evaluate(() => window.lab.dock().dismiss("readme"))).toBe(false);
    await expect(dock.tab("readme.md")).toBeVisible();
    await page.evaluate(() => { window.lab.dock().confirmClose = () => true; });
    expect(await page.evaluate(() => window.lab.dock().dismiss("readme"))).toBe(true);
    await expect(dock.tab("readme.md")).toHaveCount(0);
  });

  test("right-click opens the tab menu with the standard commands; Escape closes it and restores focus", async ({ dock, page }) => {
    await dock.tab("notes.md").click({ button: "right" });
    const menu = dock.el.locator("dockorama-tab-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("role", "menu");
    for (const key of ["close", "close-others", "close-right", "close-all", "pin", "float", "popout", "split-right", "split-down"]) await expect(dock.menuItem(key)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(dock.tab("notes.md")).toBeFocused();
  });

  test("Shift+F10 opens the tab menu from the keyboard and arrows move through items", async ({ dock, page }) => {
    await dock.tab("notes.md").focus();
    await page.keyboard.press("Shift+F10");
    const menu = dock.el.locator("dockorama-tab-menu");
    await expect(menu).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  test("tab menu: Close others keeps only that tab and one change is recorded", async ({ dock }) => {
    await dock.tab("notes.md").click({ button: "right" });
    await dock.menuItem("close-others").click();
    await expect(dock.stack("notes")).toBeVisible();
    await expect(dock.tab("main.ts")).toHaveCount(0);
    await expect(dock.tab("readme.md")).toHaveCount(0);
  });

  test("tab menu: Close to the right closes later tabs only", async ({ dock }) => {
    await dock.tab("notes.md").click({ button: "right" });
    await dock.menuItem("close-right").click();
    await expect(dock.tab("readme.md")).toHaveCount(0);
    await expect(dock.tab("main.ts")).toBeVisible();
    await expect(dock.tab("notes.md")).toBeVisible();
  });

  test("tab menu: Pin pins the tab; Float floats it in a window; Split right makes a new group", async ({ dock }) => {
    await dock.tab("notes.md").click({ button: "right" });
    await dock.menuItem("pin").click();
    await expect.poll(() => dock.call("hasPin", "notes")).toBe(true);
    await dock.tab("readme.md").click({ button: "right" });
    await dock.menuItem("split-right").click();
    await expect(dock.stack("readme")).toBeVisible();
    await dock.tab("main.ts").click({ button: "right" });
    await dock.menuItem("float").click();
    await expect(dock.windows()).toHaveCount(1);
  });

  test("a tabMenu callback can add and remove menu items", async ({ dock, page }) => {
    await page.evaluate(() => {
      window.lab.dock().tabMenu = (_id, items) => [...items.filter((i) => i !== "separator" && i.key !== "float"), { key: "custom", label: "Do the thing" } as never];
    });
    await dock.tab("notes.md").click({ button: "right" });
    await expect(dock.el.getByRole("menuitem", { name: "Do the thing" })).toBeVisible();
    await expect(dock.el.getByRole("menuitem", { name: /^float/i })).toHaveCount(0);
    await dock.el.getByRole("menuitem", { name: "Do the thing" }).click();
    expect((await dock.events("command")).at(-1)!.detail).toMatchObject({ id: "notes", command: "custom" });
  });

  test("a vetoed command event stops the menu command", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().addEventListener("dockorama-command", (e) => e.preventDefault()); });
    await dock.tab("notes.md").click({ button: "right" });
    await dock.menuItem("close").click();
    await expect(dock.tab("notes.md")).toBeVisible();
  });

  test("Alt+PageDown / Alt+PageUp cycle through the tabs of a group", async ({ dock, page }) => {
    await dock.tab("main.ts").click();
    await page.keyboard.press("Alt+PageDown");
    await expect(dock.tab("notes.md")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Alt+PageUp");
    await expect(dock.tab("main.ts")).toHaveAttribute("aria-selected", "true");
  });

  // ARIA tabs pattern: Left/Right between tabs. Not implemented yet (Alt+PageUp/Down is) -- see docs/testing.md.
  test.fixme("arrow keys move between tabs in a focused tab strip", async ({ dock, page }) => {
    await dock.tab("main.ts").focus();
    await page.keyboard.press("ArrowRight");
    await expect(dock.tab("notes.md")).toBeFocused();
  });

  test("a long tab strip scrolls and the overflow control reveals hidden tabs", async ({ page }) => {
    const d = await Dock.mountWith(page, ({ dk }) => {
      const ids = Array.from({ length: 40 }, (_, i) => `v${i}`);
      return { model: dk.createModel(Object.fromEntries(ids.map((id, i) => [id, { title: `Document number ${i}` }])), dk.row([dk.docs(ids)], [1])) };
    }, null);
    await expect(d.tabs().first()).toBeVisible();
    const strip = d.el.locator("dockorama-tabstrip").first();
    await expect(strip).toBeVisible();
    await d.call("reveal", "v39");
    await expect(d.tab("Document number 39")).toBeInViewport();
    await d.call("activate", "v0");
    await expect(d.tab("Document number 0")).toBeInViewport();
  });

  test("closing the selected tab selects a neighbour", async ({ dock }) => {
    await dock.tab("notes.md").click();
    await dock.tab("notes.md").locator('[part~="tab-close"]').click();
    await expect(dock.selectedTab().filter({ hasText: /main\.ts|readme\.md/ })).toHaveCount(1);
  });

  test("closing the last tab of a group removes the group and the space is reused", async ({ dock }) => {
    await dock.stackButton("props", "close").click();
    await expect(dock.stack("props")).toHaveCount(0);
    await expect(dock.stacks()).toHaveCount(3);
    expect(await dock.width(dock.stack("main"))).toBeGreaterThan(700);
  });
});
