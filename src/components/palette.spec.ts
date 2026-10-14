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

type P = HTMLElement & { updateComplete: Promise<boolean>; index: number; items: unknown[] };
describe("<pazuru-palette>", () => {
  it("is a searchable dialog that reports query, moves and choices", async () => {
    const got = requests();
    const el = await put<P>("pazuru-palette", { items: [{ label: "Alpha", detail: "" }, { label: "Beta", detail: "closed" }], index: 1, query: "a", label: "Find", placeholder: "Type" });
    expect(el.getAttribute("role")).toBe("dialog");
    expect(el.getAttribute("aria-label")).toBe("Find");
    const input = el.querySelector("input")!;
    expect(input.value).toBe("a");
    expect(input.placeholder).toBe("Type");
    el.focus();
    expect(document.activeElement).toBe(input);
    expect(Array.from(el.querySelectorAll("li")).map((li) => li.getAttribute("aria-selected"))).toEqual(["false", "true"]);
    input.value = "be";
    input.dispatchEvent(new Event("input"));
    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape", "q"]) input.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
    el.querySelector("li")!.dispatchEvent(new Event("pointerdown", { cancelable: true }));
    expect(got.map((r) => [r.action, r["query"] ?? r["index"]])).toEqual([
      ["palette-query", "be"], ["palette-index", 1], ["palette-index", 0], ["palette-choose", 1], ["palette-close", undefined], ["palette-choose", 0]
    ]);
  });
  it("says when nothing matches", async () => {
    const el = await put<P>("pazuru-palette", { items: [], empty: "Nope" });
    expect(el.querySelector("li")!.textContent).toBe("Nope");
    expect(el.querySelector("li")!.getAttribute("aria-disabled")).toBe("true");
  });
});
