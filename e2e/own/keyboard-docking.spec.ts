import { expect, test } from "./helpers/index.js";

const live = (dock: import("./helpers/index.js").Dock) => dock.el.locator(".sr");

test.describe("keyboard docking mode and focus management", () => {
  test("Alt+M starts a move, announces it, shows the drop guide and Escape cancels @smoke", async ({ dock, page }) => {
    await dock.tab("notes.md").click();
    await page.keyboard.press("Alt+m");
    await expect(live(dock)).toContainText("Moving notes.md");
    await expect(dock.hotTarget("into")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dock.el.locator(".target")).toHaveCount(0);
    await expect(live(dock)).toContainText("Move cancelled");
    expect(await dock.order("main")).toEqual(["main", "notes", "readme"]);
  });

  test("arrow keys choose a side, Enter drops there as one undoable change", async ({ dock, page }) => {
    await dock.tab("notes.md").click();
    await page.keyboard.press("Alt+m");
    await page.keyboard.press("Tab"); // next target group
    await page.keyboard.press("ArrowRight");
    await expect(dock.el.locator(".target[data-hot]")).toHaveAttribute("data-zone", /right|into/);
    await page.keyboard.press("Enter");
    await expect(live(dock)).toContainText("Moved notes.md");
    expect((await dock.events("change")).at(-1)!.detail).toMatchObject({ reason: expect.stringMatching(/place|edge|move/) });
    await dock.call("undo");
    expect(await dock.order("main")).toEqual(["main", "notes", "readme"]);
  });

  test("Tab and Shift+Tab walk through the groups and each step is announced", async ({ dock, page }) => {
    await dock.tab("notes.md").click();
    await page.keyboard.press("Alt+m");
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      seen.add((await live(dock).textContent()) ?? "");
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Escape");
  });

  test("a vetoed beforemove keeps the keyboard move from happening", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().addEventListener("dockorama-beforemove", (e) => e.preventDefault()); });
    await dock.tab("notes.md").click();
    await page.keyboard.press("Alt+m");
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    expect(await dock.order("main")).toEqual(["main", "notes", "readme"]);
  });

  test("beginMove() and cancelMove() work from code", async ({ dock }) => {
    expect(await dock.call<boolean>("beginMove", "notes")).toBe(true);
    await expect(dock.el.locator(".target[data-hot]")).toBeVisible();
    await dock.call("cancelMove");
    await expect(dock.el.locator(".target")).toHaveCount(0);
  });

  test("Alt+Shift+Arrow nudges the focused view to a neighbouring side", async ({ dock, page }) => {
    await dock.tab("notes.md").click();
    await page.keyboard.press("Alt+Shift+ArrowRight");
    await expect(dock.stack("notes")).toBeVisible();
    await page.keyboard.press("Control+Alt+z");
    await expect(dock.stack("notes")).toHaveCount(0);
  });

  test("Alt+Z zooms the focused group and Escape restores it", async ({ dock, page }) => {
    await dock.tab("notes.md").click();
    await page.keyboard.press("Alt+z");
    await expect.poll(async () => (await dock.model())["zoom"]).toBe("notes");
    await expect(dock.stacks()).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dock.stacks()).toHaveCount(4);
  });

  test("closing the focused view keeps keyboard focus inside the dock", async ({ dock, page }) => {
    await dock.tab("notes.md").click();
    await dock.tabOf("notes").locator('[part~="tab-close"]').click();
    await expect(dock.tab("notes.md")).toHaveCount(0);
    // DOM focus stays inside the manager so shortcuts keep working
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("main");
  });

  test("closing the focused tab moves model focus and keyboard focus to the tab that took its place", async ({ dock }) => {
    await dock.tab("notes.md").click();
    await dock.tabOf("notes").locator('[part~="tab-close"]').click();
    await expect(dock.tab("notes.md")).toHaveCount(0);
    await expect.poll(async () => {
      const m = await dock.model();
      return ["main", "readme"].includes(m["focus"]) && m["root"].children[1].children[0].current === m["focus"];
    }).toBe(true);
    const focused = (await dock.model())["focus"] as string;
    await expect(dock.tabOf(focused)).toBeFocused();
  });

  test("closing the last view of a group leaves focus on a view that is still shown", async ({ dock }) => {
    await dock.content("props").click();
    await dock.call("dismiss", "props");
    await expect.poll(async () => (await dock.model())["focus"]).toBeTruthy();
    const focus = (await dock.model())["focus"] as string;
    expect(focus).not.toBe("props");
    await expect(dock.stack(focus)).toBeVisible();
  });

  test("focusing a view's content marks its group active", async ({ dock }) => {
    await dock.content("log").click();
    expect((await dock.model())["focus"]).toBe("log");
    await expect(dock.stack("log")).toHaveAttribute("data-active", "");
  });

  test("the active group is exposed through data-active on exactly one group", async ({ dock }) => {
    await dock.tab("notes.md").click();
    await expect(dock.el.locator("[data-stack][data-active]")).toHaveCount(1);
  });

  test("labels for the keyboard mode can be translated", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().labels = { moveCancelled: "Cancelado" }; });
    await dock.tab("notes.md").click();
    await page.keyboard.press("Alt+m");
    await page.keyboard.press("Escape");
    await expect(live(dock)).toContainText("Cancelado");
  });
});
