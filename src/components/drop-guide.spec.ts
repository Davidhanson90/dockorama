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
describe("<flexdock-drop-guide>", () => {
  it("draws targets, the preview and the ghost", async () => {
    const el = await put<P>("flexdock-drop-guide", {
      spots: [{ zone: "left", x: 5, y: 6, hot: true }, { zone: "into", x: 1, y: 1, hot: false }, { zone: "edge-below", x: 2, y: 2, hot: false },
        { zone: "between", x: 3, y: 3, hot: true }, { zone: "odd", x: 0, y: 0, hot: false }],
      preview: { left: 1, top: 2, width: 30, height: 40 },
      ghost: { x: 7, y: 8, label: "Alpha" }
    });
    expect(el.getAttribute("part")).toBe("overlay");
    const targets = el.querySelectorAll<HTMLElement>(".target");
    expect(targets.length).toBe(5);
    expect(targets[0]!.hasAttribute("data-hot")).toBe(true);
    expect(targets[0]!.style.left).toBe("5px");
    expect(targets[1]!.hasAttribute("data-hot")).toBe(false);
    expect(el.querySelector<HTMLElement>(".preview")!.style.width).toBe("30px");
    expect(el.querySelector(".ghost")!.textContent).toBe("Alpha");
  });
  it("can be empty", async () => {
    const el = await put<P>("flexdock-drop-guide", {});
    expect(el.querySelector(".preview, .ghost, .target")).toBeNull();
  });
});
