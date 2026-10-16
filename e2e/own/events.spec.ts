import { expect, test } from "@playwright/test";

const BASE = process.env.DOCKORAMA_SITE ?? "";
const SHOTS = process.env.DOCKORAMA_SHOTS ?? "e2e-results";

test("events guide logs drag, resize, state and command events live", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/events`);
  const demo = page.locator(".demo").first();
  const dock = demo.locator("dockorama-manager");
  const log = demo.locator(".events");
  await expect(page.locator("table td code", { hasText: "dockorama-dragover" })).toBeVisible();

  // Splitter drag → resizing is filtered out of the log, resize is logged once at the end.
  const gutter = dock.locator(".split > .gutter").first();
  const g = (await gutter.boundingBox())!;
  await page.mouse.move(g.x + g.width / 2, g.y + 60);
  await page.mouse.down();
  await page.mouse.move(g.x + 60, g.y + 60, { steps: 6 });
  await page.mouse.up();
  await expect(log).toContainText('dockorama-resize {"kind":"split"');

  // Drag a tab onto the right edge of the main area.
  const tab = dock.locator('.tab[data-view="notes"]');
  const t = (await tab.boundingBox())!;
  const host = (await dock.boundingBox())!;
  await page.mouse.move(t.x + 20, t.y + t.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + 60, t.y + 60, { steps: 4 });
  await page.mouse.move(host.x + host.width - 12, host.y + host.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(log).toContainText("dockorama-dragstart (cancellable)");
  await expect(log).toContainText("dockorama-dragover");
  await expect(log).toContainText('dockorama-drop {"id":"notes"');

  // Float from code → float event; tab menu pin → command + pin.
  await dock.evaluate((el) => (el as unknown as { detach(id: string): void }).detach("log"));
  await expect(log).toContainText('dockorama-float {"id":"log"');
  await dock.locator('.tab[data-view="main"]').click({ button: "right" });
  await dock.locator("dockorama-tab-menu button", { hasText: /^Pin/ }).first().click();
  await expect(log).toContainText('dockorama-command (cancellable) {"id":"main","command":"pin"');
  await expect(log).toContainText('dockorama-pin {"id":"main"}');
  await page.screenshot({ path: `${SHOTS}/events-guide.png`, fullPage: false });
});

test("vetoing events: beforeadd, dragstart", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/events`);
  const demo = page.locator(".demo").nth(1);
  const log = demo.locator(".events");
  await demo.getByRole("button", { name: "Add temp view (blocked)" }).click();
  await expect(log).toContainText("blocked add of temp");
  await demo.getByRole("button", { name: "Add view", exact: true }).click();
  await expect(demo.locator('dockorama-manager .tab[data-view="extra2"]')).toBeVisible();
});
