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

describe("<flexdock-split>", () => {
  it("renders cells with weights and a gutter between each pair", async () => {
    const node = row([stack(["a"]), stack(["b"]), docs([])], [1, 2, 1]);
    const el = await put<HTMLElement & { updateComplete: Promise<boolean> }>("flexdock-split", { node, path: [], ctx: ctx() });
    expect(el.classList.contains("split")).toBe(true);
    expect(el.getAttribute("part")).toBe("split");
    expect(el.dataset["axis"]).toBe("row");
    const cells = el.querySelectorAll(":scope > .cell");
    expect(cells.length).toBe(3);
    expect((cells[1] as HTMLElement).style.flex).toContain("2");
    const gutters = el.querySelectorAll("flexdock-gutter");
    expect(gutters.length).toBe(2);
    expect(gutters[0]!.getAttribute("aria-valuenow")).toBe("25");
    expect(el.querySelector("flexdock-docs")).not.toBeNull();
  });
  it("marks the gutter under a drag and nests splits", async () => {
    const node = row([stack(["a"]), { kind: "split", axis: "column", children: [stack(["b"]), stack(["c"])], weights: [1, 1] }]);
    const el = await put<HTMLElement & { updateComplete: Promise<boolean> }>("flexdock-split", { node, path: [], win: "w1", ctx: ctx({ gap: { path: "", after: 0, win: "w1" } }) });
    expect(el.querySelector(":scope > flexdock-gutter")!.hasAttribute("data-drop")).toBe(true);
    const inner = el.querySelector("flexdock-split")!;
    expect(inner.dataset["axis"]).toBe("column");
    expect(inner.querySelector("flexdock-gutter")!.getAttribute("data-path")).toBe("1");
    expect(inner.querySelector("flexdock-gutter")!.hasAttribute("data-drop")).toBe(false);
  });
});
