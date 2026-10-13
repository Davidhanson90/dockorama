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
describe("<flexdock-menu>", () => {
  it("renders commands, radio items and separators, with keyboard navigation", async () => {
    const got = requests();
    const el = await put<P>("flexdock-menu", {
      x: 12, y: 34,
      entries: [{ label: "Alpha", action: "reveal", id: "a", checked: true }, { label: "Beta", action: "reveal", id: "b", checked: false }, "separator", { label: "Float", action: "float", id: "a" }]
    });
    expect(el.getAttribute("role")).toBe("menu");
    expect(el.style.left).toBe("12px");
    expect(el.querySelectorAll("hr").length).toBe(1);
    const buttons = Array.from(el.querySelectorAll("button"));
    expect(buttons.map((b) => b.getAttribute("role"))).toEqual(["menuitemradio", "menuitemradio", "menuitem"]);
    expect(buttons[0]!.getAttribute("aria-checked")).toBe("true");
    expect(buttons[2]!.hasAttribute("aria-checked")).toBe(false);
    buttons[0]!.focus();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(document.activeElement).toBe(buttons[1]);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(document.activeElement).toBe(buttons[2]);
    const other = new KeyboardEvent("keydown", { key: "x", cancelable: true });
    el.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    buttons[2]!.click();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(got).toEqual([expect.objectContaining({ action: "float", id: "a", fromMenu: true }), expect.objectContaining({ action: "menu-close" })]);
    el.remove();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(got.length).toBe(2);
  });
});
