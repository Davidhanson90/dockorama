import { expect, test, type Page } from "@playwright/test";

// Two managers on one page keep separate layouts, histories and saved layouts.
const BASE = process.env.FLEXDOCK_SITE ?? "";
const mgr = (page: Page, key: string) => page.locator(`flexdock-manager[data-dock="${key}"]`);
const state = (page: Page, key: string) => mgr(page, key).evaluate((el) => {
  const m = el as unknown as { model: { drawers: Record<string, string[]>; windows: unknown[] }; canUndo: boolean; storageKey: string };
  return { stowed: Object.values(m.model.drawers).flat(), windows: m.model.windows.length, canUndo: m.canUndo, key: m.storageKey };
});

test("two managers on one page are independent", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/multiple`);
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("flexdock-demo-multi-")) localStorage.removeItem(k); });
  await page.reload();
  await expect(mgr(page, "mail")).toBeVisible();
  await expect(mgr(page, "desk")).toBeVisible();
  const before = await state(page, "desk");
  expect(before.key).not.toBe((await state(page, "mail")).key);

  // Auto-hide "Folders" in the first manager only.
  await mgr(page, "mail").locator('[data-stack="Folders"] [part~="stow"]').click();
  expect((await state(page, "mail")).stowed).toEqual(["Folders"]);
  expect(await state(page, "desk")).toEqual(before);

  // Float "Chart" in the second manager by dragging its tab out onto empty space below the documents.
  const tab = (await mgr(page, "desk").locator('[role="tab"]:has-text("Chart")').boundingBox())!;
  await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2);
  await page.mouse.down();
  await page.mouse.move(tab.x + 30, tab.y + 80, { steps: 6 });
  await page.mouse.move(tab.x + 60, tab.y + 160, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await state(page, "desk")).windows).toBe(1);
  expect((await state(page, "mail")).windows).toBe(0);
  await page.screenshot({ path: "e2e-results/3x-multiple-docks.png" });

  // Undo in one leaves the other alone.
  await mgr(page, "mail").evaluate((el) => (el as unknown as { undo(): void }).undo());
  expect((await state(page, "mail")).stowed).toEqual([]);
  expect((await state(page, "desk")).windows).toBe(1);
  await mgr(page, "mail").locator('[data-stack="Folders"] [part~="stow"]').click();

  // Each restores its own saved layout.
  await page.reload();
  await expect(mgr(page, "desk")).toBeVisible();
  expect((await state(page, "mail")).stowed).toEqual(["Folders"]);
  expect((await state(page, "mail")).windows).toBe(0);
  expect((await state(page, "desk")).windows).toBe(1);
  expect((await state(page, "desk")).stowed).toEqual([]);
});
