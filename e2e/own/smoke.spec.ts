import { expect, test } from "@playwright/test";

test("harness renders <flexdock-manager>", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("flexdock-manager")).toBeVisible();
  await expect(page.locator("#version")).toContainText("Version");
});
