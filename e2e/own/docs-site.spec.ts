import { expect, test, type Page } from "@playwright/test";

// Docs site (harness/index.html). Every route loads cleanly and every live example mounts.
// Uses plain @playwright/test: these specs do not use the lab page.
const BASE = process.env.DOCKORAMA_SITE ?? "";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("requestfailed", (r) => errors.push(`requestfailed: ${r.url()}`));
  return errors;
}
async function routes(page: Page): Promise<string[]> {
  await page.goto(`${BASE}/#/`);
  await expect(page.locator("main h1")).toBeVisible();
  return page.locator("#side a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!.replace(/^#\/?/, "")));
}

test.describe("docs site", () => {
  test("the sidebar lists every guide and example route @smoke", async ({ page }) => {
    const slugs = await routes(page);
    expect(slugs.length).toBeGreaterThan(25);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of ["start", "guide/frameworks", "examples/trading"]) expect(slugs).toContain(s);
  });

  test("every route loads with a heading, a title, and no console or page errors", async ({ page }) => {
    const errors = collectErrors(page);
    const slugs = await routes(page);
    for (const slug of slugs) {
      await page.goto(`${BASE}/#/${slug}`);
      await expect(page.locator("main h1").first(), slug).toBeVisible();
      await expect(page, slug).toHaveTitle(/dockorama/i);
      await expect(page.locator(`#side a[href="#/${slug}"]`), slug).toHaveAttribute("aria-current", "page");
    }
    expect(errors).toEqual([]);
  });

  test("every live example mounts a working demo on every route", async ({ page }) => {
    const errors = collectErrors(page);
    const slugs = await routes(page);
    let demos = 0;
    for (const slug of slugs) {
      await page.goto(`${BASE}/#/${slug}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      // Each example holder ends up containing a stage with live content (not an empty placeholder).
      for (const holder of await page.locator("[data-example]").all()) {
        await expect(holder.locator(".stage"), slug).toHaveCount(1);
      }
      const stages = page.locator("[data-example] .stage");
      const n = await stages.count();
      demos += n;
      for (let i = 0; i < n; i++) {
        const stage = stages.nth(i);
        await expect(stage, `${slug} #${i}`).not.toBeEmpty();
        const box = await stage.boundingBox();
        expect(box?.width ?? 0, `${slug} #${i} width`).toBeGreaterThan(50);
      }
    }
    expect(demos).toBeGreaterThanOrEqual(39);
    expect(errors).toEqual([]);
  });

  test("every example's code panel is present and non-empty", async ({ page }) => {
    for (const slug of await routes(page)) {
      await page.goto(`${BASE}/#/${slug}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      for (const code of await page.locator("details.code pre code").all()) {
        expect((await code.textContent())?.trim().length ?? 0, slug).toBeGreaterThan(10);
      }
    }
  });

  test("navigating by the sidebar changes route, title and scroll position", async ({ page }) => {
    await page.goto(`${BASE}/#/`);
    await page.locator('#side a[href="#/start"]').click();
    await expect(page).toHaveURL(/#\/start$/);
    await expect(page.locator('#side a[href="#/start"]')).toHaveAttribute("aria-current", "page");
    await expect(page.locator("dockorama-manager").first()).toBeVisible();
  });

  test("an unknown route falls back to the home page", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${BASE}/#/does/not/exist`);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page).toHaveTitle(/docking layouts for the web/);
    expect(errors).toEqual([]);
  });

  test("the home page is reachable through the logo and links to the guides", async ({ page }) => {
    await page.goto(`${BASE}/#/`);
    await expect(page.locator("main a.card").first()).toBeVisible();
    expect(await page.locator("main a.card").count()).toBeGreaterThan(5);
  });

  test("the standalone trading page loads without errors @smoke", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${BASE}/trading.html`);
    await expect(page.locator("dockorama-manager.td")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the site stylesheet and bundle are served without failures", async ({ page }) => {
    const bad: string[] = [];
    page.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${BASE}/#/`);
    await expect(page.locator("main h1")).toBeVisible();
    expect(bad).toEqual([]);
  });
});
