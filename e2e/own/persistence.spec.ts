import { expect, test, Dock, openLab } from "./helpers/index.js";

const KEY = "e2e-persist";

test.describe("persistence, versions and workspaces", () => {
  test("snapshot() returns plain JSON and restore() brings the same layout back @smoke", async ({ dock }) => {
    const snap = await dock.snapshot();
    expect(snap["v"]).toBe(1);
    expect(Object.keys(snap["views"])).toContain("notes");
    await dock.dragTabToZone("notes.md", "log", "right");
    await expect(dock.stack("notes")).toBeVisible();
    await dock.call("restore", snap);
    await expect(dock.stack("notes")).toHaveCount(0);
    expect(await dock.order("main")).toEqual(["main", "notes", "readme"]);
    expect((await dock.events("change")).at(-1)!.detail).toEqual({ reason: "restore" });
  });

  test("a snapshot survives JSON.stringify and parse", async ({ dock }) => {
    await dock.call("detach", "props", { x: 300, y: 150, w: 300, h: 200 });
    await dock.call("stow", "log");
    const snap = await dock.snapshot();
    await dock.call("restore", JSON.parse(JSON.stringify(snap)));
    expect((await dock.model())["windows"]).toHaveLength(1);
    expect(Object.values((await dock.model())["drawers"]).flat()).toEqual(["log"]);
  });

  test("storage-key saves after every change and a reload restores the layout", async ({ page }) => {
    await openLab(page);
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
    let d = await Dock.mount(page, { attrs: { "storage-key": KEY } });
    await d.dragTabToZone("notes.md", "log", "right");
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), KEY)).toContain('"notes"');
    await page.reload();
    d = await Dock.mount(page, { attrs: { "storage-key": KEY } });
    await expect(d.stack("notes")).toBeVisible();
    expect((await d.events("change"))[0]!.detail).toMatchObject({ reason: expect.stringMatching(/storage|restore|set/) });
  });

  test("two managers with different storage keys keep separate layouts", async ({ page }) => {
    await openLab(page);
    await page.evaluate(() => { localStorage.removeItem("k1"); localStorage.removeItem("k2"); });
    const a = await Dock.mount(page, { name: "a", attrs: { "storage-key": "k1" } });
    await a.mountAnother("b", { attrs: { "storage-key": "k2" } });
    await a.call("stow", "props");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("k1"))).toContain('"end":["props"]');
    expect((await page.evaluate(() => localStorage.getItem("k2"))) ?? "").not.toContain('"end":["props"]');
  });

  test("unparseable stored JSON is ignored and the app's own layout is used", async ({ page }) => {
    await openLab(page);
    await page.evaluate((k) => localStorage.setItem(k, "{not json"), KEY);
    const d = await Dock.mount(page, { attrs: { "storage-key": KEY } });
    await expect(d.stack("files")).toBeVisible();
    await expect(d.stacks()).toHaveCount(4);
  });

  // KNOWN GAP: a structurally invalid stored layout fires layoutissue, but unparseable JSON is dropped silently.
  test("unparseable stored JSON also reports a fatal layoutissue (source: storage)", async ({ page }) => {
    test.fail(true, "no dockorama-layoutissue is fired for JSON that cannot be parsed");
    await openLab(page);
    await page.evaluate((k) => localStorage.setItem(k, "{not json"), KEY);
    const d = await Dock.mount(page, { attrs: { "storage-key": KEY } });
    const issues = await d.events("layoutissue");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.detail).toMatchObject({ source: "storage", fatal: true });
  });

  test("restore() of an invalid model throws, fires layoutissue (fatal) and keeps the current layout", async ({ dock, page }) => {
    const message = await page.evaluate(() => { try { window.lab.dock().restore({ nope: true } as never); return "no error"; } catch (e) { return (e as Error).message; } });
    expect(message).toContain("not a usable layout model");
    const issues = await dock.events("layoutissue");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.detail).toMatchObject({ source: "restore", fatal: true });
    await expect(dock.stacks()).toHaveCount(4);
  });

  test("a model with an unknown view reports non-fatal problems and is repaired", async ({ dock, page }) => {
    const snap = await dock.snapshot();
    snap["root"].children[0].views.push("ghost");
    await page.evaluate((m) => { window.lab.dock().restore(m as never); }, snap);
    const issues = await dock.events("layoutissue");
    expect(issues.at(-1)!.detail).toMatchObject({ source: "restore", fatal: false });
    expect(JSON.stringify(issues.at(-1)!.detail)).toContain("ghost");
    await expect(dock.stack("files")).toBeVisible();
  });

  test("layout versions: an old saved layout is migrated step by step before use", async ({ page }) => {
    await openLab(page);
    const base = await page.evaluate(() => window.lab.standard());
    await page.evaluate(([k, m]) => localStorage.setItem(k as string, JSON.stringify({ ...(m as object), version: 0 })), [KEY, base] as const);
    await page.evaluate((k) => {
      const m = document.createElement("dockorama-manager") as import("dockorama").DockoramaManager;
      m.id = "mig";
      m.layoutVersion = 2;
      m.migrations = {
        0: (x) => ({ ...x, views: { ...x.views, added: { title: "Added" } }, parked: [...x.parked, "added"] }),
        1: (x) => ({ ...x, views: { ...x.views, files: { ...x.views["files"]!, title: "Renamed" } } })
      };
      m.addEventListener("dockorama-layoutissue", (e) => ((window as unknown as { issues: unknown[] }).issues ??= []).push(e.detail));
      m.setAttribute("storage-key", k);
      document.getElementById("stage")!.append(m);
      const base = window.lab.standard();
      for (const id of Object.keys(base.views)) { const c = window.lab.text(id); c.setAttribute("data-view", id); m.append(c); }
      m.model = base;
    }, KEY);
    const m = new Dock(page, "mig");
    await expect(m.stack("files")).toContainText("Renamed");
    expect((await m.model())["version"]).toBe(2);
    expect((await m.model())["parked"]).toContain("added");
  });

  test("a stored layout newer than layoutVersion is fatal and ignored", async ({ page }) => {
    await openLab(page);
    await page.evaluate(([k]) => localStorage.setItem(k as string, JSON.stringify({ ...window.lab.standard(), version: 9 })), [KEY]);
    await page.evaluate((k) => {
      const m = document.createElement("dockorama-manager") as import("dockorama").DockoramaManager;
      m.id = "newer";
      m.layoutVersion = 2;
      m.migrations = { 0: (x) => x, 1: (x) => x };
      m.addEventListener("dockorama-layoutissue", (e) => ((window as unknown as { issues: unknown[] }).issues ??= []).push(e.detail));
      m.setAttribute("storage-key", k);
      document.getElementById("stage")!.append(m);
      const base = window.lab.standard();
      for (const id of Object.keys(base.views)) { const c = window.lab.text(id); c.setAttribute("data-view", id); m.append(c); }
      m.model = base;
    }, KEY);
    const issues = await page.evaluate(() => (window as unknown as { issues: Array<{ fatal: boolean; source: string }> }).issues);
    expect(issues[0]).toMatchObject({ fatal: true, source: "storage" });
    await expect(new Dock(page, "newer").stack("files")).toBeVisible();
  });

  test("Workspaces stores named layouts you can list, load and remove", async ({ dock, page }) => {
    const out = await page.evaluate(() => {
      const ws = new window.lab.dk.Workspaces("e2e-ws");
      localStorage.removeItem("e2e-ws");
      const m = window.lab.dock();
      ws.save("one", m.snapshot());
      m.detach("props", { x: 300, y: 150, w: 300, h: 200 });
      ws.save("two", m.snapshot());
      const names = ws.names();
      m.restore(ws.load("one")!);
      const afterOne = m.model.windows.length;
      m.restore(ws.load("two")!);
      const afterTwo = m.model.windows.length;
      ws.remove("one");
      return { names, afterOne, afterTwo, left: ws.names(), missing: ws.load("one") ?? null };
    });
    expect(out).toEqual({ names: ["one", "two"], afterOne: 0, afterTwo: 1, left: ["two"], missing: null });
    await expect(dock.windows()).toHaveCount(1);
  });

  test("layout is saved only after the model changes, not on tab selection alone", async ({ page }) => {
    await openLab(page);
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
    const d = await Dock.mount(page, { attrs: { "storage-key": KEY } });
    await d.tab("notes.md").click();
    await d.call("stow", "props");
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), KEY)).toContain('"end":["props"]');
  });
});
