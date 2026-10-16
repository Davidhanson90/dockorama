import { expect, test } from "./helpers/index.js";

test.describe("pop-out windows", () => {
  test("popOut() moves a view into its own browser window and leaves a bring-back placeholder @smoke", async ({ dock, page }) => {
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.evaluate(() => { window.lab.dock().popOut("props"); })]);
    await expect(popup.locator(".dko-tab")).toHaveCount(1);
    await expect(popup.locator('.dko-body > [data-view="props"]')).toBeAttached();
    await expect(dock.el.locator(".away")).toHaveCount(1);
    expect((await dock.model())["outside"][0].views).toEqual(["props"]);
    expect((await dock.events("popout"))[0]!.detail).toMatchObject({ id: "props" });
  });

  test("closing the browser window docks the view again and fires popin", async ({ dock, page }) => {
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.evaluate(() => { window.lab.dock().popOut("props"); })]);
    await popup.close();
    await expect.poll(async () => ((await dock.model())["outside"] ?? []).length).toBe(0);
    await expect(dock.el.locator(".away")).toHaveCount(0);
    expect((await dock.events("popin")).length).toBe(1);
    await expect(dock.stack("props")).toBeVisible();
  });

  test("the bring-back button returns the view and closes the window", async ({ dock, page }) => {
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.evaluate(() => { window.lab.dock().popOut("props"); })]);
    await dock.el.locator(".away button").click();
    await expect.poll(async () => ((await dock.model())["outside"] ?? []).length).toBe(0);
    await expect.poll(() => popup.isClosed()).toBe(true);
  });

  test("several views can share one pop-out window and each has a tab", async ({ dock, page }) => {
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.evaluate(() => { window.lab.dock().popOut("props"); })]);
    const key = (await dock.model())["outside"][0].key as string;
    await page.evaluate((k) => { window.lab.dock().popOut("search", { into: k }); }, key);
    await expect(popup.locator(".dko-tab")).toHaveCount(2);
    await popup.locator('.dko-tab[data-view="props"]').click();
    await expect(popup.locator('.dko-body > [data-view="props"]')).toBeVisible();
  });

  test("the pop-out window is part of the model and the snapshot", async ({ dock, page }) => {
    await Promise.all([page.waitForEvent("popup"), page.evaluate(() => { window.lab.dock().popOut("props"); })]);
    const snap = await dock.snapshot();
    expect(snap["outside"]).toHaveLength(1);
    expect(snap["outside"][0].views).toEqual(["props"]);
  });

  test("a tab menu pop-out command opens a window", async ({ dock, page }) => {
    await dock.openTabMenu("notes.md");
    const [popup] = await Promise.all([page.waitForEvent("popup"), dock.menuItem("popout").click()]);
    await expect(popup.locator('.dko-body > [data-view="notes"]')).toBeAttached();
  });

  test("when the browser blocks the window, popOut returns false and the layout is unchanged", async ({ dock, page }) => {
    await page.evaluate(() => { window.open = () => null; });
    expect(await dock.call<boolean>("popOut", "props")).toBe(false);
    expect((await dock.model())["outside"] ?? []).toHaveLength(0);
    await expect(dock.stack("props")).toBeVisible();
  });

  test("a saved pop-out re-opens on load; if the popup is blocked a notice offers to re-open or keep the views docked", async ({ page }) => {
    const opts = { attrs: { "storage-key": "popout-e2e" } };
    const { Dock } = await import("./helpers/index.js");
    let d = await Dock.mount(page, opts);
    await page.evaluate(() => localStorage.removeItem("popout-e2e"));
    await page.reload();
    d = await Dock.mount(page, opts);
    const [popup] = await Promise.all([page.waitForEvent("popup"), d.call("popOut", "props")]);
    await expect.poll(async () => await page.evaluate(() => localStorage.getItem("popout-e2e") ?? "")).toContain("outside");
    await popup.close().catch(() => undefined);
    await expect.poll(async () => ((await d.model())["outside"] ?? []).length).toBe(0);
    // pop out again, then reload with popups blocked
    await Promise.all([page.waitForEvent("popup"), d.call("popOut", "props")]);
    await page.addInitScript(() => { window.open = () => null; });
    await page.reload();
    d = await Dock.mount(page, opts);
    const notice = d.el.locator("dockorama-notice");
    await expect(notice).toBeVisible();
    expect(await d.prop<string[]>("blockedWindows")).toHaveLength(1);
    await notice.getByRole("button", { name: "Keep them here" }).click();
    await expect(notice).toHaveCount(0);
    expect((await d.model())["outside"] ?? []).toHaveLength(0);
    await expect(d.stack("props")).toBeVisible();
  });

  test("popOut of a view whose caps forbid it does nothing", async ({ dock }) => {
    await dock.call("addView", "nopop", "x", { title: "No pop", caps: { popout: false }, at: { near: "log", zone: "into" } });
    await dock.openTabMenu("No pop");
    await expect(dock.menuItem("popout")).toBeDisabled();
  });
});
