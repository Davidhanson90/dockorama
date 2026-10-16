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

import { DockoramaPart, PARTS, DockoramaManager } from "../index.js";
describe("UI parts", () => {
  it("registers every part once and renders into light DOM", async () => {
    defineParts();
    for (const [tag, cls] of Object.entries(PARTS)) {
      expect(customElements.get(tag)).toBe(cls);
      expect(cls.prototype).toBeInstanceOf(DockoramaPart);
    }
    const el = await put<HTMLElement & { updateComplete: Promise<boolean> }>("dockorama-tab", { view: "a" });
    expect(el.shadowRoot).toBeNull();
    expect(customElements.get("dockorama-manager")).toBe(DockoramaManager);
  });
  it("keeps part requests inside the manager", async () => {
    const m = document.createElement("dockorama-manager");
    document.body.append(m);
    m.model = createModel(views, row([stack(["a", "b"])]));
    await m.updateComplete;
    const leaked: Event[] = [];
    m.addEventListener("dockorama-request", (e) => leaked.push(e));
    m.shadowRoot!.querySelector<HTMLElement>('dockorama-tab[data-view="b"]')!.click();
    await m.updateComplete;
    expect(leaked).toEqual([]);
    expect(m.model.focus).toBe("b");
  });
});
