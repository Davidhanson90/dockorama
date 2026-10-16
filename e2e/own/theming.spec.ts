import { expect, test, openLab, Dock } from "./helpers/index.js";

const prop = (dock: import("./helpers/index.js").Dock, name: string) => dock.el.evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name);

test.describe("theming and CSS custom properties", () => {
  test("theme attribute switches light, dark and auto and reflects on the element @smoke", async ({ dock, page }) => {
    await expect(dock.el).toHaveAttribute("theme", "light");
    const light = await prop(dock, "--dk-surface");
    await page.evaluate(() => { window.lab.dock().theme = "dark"; });
    await expect(dock.el).toHaveAttribute("theme", "dark");
    const dark = await prop(dock, "--dk-surface");
    expect(dark).not.toBe(light);
    await page.evaluate(() => { window.lab.dock().theme = "auto"; });
    await expect(dock.el).toHaveAttribute("theme", "auto");
  });

  test("auto follows prefers-color-scheme", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().theme = "auto"; });
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await prop(dock, "--dk-surface");
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => prop(dock, "--dk-surface")).not.toBe(dark);
  });

  for (const name of ["--dk-accent", "--dk-surface", "--dk-ink", "--dk-line", "--dk-radius", "--dk-gutter", "--dk-bar-height", "--dk-text-padding"]) {
    test(`${name} is defined by the default skin and can be overridden from outside`, async ({ dock, page }) => {
      expect((await prop(dock, name)).length).toBeGreaterThan(0);
      await page.evaluate(([n]) => { window.lab.dock().style.setProperty(n!, "rgb(1, 2, 3)"); }, [name]);
      expect(await prop(dock, name)).toBe("rgb(1, 2, 3)");
    });
  }

  test("custom properties set on the element are inherited by every part inside", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().style.setProperty("--dk-accent", "rgb(250, 0, 100)"); });
    for (const sel of [dock.stack("files").locator(".bar").first(), dock.selectedTab().first(), dock.gutters().first()]) {
      expect(await sel.evaluate((e) => getComputedStyle(e).getPropertyValue("--dk-accent").trim())).toBe("rgb(250, 0, 100)");
    }
  });

  test("--dk-gutter changes the splitter thickness", async ({ dock, page }) => {
    const w0 = await dock.width(dock.gutters().first());
    await page.evaluate(() => { window.lab.dock().style.setProperty("--dk-gutter", "14px"); });
    await expect.poll(() => dock.width(dock.gutters().first())).toBeGreaterThan(w0 + 3);
  });

  test("--dk-bar-height changes the tab bar height", async ({ dock, page }) => {
    const h0 = await dock.height(dock.stack("main").locator(".bar").first());
    await page.evaluate(() => { window.lab.dock().style.setProperty("--dk-bar-height", "60px"); });
    await expect.poll(() => dock.height(dock.stack("main").locator(".bar").first())).toBeGreaterThan(h0 + 10);
  });

  test("labels: every button label and tooltip can be translated", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().labels = { dismiss: "Cerrar", resize: "Redimensionar" }; });
    await expect(dock.stack("props").getByRole("button", { name: "Cerrar" })).toBeVisible();
    await expect(dock.gutters().first()).toHaveAttribute("aria-label", "Redimensionar");
  });

  test("parts are exposed for outside styling with ::part", async ({ dock, page }) => {
    await page.addStyleTag({ content: "dockorama-manager::part(group) { outline: 2px solid rgb(0, 128, 0); }" });
    await expect.poll(() => dock.stack("files").evaluate((e) => getComputedStyle(e).outlineColor)).toBe("rgb(0, 128, 0)");
  });

  test("RTL: a dock mounted under dir=rtl is mirrored (files on the right, rail on the right)", async ({ page }) => {
    await openLab(page);
    await page.evaluate(() => { document.documentElement.dir = "rtl"; window.lab.mount(); });
    const d = new Dock(page);
    await expect(d.stack("files")).toBeVisible();
    expect((await d.stack("files").boundingBox())!.x).toBeGreaterThan((await d.stack("props").boundingBox())!.x);
    await expect(d.el.locator(".frame")).toHaveAttribute("dir", "rtl");
  });

  test("RTL: changing dir after mount re-renders the layout, and back again", async ({ dock, page }) => {
    await expect(dock.el.locator(".frame")).toHaveAttribute("dir", "ltr");
    const ltrX = (await dock.stack("files").boundingBox())!.x;
    await page.evaluate(() => { document.documentElement.dir = "rtl"; });
    await expect(dock.el.locator(".frame")).toHaveAttribute("dir", "rtl");
    await expect.poll(async () => (await dock.stack("files").boundingBox())!.x).toBeGreaterThan(ltrX + 500);
    await page.evaluate(() => { document.documentElement.dir = "ltr"; });
    await expect(dock.el.locator(".frame")).toHaveAttribute("dir", "ltr");
    await expect.poll(async () => (await dock.stack("files").boundingBox())!.x).toBe(ltrX);
  });

  test("RTL: setting dir on the dock element itself re-renders it", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().setAttribute("dir", "rtl"); });
    await expect(dock.el.locator(".frame")).toHaveAttribute("dir", "rtl");
  });

  test("RTL: arrow keys on a focused splitter are mirrored", async ({ page }) => {
    await openLab(page);
    await page.evaluate(() => { document.documentElement.dir = "rtl"; window.lab.mount(); });
    const d = new Dock(page);
    await d.gutters().first().focus();
    const w0 = await d.width(d.stack("files"));
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => d.width(d.stack("files"))).toBeGreaterThan(w0);
  });

  test("reduced motion: animations are disabled when the user asks for it", async ({ dock, page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await dock.call("stow", "props");
    await dock.rail().first().click();
    await expect(dock.drawer()).toBeVisible();
    expect(await dock.drawer().evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await dock.rail().first().click();
    await expect(dock.drawer()).toBeVisible();
    expect(await dock.drawer().evaluate((e) => getComputedStyle(e).animationName)).not.toBe("none");
  });
});
