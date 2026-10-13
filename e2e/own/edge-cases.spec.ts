import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.FLEXDOCK_SITE ?? "";
const open = async (page: Page, slug: string) => {
  await page.goto(`${BASE}/#/${slug}`);
  await expect(page.locator("flexdock-manager").first()).toBeVisible();
};
const dock = (page: Page) => page.locator("flexdock-manager").first();
const box = async (page: Page, sel: string) => (await dock(page).locator(sel).first().boundingBox())!;
const mid = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const model = (page: Page) => dock(page).evaluate((el) => JSON.parse(JSON.stringify((el as unknown as { model: unknown }).model)));
const rootViews = (page: Page) => dock(page).evaluate((el) => {
  const root = (el as unknown as { model: { root: { kind: string; children?: Array<{ views?: string[] }>; views?: string[] } } }).model.root;
  return root.kind === "split" ? root.children!.map((c) => c.views ?? ["split"]) : [root.views];
});

test("drop a tab onto a gutter inserts a new group between neighbours", async ({ page }) => {
  await open(page, "guide/gutter-drop");
  const from = mid(await box(page, '[role="tab"]:has-text("Two")'));
  const gutter = mid(await box(page, ".gutter >> nth=1"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 80, { steps: 6 });
  await page.mouse.move(gutter.x, gutter.y, { steps: 12 });
  await expect(dock(page).locator('.target[data-zone="between"]')).toBeVisible();
  await expect(dock(page).locator(".gutter[data-drop]")).toHaveCount(1);
  await page.screenshot({ path: "e2e-results/2x-gutter-drop.png" });
  await page.mouse.up();
  expect(await rootViews(page)).toEqual([["one"], ["doc"], ["two"], ["three", "four"]]);
});

test("Escape cancels a drag and restores the layout", async ({ page }) => {
  await open(page, "guide/gutter-drop");
  const before = await model(page);
  const from = mid(await box(page, '[role="tab"]:has-text("Two")'));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 60, from.y, { steps: 6 });
  await page.mouse.move(from.x + 300, from.y + 200, { steps: 12 });
  await expect(dock(page).locator(".overlay")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dock(page).locator(".overlay")).toHaveCount(0);
  await page.mouse.up();
  expect(await model(page)).toEqual(before);
  await expect(page.locator(".events")).toContainText("drag cancelled: two");
});

test("an empty document area accepts a drop in its centre", async ({ page }) => {
  await open(page, "guide/gutter-drop");
  await dock(page).locator('[part~="tab-close"]').first().click();
  await expect(dock(page).locator("[data-stack][data-empty]")).toBeVisible();
  const from = mid(await box(page, '[role="tab"]:has-text("Three")'));
  const area = mid(await box(page, "[data-stack][data-empty]"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 80, { steps: 6 });
  await page.mouse.move(area.x, area.y, { steps: 12 });
  await expect(dock(page).locator('.target[data-zone="into"][data-hot]')).toBeVisible();
  await page.screenshot({ path: "e2e-results/2x-empty-docs-drop.png" });
  await page.mouse.up();
  await expect(dock(page).locator('[part~="docs"] [role="tab"]:has-text("Three")')).toBeVisible();
});

test("overflowing tabs scroll with the wheel and buttons", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await open(page, "guide/tabs");
  const strip = dock(page).locator(".tabs").first();
  await expect(dock(page).locator(".bar[data-overflow]").first()).toBeVisible();
  const scroll = () => strip.evaluate((s) => s.scrollLeft);
  expect(await scroll()).toBe(0);
  await strip.hover();
  await page.mouse.wheel(0, 300);
  await expect.poll(scroll).toBeGreaterThan(0);
  const after = await scroll();
  await dock(page).locator('.bar[data-overflow] .scroll[data-dir="-1"]').first().click();
  await expect.poll(scroll).toBeLessThan(after);
  await dock(page).locator('.bar[data-overflow] .scroll[data-dir="1"]').first().click();
  await page.screenshot({ path: "e2e-results/2x-tab-overflow.png" });
  // Selecting a hidden tab from the menu scrolls it into view.
  await dock(page).locator('[part~="more"]').first().click();
  await dock(page).locator('.menu button:has-text("README.md")').click();
  const s = (await strip.boundingBox())!;
  await expect.poll(async () => {
    const tab = await box(page, '[role="tab"]:has-text("README.md")');
    return tab.x + tab.width <= s.x + s.width + 1 && tab.x >= s.x - 1;
  }).toBe(true);
});

test("pop-out moves content to a new browser window and back", async ({ page, context }) => {
  await open(page, "guide/popout");
  const [popup] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Pop out Output" }).click()]);
  await expect(popup.locator('[data-view="log"]')).toContainText("Build finished");
  await expect(dock(page).locator(".away")).toBeVisible();
  await page.screenshot({ path: "e2e-results/2x-popout.png" });
  await popup.close();
  await expect(dock(page).locator(".away")).toHaveCount(0);
  await expect(page.locator('flexdock-manager [data-view="log"]')).toContainText("Build finished");
  // Bring back through the button too.
  const [again] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Pop out Output" }).click()]);
  await dock(page).locator(".away button").click();
  await expect.poll(() => again.isClosed()).toBe(true);
});

test("framework wrappers render live demos", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/#/guide/frameworks`);
  for (const fw of ["react", "vue", "angular", "svelte"]) {
    const m = page.locator(`[data-fw="${fw}"] flexdock-manager`);
    await expect(m).toBeVisible({ timeout: 15_000 });
    await expect(m.locator('[role="tab"]').first()).toBeVisible();
  }
  await page.locator('[data-fw="react"] flexdock-manager [role="tab"]:has-text("notes.md")').click();
  await page.locator('[data-fw="react"] flexdock-manager [role="tab"]:has-text("main.ts") [part~="tab-close"]').click();
  await expect(page.locator('[data-fw="react"] + .fw-status')).toContainText("React state");
  await page.locator('[data-fw="angular"] flexdock-manager [role="tab"]:has-text("main.ts") [part~="tab-close"]').click();
  await expect(page.locator('[data-fw="angular"] + .fw-status')).toContainText("Angular signal");
  await page.screenshot({ path: "e2e-results/2x-frameworks.png", fullPage: true });
  expect(errors).toEqual([]);
});

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: false });
  async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    const cdp = await page.context().newCDPSession(page);
    const pt = (p: { x: number; y: number }) => [{ x: p.x, y: p.y, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(from) });
    for (let i = 1; i <= 12; i++) {
      const p = { x: from.x + ((to.x - from.x) * i) / 12, y: from.y + ((to.y - from.y) * i) / 12 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(p) });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  test("dragging a tab with a finger docks it", async ({ page }) => {
    await open(page, "guide/gutter-drop");
    const from = mid(await box(page, '[role="tab"]:has-text("Two")'));
    const gutter = mid(await box(page, ".gutter >> nth=1"));
    await touchDrag(page, from, gutter);
    await expect.poll(() => rootViews(page)).toEqual([["one"], ["doc"], ["two"], ["three", "four"]]);
  });
  test("tapping tabs and a drawer label works", async ({ page }) => {
    await open(page, "guide/gutter-drop");
    await page.touchscreen.tap(...Object.values(mid(await box(page, '[role="tab"]:has-text("Four")'))) as [number, number]);
    await expect(dock(page).locator('[role="tab"][aria-selected="true"]:has-text("Four")')).toBeVisible();
    const g = mid(await box(page, ".gutter"));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: g.x, y: g.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: g.x + 80, y: g.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => (await model(page)).root.weights[0]).toBeGreaterThan(1);
  });
});
