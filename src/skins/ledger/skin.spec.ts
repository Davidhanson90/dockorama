import { afterEach, describe, expect, it } from "vitest";
import { createModel, docs, row, stack } from "../../index.js";
import { useSkin, templateFor } from "../core.js";
import { defaultSkin } from "../default/skin.js";
import { ledger } from "./skin.js";

const views = { a: { title: "Alpha" }, b: { title: "Beta" }, c: { title: "Gamma" } };
afterEach(() => {
  document.body.innerHTML = "";
  useSkin(defaultSkin);
});

describe("ledger skin", () => {
  it("is registered, overrides some templates and inherits the rest", () => {
    expect(ledger.name).toBe("ledger");
    expect(Object.keys(ledger.templates).length).toBeGreaterThan(0);
    for (const key of Object.keys(ledger.templates) as Array<keyof typeof ledger.templates>) expect(templateFor(key, { skin: ledger })).toBe(ledger.templates[key]);
    expect(templateFor("confirm", { skin: ledger })).toBe(defaultSkin.templates.confirm);
    expect(ledger.css).toMatch(/--fd-accent/);
  });

  it("styles a dock when imported page-wide, and a single dock through its skin attribute", async () => {
    await import("./index.js");
    const el = document.createElement("flexdock-manager");
    for (const id of Object.keys(views)) {
      const d = document.createElement("div");
      d.dataset["view"] = id;
      el.append(d);
    }
    document.body.append(el);
    el.model = createModel(views, row([stack(["a"]), docs(["b", "c"])]));
    await el.updateComplete;
    expect(el.dataset["skinName"]).toBe("ledger");
    const css = el.shadowRoot!.querySelector("style[data-skin]")!.textContent!;
    expect(css).toContain(ledger.css.trim().slice(0, 40));
    useSkin(defaultSkin);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("style[data-skin]")!.textContent).toBe("");
    el.setAttribute("skin", "ledger");
    await el.updateComplete;
    expect(el.dataset["skinName"]).toBe("ledger");
    expect(el.shadowRoot!.querySelector("style[data-skin]")!.textContent).not.toBe("");
  });
});
