import { expect, test } from "@playwright/test";

const BASE = process.env.PAZURU_SITE ?? "";
const SHOTS = process.env.PAZURU_TRADING_SHOTS ?? process.env.PAZURU_SHOTS ?? "e2e-results";

test("trading desk example runs live in the docs and pops out", async ({ page, context }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto(`${BASE}/#/examples/trading`);
  const dock = page.locator("#td-stage pazuru-manager");
  await expect(dock.locator(".tab, .title").filter({ hasText: "Chart" }).first()).toBeVisible();
  await expect(dock.locator('[data-window]')).toHaveCount(2);
  await expect(dock.locator(".rail-item", { hasText: "Risk" })).toBeVisible();
  const first = await page.locator(".td-v-watch tbody tr").first().locator("td").nth(1).textContent();
  await expect.poll(async () => page.locator(".td-tape tbody tr").count()).toBeGreaterThan(5);
  await page.locator('.td-v-watch tr[data-sym="GLYD"]').click();
  await expect(page.locator(".td-chart-sym")).toContainText("GLYD");
  await page.locator(".td-send").click();
  await expect(page.locator(".td-v-orders tbody tr").first()).toContainText("GLYD");
  expect(first).toBeTruthy();
  await page.waitForTimeout(1200);
  await page.locator(".demo.td-demo").screenshot({ path: `${SHOTS}/trading-docs.png` });

  const [popup] = await Promise.all([context.waitForEvent("page"), page.locator("#td-popout").click()]);
  await popup.waitForLoadState();
  expect(new URL(popup.url()).pathname).toMatch(/trading\.html$/);
  await expect(popup.locator("pazuru-manager.td")).toBeVisible();
  await popup.close();
});

test("standalone trading page fills the viewport with no docs chrome", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.goto(`${BASE}/trading.html`);
  const dock = page.locator("pazuru-manager.td");
  await expect(dock).toBeVisible();
  await expect(page.locator("header.top, aside.side")).toHaveCount(0);
  const box = (await dock.boundingBox())!;
  expect(box.width).toBeGreaterThan(1670);
  expect(box.height).toBeGreaterThan(990);
  await expect.poll(async () => page.locator(".td-tape tbody tr").count()).toBeGreaterThan(5);
  await page.locator(".td-canvas canvas").first().waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/trading-standalone.png` });
  await page.locator('.rail-item', { hasText: "Risk" }).click();
  await expect(page.locator(".td-gauges figure")).toHaveCount(3);
  await page.screenshot({ path: `${SHOTS}/trading-standalone-risk.png` });
  expect(errors).toEqual([]);
});
