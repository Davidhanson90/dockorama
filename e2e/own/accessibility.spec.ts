import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./helpers/index.js";
import type { Page } from "@playwright/test";

/** Axe on the lab stage. Rules about page-level landmarks do not apply to a component test page. */
const axe = (page: Page, rules: string[] = []) => new AxeBuilder({ page }).include("#stage").disableRules(["region", "landmark-one-main", "page-has-heading-one", "color-contrast", ...rules]);
/** `nested-interactive` (the close button inside role="tab") is a tracked issue, asserted separately below. */
const KNOWN = ["nested-interactive"];
const violations = async (page: Page) => (await axe(page, KNOWN).analyze()).violations.map((v) => `${v.id}: ${v.nodes.length} (${v.help})`);

test.describe("accessibility", () => {
  test("the default layout has no axe violations @smoke", async ({ dock, page }) => {
    void dock;
    expect(await violations(page)).toEqual([]);
  });

  test("tablists, tabs, tabpanels and groups carry roles and names", async ({ dock }) => {
    await expect(dock.el.getByRole("tablist")).toHaveCount(3);
    await expect(dock.el.getByRole("tab")).toHaveCount(7);
    await expect(dock.el.getByRole("tabpanel")).toHaveCount(3);
    await expect(dock.el.getByRole("group", { name: "Properties" })).toBeVisible();
    await expect(dock.el.getByRole("region", { name: "Properties" })).toBeVisible();
    for (const tab of await dock.el.getByRole("tab").all()) await expect(tab).toHaveAttribute("aria-selected", /true|false/);
  });

  test("only the selected tab of a group is in the tab order (roving tabindex)", async ({ dock }) => {
    await expect(dock.tabOf("main")).toHaveAttribute("tabindex", "0");
    await expect(dock.tabOf("notes")).toHaveAttribute("tabindex", "-1");
    await dock.tab("notes.md").click();
    await expect(dock.tabOf("notes")).toHaveAttribute("tabindex", "0");
    await expect(dock.tabOf("main")).toHaveAttribute("tabindex", "-1");
  });

  test("splitters are separators with a value, are keyboard focusable and have a label", async ({ dock }) => {
    for (const g of await dock.gutters().all()) {
      await expect(g).toHaveAttribute("aria-label", "Resize");
      await expect(g).toHaveAttribute("aria-valuenow", /\d+/);
      await expect(g).toHaveAttribute("tabindex", "0");
    }
  });

  test("icon-only buttons have accessible names", async ({ dock }) => {
    for (const b of await dock.el.locator('[part~="action"]').all()) {
      expect(((await b.getAttribute("aria-label")) ?? "").length).toBeGreaterThan(0);
    }
  });

  test("a floating window is a dialog with a name", async ({ dock }) => {
    await dock.call("detach", "props", { x: 300, y: 150, w: 300, h: 200 });
    await expect(dock.el.getByRole("dialog", { name: "Properties" })).toBeVisible();
  });

  test("the tab menu is a menu with menuitems; checkable items expose aria-checked", async ({ dock }) => {
    await dock.openTabMenu("notes.md");
    await expect(dock.el.getByRole("menu", { name: "Tab actions" })).toBeVisible();
    await expect(dock.el.getByRole("menuitem")).toHaveCount(8);
    await expect(dock.el.getByRole("menuitemcheckbox", { name: "Pin tab" })).toHaveAttribute("aria-checked", "false");
  });

  test("the open tab menu has no axe violations", async ({ dock, page }) => {
    await dock.openTabMenu("notes.md");
    expect(await violations(page)).toEqual([]);
  });

  test("the command palette is a dialog with a combobox and a listbox, and has no axe violations", async ({ dock, page }) => {
    await dock.tab("main.ts").click();
    await page.keyboard.press("Control+.");
    const palette = dock.el.locator("dockorama-palette");
    await expect(palette.getByRole("combobox")).toHaveAttribute("aria-expanded", "true");
    await expect(palette.getByRole("listbox")).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("the confirm dialog is a modal alertdialog and starts on the safe button", async ({ dock, page }) => {
    await dock.call("setDirty", "readme");
    await page.evaluate(() => { void window.lab.dock().dismiss("readme"); });
    const dialog = dock.el.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog.locator("button[data-cancel]")).toBeFocused();
    expect(await violations(page)).toEqual([]);
  });

  test("a flyout and the rail have no axe violations and the rail is a labelled toolbar", async ({ dock, page }) => {
    await dock.call("stow", "props");
    await dock.rail().first().click();
    await expect(dock.el.getByRole("toolbar").first()).toHaveAttribute("aria-label", /\w+/);
    expect(await violations(page)).toEqual([]);
  });

  test("a floating-window layout has no axe violations", async ({ dock, page }) => {
    await dock.call("detach", "props", { x: 300, y: 150, w: 300, h: 200 });
    await expect(dock.windows()).toHaveCount(1);
    expect(await violations(page)).toEqual([]);
  });

  test("dark theme and each skin keep the structure axe-clean", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().theme = "dark"; });
    for (const n of ["nimbus", "ledger", "phosphor"]) {
      await page.evaluate((s) => { window.lab.skins.useSkin(s); }, n);
      await expect(dock.el).toHaveAttribute("data-skin-name", n);
      expect(await violations(page), n).toEqual([]);
    }
  });

  test("a polite live region announces moves and drops", async ({ dock, page }) => {
    await expect(dock.el.locator('.sr[role="status"]')).toHaveCount(1);
    await dock.tab("notes.md").click();
    await page.keyboard.press("Alt+m");
    await expect(dock.el.locator('.sr[role="status"]')).toContainText("Moving");
    await page.keyboard.press("Escape");
  });

  test("RTL layout stays axe-clean", async ({ page }) => {
    const { openLab } = await import("./helpers/index.js");
    await openLab(page);
    await page.evaluate(() => { document.documentElement.dir = "rtl"; window.lab.mount(); });
    await expect(page.locator("#main [data-stack]").first()).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("focus is trapped to the confirm dialog buttons with Tab", async ({ dock, page }) => {
    await dock.call("setDirty", "readme");
    await page.evaluate(() => { void window.lab.dock().dismiss("readme"); });
    const dialog = dock.el.getByRole("alertdialog");
    await expect(dialog.locator("button[data-cancel]")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.locator("button:not([data-cancel])")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.locator("button[data-cancel]")).toBeFocused();
  });

  // KNOWN ISSUE: axe `nested-interactive`: each closable tab (role="tab") contains a close <button>.
  test("no axe nested-interactive violations (close button inside a tab)", async ({ dock, page }) => {
    test.fail(true, "closable tabs nest an interactive button inside role=tab");
    void dock;
    const result = await new AxeBuilder({ page }).include("#stage").withRules(["nested-interactive"]).analyze();
    expect(result.violations).toEqual([]);
  });

  // The accessible name of a tab and of its tabpanel includes the nested close button's label
  // ("main.ts Close main.ts"). Screen readers announce it twice. Tracked, not asserted as fixed.
  test("tab accessible names do not repeat the close button's label", async ({ dock }) => {
    test.fail(true, "the tab's accessible name includes the nested close button label");
    await expect(dock.el.getByRole("tab", { name: "main.ts", exact: true })).toHaveCount(1);
  });
});
