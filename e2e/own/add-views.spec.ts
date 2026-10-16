import { expect, test } from "@playwright/test";

const BASE = process.env.DOCKORAMA_SITE ?? "";

test("addView places elements, text and lazy factories from code", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/add-views`);
  const dock = page.locator("dockorama-manager").first();
  await expect(dock).toBeVisible();
  const demo = page.locator(".demo").first();
  const state = () => dock.evaluate((el) => {
    const m = (el as unknown as { model: { views: Record<string, { title: string }>; windows: unknown[]; drawers: { end: string[] } } }).model;
    return { titles: Object.values(m.views).map((v) => v.title), windows: m.windows.length, rail: m.drawers.end };
  });

  await demo.getByRole("button", { name: "Chart beside Orders" }).click();
  await expect(dock.locator('[role="tab"], .title').filter({ hasText: "Chart 1" }).first()).toBeVisible();
  await expect(dock.locator('[data-view="c0"] svg')).toBeVisible();
  await demo.getByRole("button", { name: "Into documents" }).click();
  await expect(dock.locator('[role="tab"]:has-text("Chart 2")')).toBeVisible();
  await demo.getByRole("button", { name: "Floating" }).click();
  expect((await state()).windows).toBe(1);
  await demo.getByRole("button", { name: "Rail (lazy)" }).click();
  const s = await state();
  expect(s.rail).toEqual(["c3"]);
  await expect(dock.locator('[slot][data-view="c3"]')).toHaveCount(0);
  await expect(demo.locator(".events")).not.toContainText("factory ran");
  await demo.getByRole("button", { name: "Text" }).click();
  const textView = dock.locator('[slot][data-view="t4"]');
  await expect(textView).toHaveText("Just some text, added as a view.");
  await expect(textView).toHaveClass(/dockorama-text/);
  await expect(textView).toHaveCSS("padding-top", "12px");
  await page.screenshot({ path: "e2e-results/4x-addview.png" });

  // Undo removes the last added view in one step.
  await demo.getByRole("button", { name: "Undo" }).click();
  expect((await state()).titles).not.toContain("Note 5");
  await demo.getByRole("button", { name: "Remove last" }).click();
  await expect(demo.locator(".events")).toContainText("removed");
});
