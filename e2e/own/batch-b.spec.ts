import { expect, test, type Locator } from "@playwright/test";

const BASE = process.env.PAZURU_SITE ?? "";
const SHOTS = process.env.PAZURU_SHOTS ?? "e2e-results";
type Dock = { model: { root: unknown; parked: string[]; version?: number } & Record<string, unknown>; isDirty(id: string): boolean; dirtyViews: string[] };
const call = <T>(loc: Locator, fn: (d: Dock) => T) => loc.evaluate((el, src) => (new Function("d", `return (${src})(d)`))(el), fn.toString()) as Promise<T>;

test("pinned tabs stay first and compact; preview tabs are replaced, then kept on double-click", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/pinned-preview`);
  const dock = page.locator("pazuru-manager").first();
  const demo = page.locator(".demo").first();
  const tabs = dock.locator('[data-docs] [role="tab"]');
  await expect(tabs.first()).toHaveAttribute("data-pinned", "");
  await demo.getByRole("button", { name: "app.ts" }).click();
  await expect(dock.locator('[role="tab"][data-preview]')).toHaveText(/app\.ts/);
  await expect(dock.locator('[role="tab"][data-preview] .label')).toHaveCSS("font-style", "italic");
  await demo.getByRole("button", { name: "util.ts" }).click();
  await expect(dock.locator('[role="tab"]:has-text("app.ts")')).toHaveCount(0);
  await expect(dock.locator('[role="tab"][data-preview]')).toHaveText(/util\.ts/);
  await page.screenshot({ path: `${SHOTS}/5x-pinned-preview.png` });
  await dock.locator('[role="tab"][data-preview]').dblclick();
  await expect(dock.locator('[role="tab"][data-preview]')).toHaveCount(0);
  await demo.getByRole("button", { name: "theme.css" }).click();
  await expect(dock.locator('[role="tab"]:has-text("util.ts")')).toHaveCount(1);
  await expect(tabs.first()).toHaveAttribute("data-pinned", "");
});

test("dirty views show a dot and ask before closing", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/dirty`);
  const dock = page.locator("pazuru-manager").first();
  const demo = page.locator(".demo").first();
  await dock.locator('[data-view="main"] textarea').fill("changed");
  await expect(dock.locator('[role="tab"]:has-text("main.ts") [part~="tab-dirty"]')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/5x-dirty-dot.png` });
  await demo.getByRole("button", { name: "Close main.ts" }).click();
  const dlg = dock.locator("pazuru-confirm");
  await expect(dlg).toBeVisible();
  await expect(dlg).toHaveAttribute("aria-label", /main\.ts has unsaved changes/);
  await page.screenshot({ path: `${SHOTS}/5x-dirty-confirm.png` });
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await expect(page.locator(".events")).toContainText("closed: false");
  await demo.getByRole("button", { name: "Close main.ts" }).click();
  await dlg.locator("[data-primary]").click();
  await expect(page.locator(".events")).toContainText("closed: true");
  expect(await call(dock, (d) => d.model.parked)).toContain("main");
});

test("keyboard docking: Alt+M, Tab, arrows and Enter move a view, with announcements", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/keyboard-docking`);
  const dock = page.locator("pazuru-manager").first();
  await page.locator(".demo button", { hasText: "Move Output" }).click();
  const live = dock.locator('[role="status"]');
  await expect(live).toContainText("Moving Output");
  await expect(dock.locator("pazuru-drop-guide")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(live).toHaveText("Project, right");
  await page.screenshot({ path: `${SHOTS}/5x-keyboard-docking.png` });
  await page.keyboard.press("Enter");
  await expect(live).toHaveText("Moved Output");
  await expect(dock.locator("pazuru-drop-guide")).toHaveCount(0);
  const root = await call(dock, (d) => JSON.stringify(d.model.root));
  expect(root.indexOf('"files"')).toBeLessThan(root.indexOf('"log"'));
  // Alt+M from the focused tab, then Escape cancels.
  await dock.locator('[role="tab"]:has-text("main.ts")').click();
  await page.keyboard.press("Alt+m");
  await expect(live).toContainText("Moving main.ts");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(live).toHaveText("Move cancelled");
});

test("layout versions: old layouts upgrade, broken ones are reported", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/versions`);
  const dock = page.locator("pazuru-manager").first();
  const demo = page.locator(".demo").first();
  expect(await call(dock, (d) => d.model.version)).toBe(2);
  await demo.getByRole("button", { name: "Restore a version-0 layout" }).click();
  await expect(page.locator(".events")).toContainText("now version 2");
  await demo.getByRole("button", { name: "Restore one with problems" }).click();
  await expect(page.locator(".events")).toContainText('fixed restore: unknown view "ghost" in parked; focus "gone" is not placed');
  await demo.getByRole("button", { name: "Restore one from the future" }).click();
  await expect(page.locator(".events")).toContainText("rejected restore: pazuru: saved layout version 9 is newer than 2");
  await page.locator(".demo").first().screenshot({ path: `${SHOTS}/5x-layout-versions.png` });
});
