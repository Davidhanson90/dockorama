import { html } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import { FlexdockManager, createModel, docs, row, stack } from "../index.js";
import { activeSkin, clearSkinOverrides, cssFor, defineSkin, extendSkin, overrideSkin, skinNamed, skinNames, templateFor, useSkin } from "./core.js";
import { defaultSkin } from "./default/skin.js";
import { templates } from "./default/templates.js";

const views = { a: { title: "Alpha" }, b: { title: "Beta" }, c: { title: "Gamma" } };
async function mount(setup?: (el: FlexdockManager) => void): Promise<FlexdockManager> {
  const el = document.createElement("flexdock-manager");
  setup?.(el);
  for (const id of Object.keys(views)) {
    const d = document.createElement("div");
    d.dataset["view"] = id;
    el.append(d);
  }
  document.body.append(el);
  el.model = createModel(views, row([stack(["a"]), docs(["b", "c"])]));
  await el.updateComplete;
  return el;
}
const q = (el: FlexdockManager, sel: string) => el.shadowRoot!.querySelector<HTMLElement>(sel);
const skinCss = (el: FlexdockManager) => el.shadowRoot!.querySelector<HTMLStyleElement>("style[data-skin]")?.textContent ?? "";

afterEach(() => {
  document.body.innerHTML = "";
  clearSkinOverrides();
  useSkin(defaultSkin);
});

describe("skin registry", () => {
  it("has a template for every key in the default skin, and falls back to it", () => {
    expect(activeSkin()).toBe(defaultSkin);
    for (const key of Object.keys(templates) as Array<keyof typeof templates>) expect(templateFor(key)).toBe(templates[key]);
    const bare = defineSkin("bare-test");
    expect(templateFor("tab-label", { skin: bare })).toBe(templates["tab-label"]);
    expect(skinNamed("bare-test")).toBe(bare);
    expect(skinNames()).toContain("default");
  });

  it("resolves per-dock patch, then page-wide patches (newest first), then the skin chain", () => {
    const a = () => html`a`;
    const b = () => html`b`;
    const c = () => html`c`;
    const d = () => html`d`;
    const base = defineSkin("chain-base", { templates: { "tab-label": a }, css: ".x{}" });
    const child = extendSkin(base, "chain-child", { css: ".y{}" });
    expect(templateFor("tab-label", { skin: child })).toBe(a);
    const off = overrideSkin({ templates: { "tab-label": b }, css: ".z{}" });
    overrideSkin({ templates: { "tab-label": c } });
    expect(templateFor("tab-label", { skin: child })).toBe(c);
    expect(templateFor("tab-label", { skin: child, patch: { templates: { "tab-label": d } } })).toBe(d);
    expect(cssFor({ skin: child, patch: { css: ".w{}" } })).toBe(".x{}\n.y{}\n.z{}\n.w{}");
    off();
    expect(cssFor({ skin: child })).toBe(".x{}\n.y{}");
    expect(() => useSkin("nope")).toThrow(/unknown skin/);
  });
});

describe("skins on a dock", () => {
  it("renders through the page-wide skin and re-renders when it changes", async () => {
    const el = await mount();
    expect(q(el, ".tab .label")!.textContent).toBe("Beta");
    useSkin(defineSkin("shout", { templates: { "tab-label": (c) => html`<span class="label">${c.title.toUpperCase()}</span>` }, css: ".tab{color:red}" }));
    await el.updateComplete;
    expect(q(el, ".tab .label")!.textContent).toBe("BETA");
    expect(skinCss(el)).toContain(".tab{color:red}");
    expect(el.dataset["skinName"]).toBe("shout");
  });

  it("overrides one template page-wide on top of any skin, and removes it again", async () => {
    const el = await mount();
    const off = overrideSkin({ templates: { "tab-close-button": (c) => html`<button class="btn mine" @click=${(e: Event) => { e.stopPropagation(); c.close(); }}>close</button>` }, css: ".mine{color:blue}" });
    await el.updateComplete;
    expect(q(el, ".tab .mine")).not.toBeNull();
    expect(skinCss(el)).toContain(".mine{color:blue}");
    q(el, ".tab .mine")!.click();
    await el.updateComplete;
    expect(el.model.parked).toContain("b");
    off();
    await el.updateComplete;
    expect(q(el, ".tab .mine")).toBeNull();
  });

  it("supports a per-dock skin (attribute or object) and per-dock patch that beat the page-wide ones", async () => {
    defineSkin("by-name", { templates: { "view-empty": (c) => html`<div class="empty named">${c.label}</div>` } });
    overrideSkin({ templates: { "group-title": (c) => html`<span class="title global">${c.title}</span>` } });
    const one = await mount((el) => el.setAttribute("skin", "by-name"));
    const two = await mount((el) => {
      el.skinPatch = { templates: { "group-title": (c) => html`<span class="title local">${c.title}!</span>` }, css: ".local{}" };
    });
    expect(q(one, ".title.global")!.textContent).toBe("Alpha");
    expect(q(two, ".title.local")!.textContent).toBe("Alpha!");
    expect(skinCss(two)).toContain(".local{}");
    expect(skinCss(one)).not.toContain(".local{}");
    expect(one.dataset["skinName"]).toBe("by-name");
    two.skinPatch = undefined;
    await two.updateComplete;
    expect(q(two, ".title.global")).not.toBeNull();
  });
});
