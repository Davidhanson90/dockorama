import { expect, test } from "@playwright/test";

// The public docs site must never name a third-party product (pattern kept encoded; see scripts/check-naming.mjs).
const BASE = process.env.FLEXDOCK_SITE ?? "";
const pattern = new RegExp(Buffer.from("aW5mcmFnaXN0aWNzfGlnbml0ZVtcc18tXT91aXxcYmlnbml0ZVxifFxiaWdbY3hdLXxcYklnW2N4XVtBLVpd", "base64").toString("utf8"), "i");

test("no third-party product names on the public site", async ({ page }) => {
  await page.goto(`${BASE}/#/`);
  const slugs = await page.locator("#side a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  for (const s of slugs) {
    await page.goto(`${BASE}/${s}`);
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(pattern);
  }
});
