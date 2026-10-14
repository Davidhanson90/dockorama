import { expect, test, type Locator } from "@playwright/test";

const BASE = process.env.FLEXDOCK_SITE ?? "";
const SHOTS = process.env.FLEXDOCK_SHOTS ?? "e2e-results";
type Split = { weights: number[]; fixed?: Array<number | null>; folded?: boolean[]; children: Split[] };
type Dock = { model: { root: Split }; isFolded(id: string): boolean; isRetained(id: string): boolean };
const call = <T>(loc: Locator, fn: (d: Dock) => T) => loc.evaluate((el, src) => (new Function("d", `return (${src})(d)`))(el), fn.toString()) as Promise<T>;

test("gutters collapse on double-click, fixed cells keep their px size, limits hold", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/splitters`);
  const dock = page.locator("flexdock-manager").first();
  const demo = page.locator(".demo").first();
  const files = dock.locator(".split > .cell").first();
  const gutter = dock.locator(".split > .gutter").first();
  await gutter.dblclick();
  await expect.poll(() => call(dock, (d) => d.isFolded("files"))).toBe(true);
  await expect(gutter).toHaveAttribute("data-folded", "before");
  await page.screenshot({ path: `${SHOTS}/5x-splitter-folded.png` });
  await gutter.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => call(dock, (d) => d.isFolded("files"))).toBe(false);

  await demo.getByRole("button", { name: "Fix Project at 220px" }).click();
  await expect.poll(async () => Math.round((await files.boundingBox())!.width)).toBeLessThanOrEqual(222);
  const before = (await files.boundingBox())!.width;
  await page.setViewportSize({ width: 1100, height: 1000 });
  await expect.poll(async () => Math.abs((await files.boundingBox())!.width - before)).toBeLessThan(2);
  // Dragging the gutter changes the fixed size.
  const g = (await gutter.boundingBox())!;
  await page.mouse.move(g.x + g.width / 2, g.y + 40);
  await page.mouse.down();
  await page.mouse.move(g.x + 80, g.y + 40, { steps: 5 });
  await page.mouse.up();
  const fixed = await call(dock, (d) => d.model.root.fixed?.[0] ?? 0);
  expect(fixed).toBeGreaterThan(260);
  await page.screenshot({ path: `${SHOTS}/5x-splitter-fixed.png` });

  await demo.getByRole("button", { name: "Limit Output 80–240px" }).click();
  const log = dock.locator(".split .split > .cell").nth(1);
  const lg = dock.locator(".split .split > .gutter").first();
  await lg.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("End");
  await expect.poll(async () => Math.round((await log.boundingBox())!.height)).toBeGreaterThanOrEqual(79);
  await expect.poll(async () => Math.round((await log.boundingBox())!.height)).toBeLessThanOrEqual(82);
  await page.keyboard.press("Home");
  await expect.poll(async () => Math.round((await log.boundingBox())!.height)).toBeLessThanOrEqual(241);
});

test("retain=active detaches hidden contents; the tab list of 300 views is virtualised", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/performance`);
  const dock = page.locator("flexdock-manager").first();
  expect(await dock.evaluate((el) => el.querySelectorAll(":scope > [data-view]").length)).toBeLessThan(5);
  await expect.poll(() => call(dock, (d) => d.isRetained("d10"))).toBe(true);
  await page.locator(".demo").first().getByRole("button", { name: "Open the tab list" }).click();
  const menu = dock.locator(".menu[data-virtual]");
  await expect(menu).toBeVisible();
  expect(await menu.locator(".menu-rows button").count()).toBeLessThan(40);
  await page.keyboard.press("End");
  await expect(menu.locator('button[data-index="299"]')).toBeFocused();
  await page.screenshot({ path: `${SHOTS}/5x-virtual-tab-list.png` });
  await page.keyboard.press("Enter");
  await expect(dock.locator('[role="tab"][aria-selected="true"]')).toHaveText(/file-299/);
  await expect(dock.locator(':scope > [data-view="d299"]')).toBeAttached();
  await expect.poll(() => call(dock, (d) => d.isRetained("d299"))).toBe(false);
});

test("benchmark runs on the docs page", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(`${BASE}/#/guide/performance`);
  await page.click('[data-bench="100-all"]');
  await expect(page.locator(".bench-run table td").first()).toHaveText("100", { timeout: 60000 });
  await expect(page.locator(".bench-recorded table")).toBeVisible();
  await page.locator(".bench-run").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/5x-benchmark.png`, fullPage: false });
});
