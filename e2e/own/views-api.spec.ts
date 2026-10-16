import { expect, test } from "./helpers/index.js";

test.describe("addView / removeView API", () => {
  test("addView with an element appends it, registers the view and shows it @smoke", async ({ dock, page }) => {
    await page.evaluate(() => {
      const el = document.createElement("div");
      el.id = "chart-el";
      el.textContent = "chart element";
      window.lab.dock().addView("chart", el, { title: "Chart", icon: "📈", at: { near: "main", zone: "into" } });
    });
    await expect(dock.tab("Chart")).toBeVisible();
    await dock.tab("Chart").click();
    await expect(dock.el.locator("#chart-el")).toBeVisible();
    await expect(dock.el.locator("#chart-el")).toHaveAttribute("data-view", "chart");
    expect((await dock.events("change")).at(-1)!.detail).toBeDefined();
    expect(await dock.call("hasView", "chart")).toBe(true);
  });

  test("a string is shown as padded text, never parsed as HTML", async ({ dock, page }) => {
    await dock.call("addView", "note", "<b>bold?</b> plain", { title: "Note", at: { near: "main", zone: "into" } });
    await dock.tab("Note").click();
    const text = dock.el.locator(".dockorama-text");
    await expect(text).toHaveText("<b>bold?</b> plain");
    await expect(text.locator("b")).toHaveCount(0);
    const pad = await text.evaluate((e) => getComputedStyle(e).paddingLeft);
    expect(pad).toBe("14px");
    await page.evaluate(() => { document.getElementById("main")!.style.setProperty("--dk-text-padding", "30px"); });
    await expect.poll(() => text.evaluate((e) => getComputedStyle(e).paddingLeft)).toBe("30px");
  });

  test("a factory is called once, on first show, just before viewshow", async ({ dock, page }) => {
    await page.evaluate(() => {
      (window as unknown as { made: number }).made = 0;
      window.lab.dock().addView("lazy", () => { (window as unknown as { made: number }).made++; const e = document.createElement("div"); e.id = "lazy-el"; e.textContent = "lazy"; return e; }, { title: "Lazy", at: "parked" });
    });
    expect(await page.evaluate(() => (window as unknown as { made: number }).made)).toBe(0);
    await dock.call("reveal", "lazy");
    await expect(dock.el.locator("#lazy-el")).toBeVisible();
    await dock.tab("main.ts").click();
    await dock.call("reveal", "lazy");
    expect(await page.evaluate(() => (window as unknown as { made: number }).made)).toBe(1);
    const shows = (await dock.events("viewshow")).filter((e) => (e.detail as { id: string }).id === "lazy");
    expect(shows.map((e) => (e.detail as { first: boolean }).first)).toEqual([true, false]);
  });

  test("placement options: near/zone, edge, float, stow, parked, docs", async ({ dock }) => {
    await dock.call("addView", "e1", "x", { title: "Edge", at: { edge: "edge-below" } });
    await dock.call("addView", "f1", "x", { title: "Floaty", at: { float: { w: 300, h: 200 } } });
    await dock.call("addView", "s1", "x", { title: "Stowed", at: { stow: "end" } });
    await dock.call("addView", "p1", "x", { title: "Parked", at: "parked" });
    await dock.call("addView", "d1", "x", { title: "Doc", at: "docs" });
    await expect(dock.stack("e1")).toBeVisible();
    await expect(dock.windows()).toHaveCount(1);
    expect((await dock.model())["drawers"]["end"]).toContain("s1");
    expect((await dock.model())["parked"]).toEqual(["p1"]);
    expect(await dock.order("d1")).toEqual(expect.arrayContaining(["main", "d1"]));
  });

  test("beforeadd can veto an addView and nothing is added", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().addEventListener("dockorama-beforeadd", (e) => e.preventDefault()); });
    const result = await page.evaluate(() => { try { window.lab.dock().addView("vetoed", "x", { title: "Vetoed" }); return "ok"; } catch (e) { return (e as Error).message; } });
    expect(result).toBeDefined();
    expect(await dock.call("hasView", "vetoed")).toBe(false);
    expect((await dock.events("beforeadd"))[0]!.cancelable).toBe(true);
  });

  test("removeView returns the element and takes the view out of the dock", async ({ dock, page }) => {
    await page.evaluate(() => { const e = window.lab.dock().removeView("readme") as HTMLElement; (window as unknown as { removed: string }).removed = e.dataset["content"]!; });
    expect(await page.evaluate(() => (window as unknown as { removed: string }).removed)).toBe("readme");
    await expect(dock.tab("readme.md")).toHaveCount(0);
    expect(await dock.call("hasView", "readme")).toBe(false);
    expect((await dock.events("viewremove"))[0]!.detail).toEqual({ id: "readme" });
  });

  test("getViewElement returns the content element, even when the view is hidden", async ({ dock }) => {
    expect(await dock.el.evaluate((el) => (el as unknown as { getViewElement(id: string): Element | null }).getViewElement("readme")?.getAttribute("data-content"))).toBe("readme");
    expect(await dock.el.evaluate((el) => (el as unknown as { getViewElement(id: string): Element | null }).getViewElement("nope"))).toBeNull();
  });

  test("content moves with the view: its DOM state survives re-docking", async ({ dock, page }) => {
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.id = "keep";
      window.lab.dock().addView("form", input, { title: "Form", at: { near: "main", zone: "into" } });
    });
    await dock.tab("Form").click();
    await dock.el.locator("#keep").fill("typed text");
    await dock.dragTabToZone("Form", "log", "right");
    await expect(dock.el.locator("#keep")).toHaveValue("typed text");
  });

  test("retain=active keeps only the active view's content attached", async ({ dock, page }) => {
    await page.evaluate(() => { window.lab.dock().setAttribute("retain", "active"); });
    await dock.tab("notes.md").click();
    await expect(dock.content("notes")).toBeVisible();
    await expect(dock.content("main")).toBeHidden();
  });

  test("showPreview and promote manage a preview tab", async ({ dock }) => {
    await dock.call("addView", "pv", "x", { title: "pv.ts", at: { near: "main", zone: "into" } });
    await dock.call("showPreview", "pv");
    await dock.call("promote", "pv");
    await expect(dock.tab("pv.ts")).toBeVisible();
  });

  test("reveal() brings a hidden or stowed view into sight", async ({ dock }) => {
    await dock.call("stow", "props");
    await dock.call("reveal", "props");
    await expect(dock.drawer().or(dock.stack("props")).first()).toBeVisible();
    await dock.call("reveal", "notes");
    await expect(dock.tab("notes.md")).toHaveAttribute("aria-selected", "true");
  });

  test("caps.inert makes content non-interactive", async ({ dock, page }) => {
    await page.evaluate(() => {
      const b = document.createElement("button");
      b.id = "inert-btn";
      b.textContent = "no";
      window.lab.dock().addView("inert", b, { title: "Inert", caps: { inert: true }, at: { near: "log", zone: "into" } });
    });
    await dock.tab("Inert").click();
    expect(await dock.el.locator("#inert-btn").evaluate((e) => getComputedStyle(e.closest("[data-view]") ?? e).pointerEvents)).toBe("none");
  });
});
