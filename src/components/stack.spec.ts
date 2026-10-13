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
describe("<flexdock-stack>", () => {
  it("renders a tab strip, toolbar and content host for several views", async () => {
    const c = ctx();
    c.model = { ...c.model, focus: "b" };
    const group = { ...stack(["a", "b"]), current: "b" };
    const el = await put<P>("flexdock-stack", { group, path: [0], ctx: c });
    expect(el.getAttribute("part")).toBe("group");
    expect(el.dataset["stack"]).toBe("a");
    expect(el.dataset["path"]).toBe("0");
    expect(el.hasAttribute("data-tabs")).toBe(true);
    expect(el.hasAttribute("data-active")).toBe(true);
    expect(el.getAttribute("role")).toBe("group");
    expect(el.getAttribute("aria-label")).toBe("Beta");
    expect(el.querySelectorAll("flexdock-tab").length).toBe(2);
    expect(el.querySelector("flexdock-toolbar")).not.toBeNull();
    const body = el.querySelector("flexdock-view")!;
    expect(body.getAttribute("role")).toBe("tabpanel");
    expect(body.getAttribute("aria-labelledby")).toBe("tab-b");
  });
  it("shows a title for a single view and sends activate, grab and zoom", async () => {
    const got = requests();
    const el = await put<P>("flexdock-stack", { group: stack(["a"]), path: [], win: "w", ctx: ctx() });
    expect(el.querySelector(".title")!.textContent).toContain("Alpha");
    expect(el.querySelector(".glyph")!.textContent).toBe("★");
    expect(el.querySelector("flexdock-view")!.getAttribute("role")).toBe("region");
    const bar = el.querySelector<HTMLElement>(".bar")!;
    bar.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    bar.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(got.map((r) => r.action)).toEqual(["grab", "activate", "zoom"]);
    expect(got[0]).toMatchObject({ id: "a", win: "w", source: bar });
  });
  it("is empty without views", async () => {
    const got = requests();
    const el = await put<P>("flexdock-stack", { group: stack([]), path: [2], ctx: ctx() });
    expect(el.hasAttribute("data-empty")).toBe(true);
    expect(el.dataset["stack"]).toBe("docs-2");
    expect(el.getAttribute("aria-label")).toBe(DEFAULT_LABELS.emptyDocs);
    expect(el.querySelector("flexdock-toolbar")).toBeNull();
    el.querySelector<HTMLElement>(".bar")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    el.querySelector<HTMLElement>(".bar")!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(got.map((r) => r.action)).toEqual(["activate"]);
  });
});
