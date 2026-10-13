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
describe("<flexdock-flyout>", () => {
  it("shows a stowed view with keep-open and close, and closes on Escape", async () => {
    const got = requests();
    const el = await put<P>("flexdock-flyout", { view: "a", side: "bottom", ctx: ctx() });
    expect(el.getAttribute("part")).toBe("drawer");
    expect(el.dataset["side"]).toBe("bottom");
    expect(el.querySelector(".title")!.textContent).toBe("Alpha");
    expect(el.querySelector("flexdock-view")!.getAttribute("aria-label")).toBe("Alpha");
    el.querySelector<HTMLButtonElement>('[part~="unstow"]')!.click();
    el.querySelector<HTMLButtonElement>('[part~="close"]')!.click();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(got.map((r) => r.action)).toEqual(["unstow", "dismiss", "peek-close"]);
    el.remove();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(got.length).toBe(3);
  });
  it("hides close when the view cannot be closed", async () => {
    const el = await put<P>("flexdock-flyout", { view: "c", ctx: ctx() });
    expect(el.querySelector('[part~="close"]')).toBeNull();
    const unknown = await put<P>("flexdock-flyout", { view: "q", ctx: ctx() });
    expect(unknown.querySelector(".title")!.textContent).toBe("q");
  });
});
