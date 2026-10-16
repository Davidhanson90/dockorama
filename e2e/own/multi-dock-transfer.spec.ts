import { expect, test, Dock } from "./helpers/index.js";
import type { MountOptions } from "../../harness/lab-main.js";

const two = async (page: import("@playwright/test").Page, groupA = "desk", groupB = "desk") => {
  const a = await Dock.mountWith(page, ({ dk }, g) => ({
    name: "a", attrs: { "drag-group": g },
    model: dk.createModel({ a1: { title: "A one" }, a2: { title: "A two" } }, dk.row([dk.stack(["a1", "a2"])], [1]))
  } as MountOptions), groupA);
  await page.evaluate((g) => { document.getElementById("a")!.style.cssText = "position:absolute;left:0;top:0;width:560px;height:600px"; void g; }, groupB);
  const b = await a.mountAnother("b", {
    attrs: { "drag-group": groupB },
    model: await page.evaluate(() => window.lab.dk.createModel({ b1: { title: "B one" }, b2: { title: "B two" } }, window.lab.dk.row([window.lab.dk.stack(["b1", "b2"])], [1])))
  });
  await page.evaluate(() => { document.getElementById("b")!.style.cssText = "position:absolute;left:600px;top:0;width:560px;height:600px"; });
  await expect(b.stack("b1")).toBeVisible();
  return { a, b };
};

test.describe("dragging between docks", () => {
  test("a tab dragged from one dock to another with the same drag-group moves with its content @smoke", async ({ page }) => {
    const { a, b } = await two(page);
    await a.hold(a.tab("A two"), await b.center(b.stack("b1")));
    await expect(b.hotTarget("into")).toBeVisible();
    await a.release();
    await expect.poll(() => b.order("b1")).toContain("a2");
    await expect(a.stack("a1")).toBeVisible();
    expect(await a.order("a1")).toEqual(["a1"]);
    await expect(b.content("a2")).toBeAttached();
  });

  test("both managers fire transfer with direction and a transfer change", async ({ page }) => {
    const { a, b } = await two(page);
    await a.hold(a.tab("A two"), await b.center(b.stack("b1")));
    await a.release();
    await expect.poll(async () => (await b.events("transfer")).length).toBe(1);
    expect((await a.events("transfer"))[0]!.detail).toMatchObject({ id: "a2", direction: "out" });
    expect((await b.events("transfer"))[0]!.detail).toMatchObject({ id: "a2", direction: "in" });
    expect((await a.events("change")).at(-1)!.detail).toEqual({ reason: "transfer" });
    expect((await b.events("change")).at(-1)!.detail).toEqual({ reason: "transfer" });
  });

  test("docks with different drag-groups never exchange views", async ({ page }) => {
    const { a, b } = await two(page, "one", "two");
    await a.hold(a.tab("A two"), await b.center(b.stack("b1")));
    await expect(b.el.locator(".target")).toHaveCount(0);
    await a.release();
    expect(await b.order("b1")).toEqual(["b1", "b2"]);
  });

  test("the target can veto a transfer with beforemove", async ({ page }) => {
    const { a, b } = await two(page);
    await page.evaluate(() => document.getElementById("b")!.addEventListener("dockorama-beforemove", (e) => e.preventDefault()));
    await a.hold(a.tab("A two"), await b.center(b.stack("b1")));
    await a.release();
    expect(await b.order("b1")).toEqual(["b1", "b2"]);
    expect(await a.order("a1")).toContain("a2");
  });

  test("transferView() moves a view from code, and a clashing id is refused", async ({ page }) => {
    const { a, b } = await two(page);
    await page.evaluate(() => { const A = document.getElementById("a") as unknown as { transferView(id: string, t: unknown, at?: unknown): void }; A.transferView("a2", document.getElementById("b"), { near: "b1", zone: "into" }); });
    await expect.poll(() => b.order("b1")).toContain("a2");
    // same id again (re-add a2 to a, then transfer): refused because b already has "a2"
    await page.evaluate(() => { (document.getElementById("a") as never as { addView(id: string, c: string, o: object): void }).addView("a2", "again", { title: "A two again" }); });
    const clash = await page.evaluate(() => {
      try { (document.getElementById("a") as unknown as { transferView(id: string, t: unknown, at?: unknown): void }).transferView("a2", document.getElementById("b"), { near: "b1", zone: "into" }); return "ok"; } catch (e) { return (e as Error).message; }
    });
    expect(clash).toContain('already has a view with id "a2"');
    await expect(a.stack("a2")).toBeVisible();
  });

  test("transfer is undoable in each dock", async ({ page }) => {
    const { a, b } = await two(page);
    await page.evaluate(() => { (document.getElementById("a") as unknown as { transferView(id: string, t: unknown, at?: unknown): void }).transferView("a2", document.getElementById("b"), { near: "b1", zone: "into" }); });
    await expect.poll(() => b.order("b1")).toContain("a2");
    await b.call("undo");
    await expect.poll(async () => (await b.order("b1")).includes("a2")).toBe(false);
    await a.call("undo");
    await expect.poll(async () => (await a.order("a1")).includes("a2")).toBe(true);
  });

  test("two docks keep independent focus, undo history and state", async ({ page }) => {
    const { a, b } = await two(page);
    await a.tab("A two").click();
    await b.tab("B two").click();
    expect((await a.model())["focus"]).toBe("a2");
    expect((await b.model())["focus"]).toBe("b2");
    await a.call("addView", "extra", "x", { title: "Extra" });
    await b.call("undo");
    await expect(a.tabOf("extra").or(a.stack("extra")).first()).toBeAttached();
  });
});
