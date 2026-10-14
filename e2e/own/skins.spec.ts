import { expect, test } from "@playwright/test";

const BASE = process.env.FLEXDOCK_SITE ?? "";
const SHOTS = process.env.FLEXDOCK_SKIN_SHOTS ?? process.env.FLEXDOCK_SHOTS ?? "e2e-results";

test.afterEach(async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem("fd-site-skin"));
});

for (const name of ["default", "nimbus", "ledger", "phosphor"]) {
  test(`skin switcher applies ${name} to every part`, async ({ page }) => {
    await page.goto(`${BASE}/#/guide/skins`);
    const demo = page.locator(".demo").first();
    const dock = demo.locator("flexdock-manager");
    await demo.getByRole("button", { name, exact: true }).click();
    await expect(dock).toHaveAttribute("data-skin-name", name);
    const accent = await dock.evaluate((el) => getComputedStyle(el).getPropertyValue("--fd-accent").trim());
    expect(accent.length).toBeGreaterThan(0);
    if (name === "phosphor") await expect(dock.locator(".tab[aria-selected=true] .label").first()).toHaveText(/^\[.*\]$/);
    if (name === "ledger") await expect(dock.locator('[part~="action"][part~="more"]').first()).toHaveText("•••");
    if (name === "nimbus") await expect(dock.locator(".nimbus-dots").first()).toBeAttached();
    await demo.scrollIntoViewIfNeeded();
    await demo.screenshot({ path: `${SHOTS}/skin-${name}.png` });
    // Other pages follow the chosen skin.
    await page.goto(`${BASE}/#/guide/tabs`);
    await expect(page.locator("flexdock-manager").first()).toHaveAttribute("data-skin-name", name);
  });
}

test("per-dock skins and live overrides", async ({ page }) => {
  await page.goto(`${BASE}/#/guide/skins`);
  const perDock = page.locator(".demo").nth(1).locator("flexdock-manager");
  await expect(perDock).toHaveCount(3);
  await expect(perDock.nth(0)).toHaveAttribute("data-skin-name", "nimbus");
  await expect(perDock.nth(2)).toHaveAttribute("data-skin-name", "phosphor");
  await page.locator(".demo").nth(1).screenshot({ path: `${SHOTS}/skin-per-dock.png` });

  const global = page.locator(".demo").nth(2);
  await global.getByRole("button", { name: "Override tab labels everywhere" }).click();
  await expect(global.locator(".tab[aria-selected=true] .label").first()).toContainText("★");
  await global.getByRole("button", { name: "Remove override" }).click();
  await expect(global.locator(".tab[aria-selected=true] .label").first()).not.toContainText("★");

  const local = page.locator(".demo").nth(3);
  await local.getByRole("button", { name: "Patch this dock" }).click();
  await expect(local.locator(".handle").first()).toBeAttached();
  await expect(global.locator(".handle")).toHaveCount(0);
  await local.screenshot({ path: `${SHOTS}/skin-override-dock.png` });

  const custom = page.locator(".demo").nth(4).locator("flexdock-manager");
  await expect(custom).toHaveAttribute("data-skin-name", "sunset");
  await expect(custom.locator(".tab[aria-selected=true] .label").first()).toContainText("▸");
});
