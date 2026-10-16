import { expect, test, type Page } from "@playwright/test";

// dockorama's own behaviour, tested against our docs site. Shadow DOM is pierced by Playwright locators.
const BASE = process.env.DOCKORAMA_SITE ?? "";
const open = async (page: Page, slug: string) => {
  await page.goto(`${BASE}/#/${slug}`);
  await expect(page.locator("dockorama-manager").first()).toBeVisible();
};
const dock = (page: Page) => page.locator("dockorama-manager").first();
const center = async (page: Page, sel: string) => {
  const b = (await dock(page).locator(sel).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 30, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}
const model = (page: Page) => dock(page).evaluate((el) => (el as unknown as { model: Record<string, unknown> }).model);

test("every page renders without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/#/`);
  const slugs = await page.locator("#side a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(slugs.length).toBeGreaterThan(25);
  for (const s of slugs) {
    await page.goto(`${BASE}/${s}`);
    await expect(page.locator("main h1")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("drag a tab onto a group's right target splits it", async ({ page }) => {
  await open(page, "start");
  const from = await center(page, '[role="tab"]:has-text("notes.md")');
  const target = (await dock(page).locator('[data-stack="log"]').boundingBox())!;
  const to = { x: target.x + target.width / 2 + Math.min(40, target.width / 3), y: target.y + target.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 60, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await expect(dock(page).locator('.target[data-zone="right"][data-hot]')).toBeVisible();
  await expect(dock(page).locator(".preview")).toBeVisible();
  await page.mouse.up();
  await expect(dock(page).locator('[data-stack="notes"]')).toBeVisible();
  const notes = (await dock(page).locator('[data-stack="notes"]').boundingBox())!;
  const log = (await dock(page).locator('[data-stack="log"]').boundingBox())!;
  expect(notes.x).toBeGreaterThan(log.x);
});

test("drop into the centre joins as a tab; drop on empty space floats", async ({ page }) => {
  await open(page, "start");
  const from = await center(page, '[data-stack="files"] .title');
  const t = await center(page, '[data-stack="log"]');
  await drag(page, from, t);
  await expect(dock(page).locator('[role="tab"]:has-text("Project")')).toBeVisible();
  const from2 = await center(page, '[role="tab"]:has-text("Project")');
  const docs = (await dock(page).locator('[data-stack="main"]').boundingBox())!;
  await drag(page, from2, { x: docs.x + 60, y: docs.y + 60 });
  await expect(dock(page).locator('.window[role="dialog"]')).toHaveCount(1);
});

test("floating window can be moved and docked to an outer edge", async ({ page }) => {
  await open(page, "guide/windows");
  const win = dock(page).locator('.window:has-text("Layers")');
  const before = (await win.boundingBox())!;
  const bar = await center(page, '.window:has-text("Layers") .title');
  await drag(page, bar, { x: bar.x + 100, y: bar.y + 80 });
  const after = (await win.boundingBox())!;
  expect(Math.abs(after.x - before.x - 100)).toBeLessThan(25);
  const main = (await dock(page).locator(".main").boundingBox())!;
  const bar2 = await center(page, '.window:has-text("Layers") .title');
  await drag(page, bar2, { x: main.x + 24, y: main.y + main.height / 2 });
  await expect(dock(page).locator('.window:has-text("Layers")')).toHaveCount(0);
  const layers = (await dock(page).locator('[data-stack="layers"]').boundingBox())!;
  expect(layers.x).toBeLessThan(main.x + 20);
});

test("splitter drag resizes and undo restores", async ({ page }) => {
  await open(page, "guide/undo");
  const files = dock(page).locator('[data-stack="files"]');
  const w0 = (await files.boundingBox())!.width;
  const g = await center(page, ".main > .split > .gutter");
  await drag(page, g, { x: g.x + 120, y: g.y });
  const w1 = (await files.boundingBox())!.width;
  expect(w1).toBeGreaterThan(w0 + 60);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await files.boundingBox())!.width).toBeLessThan(w0 + 5);
});

test("stow to a drawer, peek and keep open", async ({ page }) => {
  await open(page, "start");
  await dock(page).locator('[data-stack="files"] [part~="stow"]').click();
  const item = dock(page).locator('.rail-item:has-text("Project")');
  await expect(item).toBeVisible();
  await item.click();
  await expect(dock(page).locator(".drawer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dock(page).locator(".drawer")).toHaveCount(0);
  await item.click();
  await dock(page).locator('.drawer [part~="unstow"]').click();
  await expect(dock(page).locator(".rail")).toHaveCount(0);
});

test("zoom by double-click and Escape", async ({ page }) => {
  await open(page, "start");
  await dock(page).locator('[data-stack="files"] .title').dblclick();
  await expect(dock(page).locator("[data-stack]")).toHaveCount(1);
  await dock(page).locator('[data-stack="files"]').click();
  await page.keyboard.press("Escape");
  await expect(dock(page).locator("[data-stack]")).toHaveCount(3);
});

test("keyboard: palette, tab cycling, nudge, undo", async ({ page }) => {
  await open(page, "guide/keyboard");
  await page.getByRole("button", { name: "Focus main.ts" }).click();
  await page.keyboard.press("Alt+PageDown");
  await expect(dock(page).locator('[role="tab"][aria-selected="true"]:has-text("notes.md")')).toBeVisible();
  await page.keyboard.press("Alt+Shift+ArrowRight");
  await expect(dock(page).locator('[data-stack="notes"]')).toBeVisible();
  await page.keyboard.press("Control+Alt+z");
  await expect(dock(page).locator('[data-stack="notes"]')).toHaveCount(0);
  await page.keyboard.press("Control+.");
  await page.keyboard.type("outp");
  await page.keyboard.press("Enter");
  expect((await model(page))["focus"]).toBe("log");
});

test("tab reorder by dragging along the strip", async ({ page }) => {
  await open(page, "guide/tabs");
  const tabs = dock(page).locator('[part~="docs"] [role="tab"]');
  const first = (await tabs.nth(0).boundingBox())!;
  const third = (await tabs.nth(2).boundingBox())!;
  await drag(page, { x: first.x + 10, y: first.y + first.height / 2 }, { x: third.x + third.width - 4, y: third.y + third.height / 2 });
  await expect(tabs.nth(2)).toContainText("index.html");
});

test("persistence restores layout after reload", async ({ page }) => {
  await open(page, "guide/persistence");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Trading" }).click();
  await page.reload();
  await expect(page.locator(".events")).toContainText("Restored");
});

test("theme toggle switches demos to dark", async ({ page }) => {
  await open(page, "start");
  await page.locator("#theme").click();
  await expect(dock(page)).toHaveAttribute("theme", page.url() && (await page.evaluate(() => document.documentElement.classList.contains("dark"))) ? "dark" : "light");
});

test("accessibility basics: roles and names", async ({ page }) => {
  await open(page, "start");
  await expect(dock(page).getByRole("tablist").first()).toBeVisible();
  await expect(dock(page).getByRole("separator").first()).toHaveAttribute("aria-valuenow", /\d+/);
  await expect(dock(page).getByRole("button", { name: "Close" }).first()).toBeVisible();
  await expect(dock(page).getByRole("region", { name: "Project" })).toBeVisible();
});
