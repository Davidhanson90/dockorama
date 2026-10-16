import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE = process.env.DOCKORAMA_SITE ?? "";
const SHOTS = process.env.DOCKORAMA_SHOTS ?? "e2e-results";
type Dock = { model: { views: Record<string, unknown>; outside?: Array<{ key: string; views: string[] }>; parked: string[] }; hasView(id: string): boolean; hasPin(id: string): boolean; blockedWindows: string[] };
const call = <T>(loc: Locator, fn: (d: Dock) => T) => loc.evaluate((el, src) => (new Function("d", `return (${src})(d)`))(el), fn.toString()) as Promise<T>;

async function drag(page: Page, from: Locator, to: { x: number; y: number }) {
  const b = (await from.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 10, b.y + 60, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  return async () => page.mouse.up();
}

test("drags a view, with its live element, from one dock into another", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/cross-dock`);
  const left = page.locator('dockorama-manager[data-dock="left"]');
  const right = page.locator('dockorama-manager[data-dock="right"]');
  await expect(right).toBeVisible();
  await left.locator('[data-view="Draft"] input').fill("kept while moving");
  await left.locator('[role="tab"]:has-text("Sent")').click();
  const docs = (await right.locator('[data-stack][data-docs]').boundingBox())!;
  const drop = await drag(page, left.locator('[role="tab"]:has-text("Draft")'), { x: docs.x + docs.width / 2, y: docs.y + docs.height / 2 });
  await expect(right.locator("dockorama-drop-guide .target").first()).toBeVisible();
  await expect(left.locator("dockorama-drop-guide")).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/5x-cross-dock-guides.png` });
  await drop();
  expect(await call(right, (d) => d.hasView("Draft"))).toBe(true);
  expect(await call(left, (d) => d.hasView("Draft"))).toBe(false);
  await expect(right.locator('[data-view="Draft"] input')).toHaveValue("kept while moving");
  await expect(page.locator(".events")).toContainText("right: in Draft");
  await page.screenshot({ path: `${SHOTS}/5x-cross-dock-after.png` });
  await page.locator(".demo button", { hasText: "Undo both" }).click();
  expect(await call(left, (d) => d.hasView("Draft"))).toBe(true);
});

test("tab context menu: right-click, keyboard, pin and custom items", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/tab-menu`);
  const dock = page.locator("dockorama-manager").first();
  const main = dock.locator('[role="tab"]:has-text("main.ts")');
  await main.click({ button: "right" });
  const menu = dock.locator("dockorama-tab-menu");
  await expect(menu).toBeVisible();
  await expect(menu.locator('button[data-key="close-others"]')).toBeVisible();
  await expect(dock.locator('[role="tab"][data-pinned]')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/5x-tab-menu.png` });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await main.focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu).toBeVisible();
  await page.keyboard.press("p");
  await page.keyboard.press("Enter");
  expect(await call(dock, (d) => d.hasPin("main"))).toBe(true);
  await main.click({ button: "right" });
  await menu.locator("button", { hasText: "Log view id" }).click();
  await expect(page.locator(".events")).toContainText("custom item: main");
  await dock.locator('[role="tab"]:has-text("notes.md")').click({ button: "right" });
  await menu.locator('button[data-key="close-others"]').click();
  const parked = await call(dock, (d) => d.model.parked);
  expect(parked).toContain("todo");
  expect(parked).not.toContain("main");
  expect(parked).not.toContain("readme");
});

test("pop-outs: several views per window, saved, restored and a blocked-popup prompt", async ({ page, context }) => {
  await page.goto(`${BASE}/#/guide/popout`);
  await page.evaluate(() => localStorage.removeItem("dockorama-demo-popout"));
  await page.reload();
  const dock = page.locator("dockorama-manager").first();
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.locator(".demo button", { hasText: "Pop out Output" }).click()]);
  await expect(popup.locator(".dko-tab")).toHaveCount(1);
  await page.locator(".demo button", { hasText: "Add notes.md" }).click();
  await expect(popup.locator(".dko-tab")).toHaveCount(2);
  await expect(popup.locator('.dko-body > [data-view="notes"]')).toBeVisible();
  await expect(dock.locator(".away")).toHaveCount(1);
  await popup.setViewportSize({ width: 640, height: 400 });
  await popup.screenshot({ path: `${SHOTS}/5x-popout-window.png` });
  await page.screenshot({ path: `${SHOTS}/5x-popout-placeholders.png` });
  // Tab switch inside the pop-out.
  await popup.locator('.dko-tab[data-view="log"]').click();
  await expect(popup.locator('.dko-body > [data-view="log"]')).toBeVisible();
  // Reload: the window comes back (popups are allowed here) with both views.
  const again = page.waitForEvent("popup");
  await page.reload();
  const reopened = await again;
  await expect(reopened.locator(".dko-tab")).toHaveCount(2);
  expect(await call(dock, (d) => d.model.outside![0]!.views)).toEqual(["log", "notes"]);
  // Simulate a popup blocker: the prompt appears; "Keep them here" docks them.
  await context.addInitScript(() => { window.open = () => null; });
  await page.reload();
  const notice = dock.locator("dockorama-notice");
  await expect(notice).toBeVisible();
  expect(await call(dock, (d) => d.blockedWindows.length)).toBe(1);
  await page.screenshot({ path: `${SHOTS}/5x-popout-blocked-prompt.png` });
  await notice.locator("button", { hasText: "Keep them here" }).click();
  await expect(notice).toHaveCount(0);
  expect(await call(dock, (d) => d.model.outside ?? [])).toEqual([]);
  await expect(dock.locator(".away")).toHaveCount(0);
});

test("drags a tab past the browser window edge to pop it out, and closing the window docks it", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/popout`);
  await page.evaluate(() => localStorage.removeItem("dockorama-demo-popout"));
  await page.reload();
  const dock = page.locator("dockorama-manager").first();
  const tab = dock.locator('[role="tab"]:has-text("notes.md")');
  const popupP = page.waitForEvent("popup");
  const drop = await drag(page, tab, { x: 3, y: 300 });
  await page.mouse.move(-40, 300, { steps: 4 });
  await drop();
  const popup = await popupP;
  await expect(popup.locator('.dko-body > [data-view="notes"]')).toBeAttached();
  expect(await call(dock, (d) => d.model.outside![0]!.views)).toEqual(["notes"]);
  await popup.close();
  await expect.poll(() => call(dock, (d) => (d.model.outside ?? []).length)).toBe(0);
  await expect(dock.locator(':scope > [data-view="notes"]')).toBeAttached();
});
