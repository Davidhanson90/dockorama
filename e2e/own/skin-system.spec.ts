import { expect, test } from "./helpers/index.js";

const SKINS = ["default", "nimbus", "ledger", "phosphor"] as const;
const accent = (dock: import("./helpers/index.js").Dock) => dock.el.evaluate((el) => getComputedStyle(el).getPropertyValue("--dk-accent").trim());

test.describe("skins", () => {
  for (const name of SKINS) {
    test(`useSkin("${name}") restyles the dock and marks it with data-skin-name @smoke`, async ({ dock, page }) => {
      await page.evaluate((n) => { window.lab.skins.useSkin(n); }, name);
      await expect(dock.el).toHaveAttribute("data-skin-name", name);
      await expect(dock.stacks()).toHaveCount(4);
      expect((await accent(dock)).length).toBeGreaterThan(0);
      if (name === "phosphor") await expect(dock.el.locator(".tab[data-selected] .label").first()).toHaveText(/^\[.*\]$/);
      if (name === "ledger") await expect(dock.el.locator('[part~="action"][part~="more"]').first()).toHaveText("•••");
      if (name === "nimbus") await expect(dock.el.locator(".nimbus-dots").first()).toBeAttached();
    });
  }

  test("skins differ visibly: tab background and radius change between skins", async ({ dock, page }) => {
    const sample = async () => dock.tabOf("main").evaluate((e) => { const c = getComputedStyle(e); return `${c.backgroundColor}|${c.borderRadius}|${c.fontFamily}`; });
    const seen = new Set<string>();
    for (const n of SKINS) {
      await page.evaluate((s) => { window.lab.skins.useSkin(s); }, n);
      await expect(dock.el).toHaveAttribute("data-skin-name", n);
      seen.add(`${await accent(dock)}::${await sample()}`);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  test("the default skin applies without importing a skin module; skinNames lists all four", async ({ dock, page }) => {
    await expect(dock.el).toHaveAttribute("data-skin-name", "default");
    expect(await page.evaluate(() => window.lab.skins.skinNames().sort())).toEqual(["default", "ledger", "nimbus", "phosphor"]);
    expect(await page.evaluate(() => window.lab.skins.activeSkin().name)).toBe("default");
  });

  test("switching skins keeps layout state and content intact", async ({ dock, page }) => {
    await dock.dragTabToZone("notes.md", "log", "right");
    const before = JSON.stringify(await dock.model());
    await page.evaluate(() => { window.lab.skins.useSkin("phosphor"); });
    await expect(dock.el).toHaveAttribute("data-skin-name", "phosphor");
    expect(JSON.stringify(await dock.model())).toBe(before);
    await expect(dock.content("notes")).toBeVisible();
  });

  test("a dock can use its own skin (attribute or property) while the page uses another", async ({ dock, page }) => {
    const other = await dock.mountAnother("second", { attrs: { skin: "nimbus" } });
    await expect(other.el).toHaveAttribute("data-skin-name", "nimbus");
    await expect(dock.el).toHaveAttribute("data-skin-name", "default");
    await page.evaluate(() => { window.lab.skins.useSkin("ledger"); });
    await expect(dock.el).toHaveAttribute("data-skin-name", "ledger");
    await expect(other.el).toHaveAttribute("data-skin-name", "nimbus");
    await page.evaluate(() => { window.lab.dock("second").skin = window.lab.skins.phosphor; });
    await expect(other.el).toHaveAttribute("data-skin-name", "phosphor");
  });

  test("overrideSkin replaces one template page-wide, and the returned function removes it", async ({ dock, page }) => {
    await page.evaluate(() => {
      const { overrideSkin } = window.lab.skins;
      const { html } = window.lab;
      (window as unknown as { undo: () => void }).undo = overrideSkin({ templates: { "tab-label": (c) => html`<span class="label star">★ ${c.title}</span>` } });
    });
    await expect(dock.el.locator(".star").first()).toContainText("★");
    await page.evaluate(() => (window as unknown as { undo: () => void }).undo());
    await expect(dock.el.locator(".star")).toHaveCount(0);
  });

  test("overrideSkin css is added page-wide and clearSkinOverrides removes every override", async ({ dock, page }) => {
    await page.evaluate(() => {
      const { overrideSkin } = window.lab.skins;
      overrideSkin({ css: ".bar { outline: 3px solid rgb(255, 0, 0); }" });
    });
    await expect.poll(() => dock.stack("files").locator(".bar").first().evaluate((e) => getComputedStyle(e).outlineStyle)).toBe("solid");
    await page.evaluate(() => { window.lab.skins.clearSkinOverrides(); });
    await expect.poll(() => dock.stack("files").locator(".bar").first().evaluate((e) => getComputedStyle(e).outlineStyle)).toBe("none");
  });

  test("skinPatch overrides apply to one dock only", async ({ dock, page }) => {
    const other = await dock.mountAnother("second");
    await page.evaluate(() => {
      const { html } = window.lab;
      window.lab.dock().skinPatch = { templates: { "tab-label": (c) => html`<span class="label patched">« ${c.title} »</span>` } };
    });
    await expect(dock.el.locator(".patched").first()).toContainText("«");
    await expect(other.el.locator(".patched")).toHaveCount(0);
    await page.evaluate(() => { window.lab.dock().skinPatch = undefined; });
    await expect(dock.el.locator(".patched")).toHaveCount(0);
  });

  test("a patch layers over the dock's own skin and page-wide overrides (newest page-wide wins)", async ({ dock, page }) => {
    await page.evaluate(() => {
      const { overrideSkin } = window.lab.skins;
      const { html } = window.lab;
      overrideSkin({ templates: { "tab-label": (c) => html`<span class="label one">1 ${c.title}</span>` } });
      overrideSkin({ templates: { "tab-label": (c) => html`<span class="label two">2 ${c.title}</span>` } });
    });
    await expect(dock.el.locator(".two").first()).toBeVisible();
    await expect(dock.el.locator(".one")).toHaveCount(0);
    await page.evaluate(() => {
      const { html } = window.lab;
      window.lab.dock().skinPatch = { templates: { "tab-label": (c) => html`<span class="label three">3 ${c.title}</span>` } };
    });
    await expect(dock.el.locator(".three").first()).toBeVisible();
    await expect(dock.el.locator(".two")).toHaveCount(0);
  });

  test("extendSkin builds a new skin on top of another and defineSkin registers it by name", async ({ dock, page }) => {
    await page.evaluate(() => {
      const { extendSkin, defineSkin, useSkin, nimbus, skinNamed } = window.lab.skins;
      extendSkin(nimbus, "sunset-e2e", { css: ":host { --dk-accent: rgb(255, 99, 71); }" });
      defineSkin("plain-e2e", { css: ".bar { opacity: 0.99; }" });
      if (!skinNamed("plain-e2e")) throw new Error("not registered");
      useSkin("sunset-e2e");
    });
    await expect(dock.el).toHaveAttribute("data-skin-name", "sunset-e2e");
    await expect.poll(() => accent(dock)).toContain("255");
    expect(await page.evaluate(() => window.lab.skins.skinNamed("sunset-e2e")!.base?.name)).toBe("nimbus");
    expect(await page.evaluate(() => window.lab.skins.skinNames())).toContain("plain-e2e");
  });

  test("a template's context is typed: close(), selected and title reach the template", async ({ dock, page }) => {
    await page.evaluate(() => {
      const { overrideSkin } = window.lab.skins;
      const { html } = window.lab;
      overrideSkin({ templates: { "tab-close-button": (c) => html`<button class="mine" part="tab-close" aria-label="close ${c.title}" @click=${c.close}>x</button>` } });
    });
    await dock.tabOf("notes").locator(".mine").click();
    await expect(dock.tab("notes.md")).toHaveCount(0);
    await page.evaluate(() => { window.lab.skins.clearSkinOverrides(); });
  });

  test("a template that throws does not take the whole dock down", async ({ dock, page, errors }) => {
    await page.evaluate(() => {
      window.lab.skins.overrideSkin({ templates: { "tab-label": () => { throw new Error("boom from template"); } } });
    });
    await expect(dock.el).toBeAttached();
    errors.length = 0; // the thrown error is expected here
    await page.evaluate(() => { window.lab.skins.clearSkinOverrides(); });
  });
});
