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
  document.addEventListener("pazuru-request", (e) => out.push((e as CustomEvent<PartRequest>).detail));
  return out;
}
afterEach(() => { document.body.innerHTML = ""; });

type P = HTMLElement & { updateComplete: Promise<boolean> };
describe("<pazuru-view>", () => {
  it("hosts a named slot for the view's content", async () => {
    const el = await put<P>("pazuru-view", { view: "a", kind: "tabpanel", labelledBy: "tab-a", ctx: ctx() });
    expect(el.getAttribute("part")).toBe("body");
    expect(el.getAttribute("role")).toBe("tabpanel");
    expect(el.getAttribute("aria-labelledby")).toBe("tab-a");
    expect(el.hasAttribute("aria-label")).toBe(false);
    expect(el.querySelector("slot")!.name).toBe("v:a");
  });
  it("marks inert views, shows popped-out and empty states", async () => {
    const got = requests();
    const inert = await put<P>("pazuru-view", { view: "c", label: "Gamma", ctx: ctx() });
    expect(inert.hasAttribute("data-inert")).toBe(true);
    expect(inert.getAttribute("aria-label")).toBe("Gamma");
    expect(inert.getAttribute("role")).toBe("region");
    const away = await put<P>("pazuru-view", { view: "a", ctx: ctx({ popped: new Set(["a"]) }) });
    expect(away.querySelector(".away")!.textContent).toContain(DEFAULT_LABELS.poppedOut);
    away.querySelector("button")!.click();
    expect(got).toEqual([expect.objectContaining({ action: "popin", id: "a" })]);
    const empty = await put<P>("pazuru-view", { ctx: ctx() });
    expect(empty.querySelector(".empty")!.textContent).toBe(DEFAULT_LABELS.emptyDocs);
  });
});
