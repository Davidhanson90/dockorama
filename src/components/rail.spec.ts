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
describe("<flexdock-rail>", () => {
  it("lists stowed views and asks to open them on click or mouse hover", async () => {
    const got = requests();
    const el = await put<P>("flexdock-rail", { side: "end", views: ["a", "x"], open: "a", ctx: ctx() });
    expect(el.getAttribute("role")).toBe("toolbar");
    expect(el.getAttribute("aria-label")).toBe("end");
    expect(el.dataset["side"]).toBe("end");
    const [a, x] = Array.from(el.querySelectorAll<HTMLButtonElement>(".rail-item"));
    expect(a!.getAttribute("aria-expanded")).toBe("true");
    expect(x!.textContent!.trim()).toBe("x");
    a!.click();
    a!.dispatchEvent(Object.assign(new Event("pointerenter"), { pointerType: "mouse" }));
    x!.dispatchEvent(Object.assign(new Event("pointerenter"), { pointerType: "touch" }));
    x!.dispatchEvent(Object.assign(new Event("pointerenter"), { pointerType: "mouse" }));
    expect(got).toEqual([
      expect.objectContaining({ action: "peek", id: "a", toggle: true }),
      expect.objectContaining({ action: "peek", id: "x", toggle: false })
    ]);
  });
});
