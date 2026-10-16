import { expect, test } from "../own/helpers/index.js";
import type { Dock } from "../own/helpers/index.js";
import type { Page } from "@playwright/test";

/**
 * Visual regression. One baseline per key state, per skin. The lab page (harness/lab.html) is a fixed
 * 1200x700 stage with a pinned font and no clocks or random data, so images are reproducible.
 *
 * Baselines are generated on Linux (the CI image) and stored without a platform suffix. On other platforms
 * font rasterisation differs, so these tests are skipped unless DOCKORAMA_VISUAL=1 is set. See docs/testing.md.
 */
test.skip(process.platform !== "linux" && !process.env["DOCKORAMA_VISUAL"], "Baselines are Linux-generated. Set DOCKORAMA_VISUAL=1 to compare anyway.");
test.use({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce" });

const SKINS = ["default", "nimbus", "ledger", "phosphor"] as const;
type Skin = (typeof SKINS)[number];

async function applySkin(page: Page, skin: Skin, dark: boolean): Promise<void> {
  await page.evaluate(([s, d]) => {
    window.lab.skins.useSkin(s);
    const dock = window.lab.dock();
    dock.theme = d ? "dark" : "light";
    document.getElementById("stage")!.classList.toggle("dark", d);
  }, [skin, dark] as const);
  await expect(page.locator("#main")).toHaveAttribute("data-skin-name", skin);
  // Wait for fonts and a settled frame before capturing.
  await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
}

const shot = async (page: Page, name: string): Promise<void> => {
  await expect(page.locator("#stage")).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.002,
    threshold: 0.2
  });
};

const STATES: Array<{ name: string; dark?: boolean; setup: (dock: Dock, page: Page) => Promise<void> }> = [
  { name: "layout", setup: async () => {} },
  { name: "layout-dark", dark: true, setup: async () => {} },
  { name: "tab-selected", setup: async (d) => { await d.tabOf("notes").click(); await d.page.mouse.move(1100, 650); } },
  { name: "tab-menu", setup: async (d) => { await d.openTabMenu("notes.md"); } },
  { name: "floating-window", setup: async (d) => {
    await d.call("detach", "props", { x: 420, y: 160, w: 360, h: 260 });
    await expect(d.windows()).toHaveCount(1);
  } },
  { name: "flyout", setup: async (d) => {
    await d.call("stow", "props");
    await d.rail().first().click();
    await expect(d.drawer()).toBeVisible();
  } },
  { name: "drag-preview", setup: async (d) => {
    await d.dragTabToZone("notes.md", "log", "right", false);
    await expect(d.hotTarget("right")).toBeVisible();
  } },
  { name: "palette", setup: async (d, page) => {
    await d.tabOf("main").click();
    await page.keyboard.press("Control+.");
    await expect(d.el.locator("dockorama-palette").getByRole("listbox")).toBeVisible();
  } },
  { name: "dirty-tab", setup: async (d) => { await d.call("setDirty", "notes", true); await d.page.mouse.move(1100, 650); } }
];

for (const skin of SKINS) {
  test.describe(`visual: ${skin} skin`, () => {
    for (const state of STATES) {
      test(`${state.name} @visual`, async ({ dock, page }) => {
        await applySkin(page, skin, state.dark ?? false);
        await state.setup(dock, page);
        await shot(page, `${skin}-${state.name}`);
      });
    }
  });
}

test.describe("visual: composition", () => {
  test("two docks with different per-dock skins @visual", async ({ dock, page }) => {
    await page.evaluate(() => {
      const left = window.lab.dock();
      left.setAttribute("skin", "ledger");
      left.style.cssText = "position:absolute;left:0;top:0;width:600px;height:700px";
    });
    const other = await dock.mountAnother("right", { attrs: { skin: "phosphor" } });
    await page.evaluate(() => { window.lab.dock("right").style.cssText = "position:absolute;left:600px;top:0;width:600px;height:700px"; });
    await expect(other.el.locator("[data-stack]").first()).toBeVisible();
    await expect(page.locator("#right")).toHaveAttribute("data-skin-name", "phosphor");
    await expect(page.locator("#main")).toHaveAttribute("data-skin-name", "ledger");
    await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
    await shot(page, "two-docks-per-dock-skin");
  });

  test("a custom accent property recolours the selected tab and focus ring @visual", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().style.setProperty("--dk-accent", "#d9480f"); });
    await dock.tabOf("notes").click();
    await page.mouse.move(1100, 650);
    await shot(page, "custom-accent");
  });
});
