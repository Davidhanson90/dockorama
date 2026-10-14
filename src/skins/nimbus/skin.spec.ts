import { afterEach, describe, expect, it } from "vitest";
import { createModel, docs, row, stack } from "../../index.js";
import { useSkin, templateFor } from "../core.js";
import { defaultSkin } from "../default/skin.js";
import { nimbus } from "./skin.js";

const views = { a: { title: "Alpha" }, b: { title: "Beta" }, c: { title: "Gamma" } };
afterEach(() => {
  document.body.innerHTML = "";
  useSkin(defaultSkin);
});

describe("nimbus skin", () => {
  it("is registered, overrides some templates and inherits the rest", () => {
    expect(nimbus.name).toBe("nimbus");
    expect(Object.keys(nimbus.templates).length).toBeGreaterThan(0);
    for (const key of Object.keys(nimbus.templates) as Array<keyof typeof nimbus.templates>) expect(templateFor(key, { skin: nimbus })).toBe(nimbus.templates[key]);
    expect(templateFor("confirm", { skin: nimbus })).toBe(defaultSkin.templates.confirm);
    expect(nimbus.css).toMatch(/--pz-accent/);
  });

  it("styles a dock when imported page-wide, and a single dock through its skin attribute", async () => {
    await import("./index.js");
    const el = document.createElement("pazuru-manager");
    for (const id of Object.keys(views)) {
      const d = document.createElement("div");
      d.dataset["view"] = id;
      el.append(d);
    }
    document.body.append(el);
    el.model = createModel(views, row([stack(["a"]), docs(["b", "c"])]));
    await el.updateComplete;
    expect(el.dataset["skinName"]).toBe("nimbus");
    const css = el.shadowRoot!.querySelector("style[data-skin]")!.textContent!;
    expect(css).toContain(nimbus.css.trim().slice(0, 40));
    useSkin(defaultSkin);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("style[data-skin]")!.textContent).toBe("");
    el.setAttribute("skin", "nimbus");
    await el.updateComplete;
    expect(el.dataset["skinName"]).toBe("nimbus");
    expect(el.shadowRoot!.querySelector("style[data-skin]")!.textContent).not.toBe("");
  });
});
