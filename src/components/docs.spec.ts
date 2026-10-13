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
describe("<flexdock-docs>", () => {
  it("is a document group with closable tabs", async () => {
    const el = await put<P>("flexdock-docs", { group: docs(["a", "b"]), path: [1], ctx: ctx() });
    expect(el.getAttribute("part")).toBe("group docs");
    expect(el.hasAttribute("data-docs")).toBe(true);
    expect(el.querySelectorAll('[part="tab-close"]').length).toBe(2);
    expect(el.querySelector('[part~="stow"]')).toBeNull();
    expect(el.querySelector('[part~="close"]')).toBeNull();
  });
  it("shows the drop zone when empty, and still tabs for one document", async () => {
    const empty = await put<P>("flexdock-docs", { group: docs([]), path: [], ctx: ctx() });
    expect(empty.hasAttribute("data-empty")).toBe(true);
    expect(empty.querySelector(".empty")!.textContent).toBe(DEFAULT_LABELS.emptyDocs);
    const one = await put<P>("flexdock-docs", { group: docs(["c"]), path: [], ctx: ctx() });
    expect(one.querySelectorAll("flexdock-tab").length).toBe(1);
    expect(one.querySelector('[part="tab-close"]')).toBeNull();
  });
});
