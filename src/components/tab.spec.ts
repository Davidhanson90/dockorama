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
  document.addEventListener("dockorama-request", (e) => out.push((e as CustomEvent<PartRequest>).detail));
  return out;
}
afterEach(() => { document.body.innerHTML = ""; });

type P = HTMLElement & { updateComplete: Promise<boolean>; selected: boolean };
describe("<dockorama-tab>", () => {
  it("reflects tab semantics and sends reveal, grab and dismiss", async () => {
    const got = requests();
    const el = await put<P>("dockorama-tab", { view: "a", info: views.a, selected: true, closable: true, closeLabel: "Shut", win: "w" });
    expect(el.id).toBe("tab-a");
    expect(el.getAttribute("role")).toBe("tab");
    expect(el.getAttribute("part")).toBe("tab tab-current");
    expect(el.getAttribute("aria-selected")).toBe("true");
    expect(el.tabIndex).toBe(0);
    expect(el.dataset["view"]).toBe("a");
    expect(el.querySelector(".label")!.textContent).toBe("Alpha");
    const close = el.querySelector<HTMLButtonElement>('[part="tab-close"]')!;
    expect(close.getAttribute("aria-label")).toBe("Shut Alpha");
    el.click();
    el.dispatchEvent(new MouseEvent("pointerdown"));
    el.dispatchEvent(new MouseEvent("auxclick", { button: 1 }));
    el.dispatchEvent(new MouseEvent("auxclick", { button: 2 }));
    close.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    close.click();
    expect(got.map((r) => r.action)).toEqual(["reveal", "grab", "dismiss", "dismiss"]);
    expect(got[1]).toMatchObject({ id: "a", win: "w", source: el });
    el.selected = false;
    await el.updateComplete;
    expect(el.getAttribute("part")).toBe("tab");
    expect(el.tabIndex).toBe(-1);
    el.remove();
    el.click();
    expect(got.length).toBe(4);
  });
  it("falls back to the id without info and has no close button by default", async () => {
    const el = await put<P>("dockorama-tab", { view: "zzz" });
    expect(el.textContent).toContain("zzz");
    expect(el.querySelector(".glyph")).toBeNull();
    expect(el.querySelector("button")).toBeNull();
  });
});
