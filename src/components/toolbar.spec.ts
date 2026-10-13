import { afterEach, describe, expect, it } from "vitest";
import { createModel, defineParts, docs, row, stack, DEFAULT_LABELS, type DockContext, type PartRequest } from "../index.js";

defineParts();
const views = { a: { title: "Alpha", icon: "★" }, b: { title: "Beta" }, c: { title: "Gamma", caps: { dismiss: false, hide: false, zoom: false, float: false, popout: false, inert: true } } };
export const ctx = (over: Partial<DockContext> = {}): DockContext => ({
  model: createModel(views, row([stack(["a", "b"]), docs(["c"])])), labels: DEFAULT_LABELS, popped: new Set(), dragging: false, ...over
});
async function put<T extends HTMLElement & { updateComplete: Promise<boolean> }>(tag: string, props: Record<string, unknown>): Promise<T> {
  const el = document.createElement(tag) as T;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}
export function requests(): PartRequest[] {
  const out: PartRequest[] = [];
  document.addEventListener("flexdock-request", (e) => out.push((e as CustomEvent<PartRequest>).detail));
  return out;
}
afterEach(() => { document.body.innerHTML = ""; });

type P = HTMLElement & { updateComplete: Promise<boolean> };
describe("<flexdock-toolbar>", () => {
  it("offers stow, zoom, more and close for a docked panel", async () => {
    const got = requests();
    const el = await put<P>("flexdock-toolbar", { view: "a", ctx: ctx() });
    const parts = Array.from(el.querySelectorAll("button")).map((b) => b.getAttribute("part"));
    expect(parts).toEqual(["action stow", "action zoom", "action more", "action close"]);
    for (const b of Array.from(el.querySelectorAll("button"))) {
      b.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      b.click();
    }
    expect(got.map((r) => r.action)).toEqual(["stow", "zoom", "menu", "dismiss"]);
    expect(got.every((r) => r.id === "a")).toBe(true);
  });
  it("respects caps, documents, windows and zoom", async () => {
    const c = ctx();
    const locked = await put<P>("flexdock-toolbar", { view: "c", ctx: c });
    expect(Array.from(locked.querySelectorAll("button")).map((b) => b.getAttribute("part"))).toEqual(["action more"]);
    const doc = await put<P>("flexdock-toolbar", { view: "a", docs: true, ctx: c });
    expect(doc.querySelectorAll("button").length).toBe(2);
    const floating = await put<P>("flexdock-toolbar", { view: "a", win: "w", ctx: c });
    expect(floating.querySelector('[part~="stow"]')).toBeNull();
    const zoomed = await put<P>("flexdock-toolbar", { view: "a", ctx: ctx({ model: { ...c.model, zoom: "a" } }) });
    expect(zoomed.querySelector('[part~="stow"]')).toBeNull();
    expect(zoomed.querySelector('[part~="zoom"]')!.getAttribute("aria-label")).toBe(DEFAULT_LABELS.unzoom);
  });
});
