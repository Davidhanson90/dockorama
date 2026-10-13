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

type Strip = HTMLElement & { updateComplete: Promise<boolean>; scrollTabs(d: number): void; markOverflow(): void; strip: HTMLElement | null };
function overflow(strip: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperty(strip, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(strip, "clientWidth", { configurable: true, value: clientWidth });
}
describe("<flexdock-tabstrip>", () => {
  it("renders a tablist with one tab per view", async () => {
    const el = await put<Strip>("flexdock-tabstrip", { views: ["a", "b"], current: "b", ctx: ctx() });
    const list = el.querySelector('[role="tablist"]')!;
    expect(list.getAttribute("aria-label")).toBe("Beta");
    expect(Array.from(list.querySelectorAll("flexdock-tab")).map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true"]);
    expect(el.querySelectorAll(".scroll").length).toBe(2);
  });
  it("flags overflow, scrolls by buttons and wheel, and mirrors in RTL", async () => {
    const bar = document.createElement("div");
    bar.className = "bar";
    document.body.append(bar);
    const el = document.createElement("flexdock-tabstrip") as unknown as Strip;
    Object.assign(el, { views: ["a", "b"], current: "a", ctx: ctx() });
    bar.append(el);
    await el.updateComplete;
    const strip = el.strip!;
    overflow(strip, 500, 100);
    el.markOverflow();
    expect(bar.hasAttribute("data-overflow")).toBe(true);
    expect(el.hasAttribute("data-can-fwd")).toBe(true);
    el.querySelector<HTMLElement>('.scroll[data-dir="1"]')!.click();
    expect(strip.scrollLeft).toBe(80);
    strip.dispatchEvent(new WheelEvent("wheel", { deltaX: 0, deltaY: 0, cancelable: true }));
    expect(strip.scrollLeft).toBe(80);
    bar.style.direction = "rtl";
    el.scrollTabs(-1);
    expect(strip.scrollLeft).toBe(160);
    overflow(strip, 100, 100);
    const wheel = new WheelEvent("wheel", { deltaY: 40, cancelable: true });
    strip.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  });
  it("does nothing before rendering and skips scroll-into-view while dragging", async () => {
    const el = document.createElement("flexdock-tabstrip") as unknown as Strip;
    el.scrollTabs(1);
    el.markOverflow();
    expect(el.strip).toBeNull();
    Object.assign(el, { views: ["a", "b"], current: "b", ctx: ctx({ dragging: true }) });
    document.body.append(el);
    await el.updateComplete;
    expect(el.strip!.scrollLeft).toBe(0);
  });
});
