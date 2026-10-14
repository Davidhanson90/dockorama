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

describe("<pazuru-gutter>", () => {
  it("is an accessible separator and reports pointer and key input", async () => {
    const got = requests();
    const el = await put<HTMLElement & { updateComplete: Promise<boolean> }>("pazuru-gutter", { path: [1, 0], index: 2, win: "w", axis: "column", weights: [1, 1, 1], value: 40, label: "Size" });
    expect(el.getAttribute("role")).toBe("separator");
    expect(el.tabIndex).toBe(0);
    expect(el.getAttribute("aria-orientation")).toBe("horizontal");
    expect(el.getAttribute("aria-label")).toBe("Size");
    expect(el.getAttribute("aria-valuenow")).toBe("40");
    expect(el.dataset["path"]).toBe("1.0");
    expect(el.dataset["after"]).toBe("2");
    expect(el.dataset["win"]).toBe("w");
    el.dispatchEvent(new Event("pointerdown"));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(got.map((r) => r.action)).toEqual(["gutter-grab", "gutter-key"]);
    expect(got[0]).toMatchObject({ path: [1, 0], after: 2, axis: "column", win: "w", source: el });
    expect(got[1]).toMatchObject({ weights: [1, 1, 1] });
    el.remove();
    el.dispatchEvent(new Event("pointerdown"));
    expect(got.length).toBe(2);
  });
  it("defaults to a vertical row gutter", async () => {
    const el = await put<HTMLElement & { updateComplete: Promise<boolean> }>("pazuru-gutter", {});
    expect(el.getAttribute("aria-orientation")).toBe("vertical");
    expect(el.dataset["win"]).toBe("");
    expect(el.hasAttribute("data-drop")).toBe(false);
  });
});
