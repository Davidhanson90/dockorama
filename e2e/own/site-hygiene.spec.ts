import { expect, test } from "@playwright/test";

// Clean-room hygiene: the public docs site must never name the reference product.
// (This file is allow-listed in scripts/check-naming.mjs because it has to contain the pattern.)
const BASE = process.env.FLEXDOCK_SITE ?? "";

test("no reference-product names on the public site", async ({ page }) => {
  await page.goto(`${BASE}/#/`);
  const slugs = await page.locator("#side a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  for (const s of slugs) {
    await page.goto(`${BASE}/${s}`);
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/third-party|third-party\s?ui|\big[cx]-/i);
  }
});

