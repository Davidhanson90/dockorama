import { expect, test } from "./helpers/index.js";

test.describe("layout minimap", () => {
  const addMap = (page: import("@playwright/test").Page) => page.evaluate(() => {
    const mm = document.createElement("dockorama-minimap");
    mm.setAttribute("for", "main");
    mm.id = "map";
    mm.style.cssText = "position:absolute;left:1210px;top:10px;width:260px;height:160px";
    document.body.append(mm);
  });

  test("mirrors the layout of the manager it is attached to @smoke", async ({ dock, page }) => {
    await addMap(page);
    const map = page.locator("#map");
    await expect(map.getByRole("img", { name: "Layout overview" })).toBeVisible();
    for (const t of ["Files", "main.ts", "Output", "Properties"]) await expect(map.getByRole("button", { name: new RegExp(t) })).toHaveCount(1);
    void dock;
  });

  test("it follows layout changes live", async ({ dock, page }) => {
    await addMap(page);
    await dock.dragTabToZone("notes.md", "log", "right");
    await expect(page.locator("#map").getByRole("button", { name: /notes\.md/ })).toBeVisible();
    await dock.call("undo");
    await expect(page.locator("#map").getByRole("button", { name: /Output/ })).toBeVisible();
  });

  test("the active group is marked", async ({ dock, page }) => {
    await addMap(page);
    await dock.tab("notes.md").click();
    await expect(page.locator("#map button[data-active]")).toHaveAttribute("title", "notes.md");
  });

  test("clicking a block reveals that view in the dock", async ({ dock, page }) => {
    await addMap(page);
    await page.locator("#map").getByRole("button", { name: /Output/ }).click();
    expect((await dock.model())["focus"]).toBe("log");
  });

  test("floating windows are drawn as overlays in the minimap", async ({ dock, page }) => {
    await addMap(page);
    await dock.call("detach", "props", { x: 300, y: 150, w: 300, h: 200 });
    await expect(page.locator("#map .win")).toHaveCount(1);
    await dock.call("undo");
    await expect(page.locator("#map .win")).toHaveCount(0);
  });

  test("a minimap with no matching manager renders nothing and does not error", async ({ page }) => {
    await page.evaluate(() => {
      const mm = document.createElement("dockorama-minimap");
      mm.setAttribute("for", "nope");
      document.body.append(mm);
    });
    await expect(page.locator("dockorama-minimap")).toHaveCount(1);
  });
});
