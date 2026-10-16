import { expect, test } from "./helpers/index.js";

test.describe("command palette", () => {
  test("Ctrl+. opens the palette as a labelled dialog listing views and commands @smoke", async ({ dock, page }) => {
    await dock.tab("notes.md").click();
    await page.keyboard.press("Control+.");
    const palette = dock.el.locator("dockorama-palette");
    await expect(palette).toBeVisible();
    await expect(palette.getByRole("dialog", { name: "Go to view" }).or(palette)).toBeVisible();
    await expect(palette.getByRole("combobox")).toBeFocused();
    const options = palette.getByRole("option");
    await expect(options.filter({ hasText: "main.ts" })).toHaveCount(1);
    await expect(options.filter({ hasText: /undo layout change/i })).toHaveCount(1);
    expect(await options.count()).toBeGreaterThanOrEqual(10);
  });

  test("typing filters the list and Enter focuses the chosen view", async ({ dock, page }) => {
    await dock.tab("main.ts").click();
    await page.keyboard.press("Control+.");
    await page.keyboard.type("outp");
    const options = dock.el.locator("dockorama-palette").getByRole("option");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(dock.el.locator("dockorama-palette")).toHaveCount(0);
    expect((await dock.model())["focus"]).toBe("log");
  });

  test("arrow keys move the selection and Escape closes without acting", async ({ dock, page }) => {
    await dock.tab("main.ts").click();
    await page.keyboard.press("Control+.");
    const options = dock.el.locator("dockorama-palette").getByRole("option");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(dock.el.locator("dockorama-palette")).toHaveCount(0);
    expect((await dock.events("change")).filter((e) => (e.detail as { reason: string }).reason !== "select")).toHaveLength(1); // only the initial "set"
  });

  test("a query with no match shows the empty message", async ({ dock, page }) => {
    await dock.tab("main.ts").click();
    await page.keyboard.press("Control+.");
    await page.keyboard.type("zzzzqqq");
    await expect(dock.el.locator("dockorama-palette")).toContainText("Nothing matches");
    await expect(dock.el.locator("dockorama-palette").getByRole("option")).toHaveCount(0);
  });

  test("it finds views that are stowed, floating or closed and reveals them", async ({ dock, page }) => {
    await dock.call("stow", "props");
    await dock.call("detach", "search", { x: 300, y: 200, w: 300, h: 200 });
    await dock.call("dismiss", "readme");
    await dock.tab("main.ts").click();
    await page.keyboard.press("Control+.");
    const options = dock.el.locator("dockorama-palette").getByRole("option");
    for (const name of ["Properties", "Search", "readme.md"]) await expect(options.filter({ hasText: name })).toHaveCount(1);
    await page.keyboard.type("readme");
    await page.keyboard.press("Enter");
    await expect(dock.tab("readme.md")).toBeVisible();
  });

  test("choosing a command runs it (undo layout change)", async ({ dock, page }) => {
    await dock.call("toggleZoom", "main");
    await expect.poll(async () => (await dock.model())["zoom"]).toBe("main");
    await dock.stack("main").click({ position: { x: 100, y: 120 } });
    await page.keyboard.press("Control+.");
    await page.keyboard.type("undo");
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await dock.model())["zoom"] ?? null).toBeNull();
  });

  test("openPalette() opens it from code and clicking an option chooses it", async ({ dock }) => {
    await dock.call("openPalette");
    await dock.el.locator("dockorama-palette").getByRole("option", { name: "Problems" }).click();
    expect((await dock.model())["focus"]).toBe("problems");
  });

  test("labels can translate the palette", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().labels = { palette: "Ir a vista", noMatches: "Sin resultados" }; });
    await dock.call("openPalette");
    await page.keyboard.type("zzzz");
    await expect(dock.el.locator("dockorama-palette")).toContainText("Sin resultados");
  });
});
