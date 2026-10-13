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
describe("<flexdock-window>", () => {
  it("positions a dialog with its own tree and sends raise and grip", async () => {
    const got = requests();
    const el = await put<P>("flexdock-window", { key: "w1", box: { x: 10, y: 20, w: 300, h: 200 }, tree: stack(["a", "b"]), layer: 2, ctx: ctx() });
    expect(el.getAttribute("role")).toBe("dialog");
    expect(el.getAttribute("part")).toBe("window");
    expect(el.getAttribute("aria-label")).toBe("Alpha, Beta");
    expect(el.dataset["window"]).toBe("w1");
    expect(el.style.left).toBe("10px");
    expect(el.style.height).toBe("200px");
    expect(el.style.zIndex).toBe("32");
    expect(el.querySelector(".content flexdock-stack")!.getAttribute("data-win")).toBe("w1");
    el.querySelector<HTMLElement>(".grip")!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(got.map((r) => r.action)).toEqual(["grip", "raise"]);
    expect(got[0]).toMatchObject({ key: "w1" });
    el.remove();
    el.dispatchEvent(new MouseEvent("pointerdown"));
    expect(got.length).toBe(2);
  });
  it("labels unknown views by id", async () => {
    const el = await put<P>("flexdock-window", { key: "w2", tree: stack(["nope"]), ctx: ctx() });
    expect(el.getAttribute("aria-label")).toBe("nope");
  });
});
