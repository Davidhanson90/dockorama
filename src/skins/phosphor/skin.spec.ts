import { afterEach, describe, expect, it } from "vitest";
import { createModel, docs, row, stack } from "../../index.js";
import { useSkin, templateFor } from "../core.js";
import { defaultSkin } from "../default/skin.js";
import { phosphor } from "./skin.js";

const views = { a: { title: "Alpha" }, b: { title: "Beta" }, c: { title: "Gamma" } };
afterEach(() => {
  document.body.innerHTML = "";
  useSkin(defaultSkin);
});

describe("phosphor skin", () => {
  it("is registered, overrides some templates and inherits the rest", () => {
    expect(phosphor.name).toBe("phosphor");
    expect(Object.keys(phosphor.templates).length).toBeGreaterThan(0);
    for (const key of Object.keys(phosphor.templates) as Array<keyof typeof phosphor.templates>) expect(templateFor(key, { skin: phosphor })).toBe(phosphor.templates[key]);
    expect(templateFor("confirm", { skin: phosphor })).toBe(defaultSkin.templates.confirm);
    expect(phosphor.css).toMatch(/--dk-accent/);
  });

  it("styles a dock when imported page-wide, and a single dock through its skin attribute", async () => {
    await import("./index.js");
    const el = document.createElement("dockorama-manager");
    for (const id of Object.keys(views)) {
      const d = document.createElement("div");
      d.dataset["view"] = id;
      el.append(d);
    }
    document.body.append(el);
    el.model = createModel(views, row([stack(["a"]), docs(["b", "c"])]));
    await el.updateComplete;
    expect(el.dataset["skinName"]).toBe("phosphor");
    const css = el.shadowRoot!.querySelector("style[data-skin]")!.textContent!;
    expect(css).toContain(phosphor.css.trim().slice(0, 40));
    useSkin(defaultSkin);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("style[data-skin]")!.textContent).toBe("");
    el.setAttribute("skin", "phosphor");
    await el.updateComplete;
    expect(el.dataset["skinName"]).toBe("phosphor");
    expect(el.shadowRoot!.querySelector("style[data-skin]")!.textContent).not.toBe("");
  });
});
