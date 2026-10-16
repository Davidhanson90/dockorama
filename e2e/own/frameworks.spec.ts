import { expect, test, type Page } from "@playwright/test";

// The live React, Vue, Angular and Svelte demos on the Frameworks guide (harness/frameworks.ts).
const BASE = process.env.DOCKORAMA_SITE ?? "";
const FRAMEWORKS = ["react", "vue", "angular", "svelte"] as const;
const LABEL = { react: "React", vue: "Vue", angular: "Angular", svelte: "Svelte" } as const;

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${BASE}/#/guide/frameworks`);
  await expect(page.locator("main h1")).toHaveText("Frameworks");
  return errors;
}

test.describe("framework wrapper demos", () => {
  for (const fw of FRAMEWORKS) {
    test(`${LABEL[fw]}: the demo mounts a manager with its four views @smoke`, async ({ page }) => {
      const errors = await open(page);
      const host = page.locator(`[data-fw="${fw}"]`);
      await host.scrollIntoViewIfNeeded();
      await expect(host.locator("dockorama-manager").first()).toBeVisible();
      await expect(host.getByRole("tab").first()).toBeVisible();
      await expect(host.locator(".v")).toHaveCount(4);
      expect(errors).toEqual([]);
    });

    test(`${LABEL[fw]}: rearranging a tab reports the change back to the framework`, async ({ page }) => {
      await open(page);
      const host = page.locator(`[data-fw="${fw}"]`);
      await host.scrollIntoViewIfNeeded();
      const status = host.locator("xpath=following-sibling::p[contains(@class,'fw-status')]");
      const before = await status.textContent();
      const a = (await host.getByRole("tab").filter({ hasText: "notes.md" }).first().boundingBox())!;
      const b = (await host.locator("[data-stack]").last().boundingBox())!;
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(a.x + a.width / 2, a.y + 40, { steps: 6 });
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
      await page.mouse.up();
      await expect(status).not.toHaveText(before ?? "");
    });
  }

  test("all four demos mount on one page without console errors", async ({ page }) => {
    const errors = await open(page);
    for (const fw of FRAMEWORKS) {
      const host = page.locator(`[data-fw="${fw}"]`);
      await host.scrollIntoViewIfNeeded();
      await expect(host.locator(".v")).toHaveCount(4);
    }
    expect(errors).toEqual([]);
  });
});
