import { expect, test, Dock } from "./helpers/index.js";

test.describe("documents area", () => {
  test("the documents group is marked and keeps its tabs apart from tool groups @smoke", async ({ dock }) => {
    await expect(dock.el.locator("[data-stack][data-docs]")).toHaveCount(1);
    await expect(dock.el.locator("[data-stack][data-docs]")).toHaveAttribute("data-stack", "main");
  });

  test("closing every document leaves an empty area with a drop hint instead of removing it", async ({ dock }) => {
    for (const id of ["readme", "notes", "main"]) {
      await dock.tabOf(id).locator('[part~="tab-close"]').click({ trial: false }).catch(async () => dock.stackButton(id, "close").click());
    }
    const empty = dock.el.locator("[data-stack][data-empty]");
    await expect(empty).toHaveCount(1);
    await expect(empty).toContainText("Drop a view here");
    await expect(dock.stacks()).toHaveCount(4);
  });

  test("dropping a panel onto the empty documents area opens it there", async ({ dock }) => {
    await dock.call("dismissMany", ["main", "notes", "readme"]);
    const empty = dock.el.locator("[data-stack][data-empty]");
    await expect(empty).toHaveCount(1);
    await dock.hold(dock.tab("Problems"), await dock.center(empty));
    await expect(dock.hotTarget("into")).toBeVisible();
    await dock.release();
    await expect(dock.el.locator("[data-stack][data-docs]:not([data-empty])")).toHaveCount(1);
    expect(await dock.order("problems")).toContain("problems");
    expect((await dock.model())["root"].children[1].children[0].docs).toBe(true);
  });

  test("a view with docsOnly may not be dropped on tool groups", async ({ page }) => {
    const d = await Dock.mountWith(page, ({ dk }) => ({
      model: dk.createModel(
        { doc: { title: "Report", caps: { docsOnly: true } }, other: { title: "Other" }, tool: { title: "Tool" }, tool2: { title: "Tool 2" } },
        dk.row([dk.stack(["tool", "tool2"]), dk.docs(["doc", "other"])], [1, 3])
      )
    }), null);
    await d.hold(d.tab("Report"), await d.center(d.stack("tool")));
    await expect(d.hotTarget("into")).toHaveCount(0);
    await d.release();
    expect(await d.order("tool")).toEqual(["tool", "tool2"]); // never joined the tool group
  });

  test("a docsOnly view dropped on empty space stays in the documents area", async ({ page }) => {
    const d = await Dock.mountWith(page, ({ dk }) => ({
      model: dk.createModel(
        { doc: { title: "Report", caps: { docsOnly: true } }, other: { title: "Other" }, tool: { title: "Tool" } },
        dk.row([dk.stack(["tool"]), dk.docs(["doc", "other"])], [1, 3])
      )
    }), null);
    await d.hold(d.tab("Report"), { x: 700, y: 400 });
    await d.release();
    await expect(d.windows()).toHaveCount(0);
    expect(await d.order("doc")).toEqual(["doc", "other"]);
    await page.evaluate(() => { window.lab.dock().detach("doc"); });
    await expect(d.windows()).toHaveCount(0);
  });

  test("documents can be dragged into a floating window and back to the area", async ({ dock }) => {
    await dock.drag(await dock.center(dock.tab("readme.md")), { x: 600, y: 120 });
    await expect(dock.windows()).toHaveCount(1);
    await expect(dock.window("readme.md")).toBeVisible();
  });

  test("pop-out and float are available for documents by default; permissions can remove them", async ({ page }) => {
    const d = await Dock.mountWith(page, ({ dk }) => ({
      model: dk.createModel(
        { a: { title: "A", caps: { float: false } }, b: { title: "B", caps: { dismiss: false } }, c: { title: "C", caps: { move: false } } },
        dk.row([dk.docs(["a", "b", "c"])], [1])
      )
    }), null);
    await expect(d.tabOf("b").locator('[part~="tab-close"]')).toHaveCount(0);
    await d.openTabMenu("A");
    await expect(d.menuItem("float")).toBeDisabled();
    await page.keyboard.press("Escape");
    const from = await d.center(d.tab("C"));
    await d.drag(from, { x: 500, y: 400 });
    await expect(d.windows()).toHaveCount(0);
    expect(await d.order("c")).toEqual(["a", "b", "c"]);
  });
});
