import { expect, test } from "./helpers/index.js";

test.describe("auto-hide rails and flyouts", () => {
  test("the stow button moves a group to an edge rail as a label @smoke", async ({ dock }) => {
    await dock.stackButton("files", "stow").click();
    await expect(dock.el.locator(".rail")).toHaveCount(1);
    await expect(dock.rail()).toHaveCount(1); // only the current view is stowed; Search stays docked
    await expect(dock.rail().first()).toContainText("Files");
    expect((await dock.events("stow"))[0]!.detail).toMatchObject({ id: "files", side: "start" });
    expect((await dock.model())["drawers"]["start"]).toEqual(["files"]);
    await expect(dock.stack("search")).toBeVisible();
  });

  test("a side is chosen from the view's position, or passed to stow()", async ({ dock }) => {
    await dock.call("stow", "props");
    expect((await dock.model())["drawers"]["end"]).toEqual(["props"]);
    await dock.call("stow", "log", "bottom");
    expect((await dock.model())["drawers"]["bottom"]).toContain("log");
    await expect(dock.el.locator(".rail")).toHaveCount(2);
  });

  test("clicking a rail label opens the flyout and marks the label expanded", async ({ dock, page }) => {
    await dock.call("stow", "props");
    await dock.rail().first().click();
    await expect(dock.drawer()).toBeVisible();
    await expect(dock.drawer().locator("[data-stack]").first()).toHaveAttribute("data-stack", "props");
    await expect(dock.rail().first()).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(dock.drawer()).toHaveCount(0);
    await expect(dock.rail().first()).toHaveAttribute("aria-expanded", "false");
  });

  test("hovering a rail label peeks at the flyout", async ({ dock }) => {
    await dock.call("stow", "props");
    await dock.rail().first().hover();
    await expect(dock.drawer()).toBeVisible();
  });

  test("clicking the rail label again closes the flyout", async ({ dock }) => {
    await dock.call("stow", "props");
    await dock.rail().first().click();
    await expect(dock.drawer()).toBeVisible();
    await dock.rail().first().click();
    await expect(dock.drawer()).toHaveCount(0);
    await expect(dock.rail().first()).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape closes the flyout", async ({ dock, page }) => {
    await dock.call("stow", "props");
    await dock.rail().first().click();
    await expect(dock.drawer()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dock.drawer()).toHaveCount(0);
  });

  test("clicking elsewhere closes the flyout", async ({ dock, page }) => {
    await dock.call("stow", "props");
    await dock.rail().first().click();
    await expect(dock.drawer()).toBeVisible();
    await dock.stack("main").click({ position: { x: 100, y: 200 } });
    await expect(dock.drawer()).toHaveCount(0);
    await page.waitForTimeout(0);
  });

  test("the pin button keeps the group open in the layout again and fires unstow", async ({ dock }) => {
    await dock.call("stow", "props");
    await dock.rail().first().click();
    await dock.drawer().locator('[part~="unstow"]').click();
    await expect(dock.el.locator(".rail")).toHaveCount(0);
    await expect(dock.stack("props")).toBeVisible();
    expect((await dock.events("unstow")).length).toBe(1);
    expect((await dock.events("dock")).at(-1)!.detail).toMatchObject({ id: "props", from: "drawer" });
  });

  test("Alt+H stows the focused group", async ({ dock, page }) => {
    await dock.stack("props").click({ position: { x: 20, y: 80 } });
    await page.keyboard.press("Alt+h");
    await expect.poll(async () => (await dock.model())["drawers"]["end"]).toEqual(["props"]);
  });

  test("the flyout shows the stowed view and its content is usable", async ({ dock }) => {
    await dock.call("stow", "files");
    await dock.rail().first().click();
    await expect(dock.drawer()).toContainText("Files");
    await expect(dock.content("files")).toBeVisible();
  });

  test("closing a stowed view from its flyout removes it from the rail", async ({ dock }) => {
    await dock.call("stow", "props");
    await dock.rail().first().click();
    await dock.drawer().locator('[part~="close"]').click();
    await expect(dock.el.locator(".rail")).toHaveCount(0);
  });

  test("caps.hide=false stops a view being stowed from the menu", async ({ dock }) => {
    await dock.call("addView", "fixed", "no stow", { title: "Fixed", caps: { hide: false }, at: { near: "log", zone: "into" } });
    await dock.openTabMenu("Fixed");
    await expect(dock.menuItem("stow")).toBeDisabled();
  });

  test("RTL mirrors start and end rails", async ({ dock, page }) => {
    await page.evaluate(() => { document.documentElement.dir = "rtl"; });
    await dock.call("stow", "files");
    const rail = (await dock.el.locator('.rail[data-side="start"]').boundingBox())!;
    const host = (await dock.el.boundingBox())!;
    expect(rail.x).toBeGreaterThan(host.x + host.width / 2);
  });
});
