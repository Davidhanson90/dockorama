import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, createRef, act } from "react";
import { createRoot } from "react-dom/client";
import { createApp, h, nextTick, ref } from "vue";
import { FlexdockLayout as ReactLayout } from "./react.js";
import { FlexdockLayout as VueLayout } from "./vue.js";
import { flexdock } from "./svelte.js";
import { applyProps, bindEvents } from "./bridge.js";
import { createModel, row, stack, type FlexdockManager } from "./index.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const model = () => createModel({ a: { title: "A" }, b: { title: "B" } }, row([stack(["a"]), stack(["b"])]));
afterEach(() => { document.body.innerHTML = ""; });

describe("bridge", () => {
  it("applies only defined, changed props and binds/unbinds events", () => {
    const el = document.createElement("flexdock-manager");
    const m = model();
    applyProps(el, { model: m, theme: "dark", snap: 8, keepEmpty: true, labels: { dismiss: "X" }, storageKey: undefined });
    expect(el.model.views).toEqual(m.views);
    const assigned = el.model;
    applyProps(el, { model: assigned });
    expect(el.model).toBe(assigned);
    expect(el.theme).toBe("dark");
    const change = vi.fn();
    const before = vi.fn();
    const off = bindEvents(el, () => ({ change, beforeclose: before }));
    el.dispatchEvent(new CustomEvent("flexdock-change", { detail: { reason: "x" } }));
    el.dispatchEvent(new CustomEvent("flexdock-beforeclose", { detail: { id: "a" } }));
    el.dispatchEvent(new CustomEvent("flexdock-focus", { detail: {} }));
    expect(change).toHaveBeenCalledWith({ reason: "x" });
    expect(before.mock.calls[0]![0]).toBeInstanceOf(CustomEvent);
    off();
    el.dispatchEvent(new CustomEvent("flexdock-change", { detail: {} }));
    expect(change).toHaveBeenCalledTimes(1);
  });
});

describe("bridge: drag groups, tab menu hook and transfer events", () => {
  it("passes dragGroup / tabMenu and forwards flexdock-transfer", () => {
    const el = document.createElement("flexdock-manager");
    const hook = (_id: string, items: unknown[]) => items as never;
    applyProps(el, { dragGroup: "g", tabMenu: hook });
    expect(el.dragGroup).toBe("g");
    expect(el.tabMenu).toBe(hook);
    const transfer = vi.fn();
    bindEvents(el, () => ({ transfer }));
    el.dispatchEvent(new CustomEvent("flexdock-transfer", { detail: { id: "a", direction: "in" } }));
    expect(transfer).toHaveBeenCalledWith({ id: "a", direction: "in" });
  });
});

describe("react", () => {
  it("renders the element, sets props, forwards the ref and events", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    const r = createRef<FlexdockManager | null>();
    const onLayoutChange = vi.fn();
    const m = model();
    await act(async () => {
      root.render(createElement(ReactLayout, { ref: r, model: m, theme: "dark", className: "dock", onLayoutChange },
        createElement("div", { "data-view": "a" }, "A"), createElement("div", { "data-view": "b" }, "B")));
    });
    const el = host.querySelector("flexdock-manager")!;
    expect(r.current).toBe(el);
    expect(el.className).toBe("dock");
    expect(el.theme).toBe("dark");
    expect(el.querySelector('[data-view="a"]')!.slot).toBe("v:a");
    await act(async () => el.dismiss("a"));
    expect(onLayoutChange).toHaveBeenCalledWith(expect.objectContaining({ reason: "dismiss" }));
    const second = vi.fn();
    await act(async () => { root.render(createElement(ReactLayout, { ref: r, model: m, onLayoutChange: second })); });
    await act(async () => el.reveal("a"));
    expect(second).toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});

describe("vue", () => {
  it("renders, syncs props, emits events and exposes the element", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    const theme = ref<"light" | "dark">("light");
    const seen: string[] = [];
    const comp = ref<{ element: FlexdockManager | null } | null>(null);
    const app = createApp({
      setup: () => () => h(VueLayout, {
        ref: comp, model: model(), theme: theme.value,
        "onLayout-change": (d: { reason: string }) => seen.push(d.reason),
        "onUpdate:model": () => seen.push("update"),
        "onView-focus": () => seen.push("focus")
      }, () => [h("div", { "data-view": "a" }, "A")])
    });
    app.mount(host);
    await nextTick();
    const el = host.querySelector("flexdock-manager")!;
    expect(comp.value!.element).toBe(el);
    expect(el.theme).toBe("light");
    theme.value = "dark";
    await nextTick();
    await nextTick();
    expect(el.theme).toBe("dark");
    el.place("a", "b", "into");
    expect(seen).toEqual(expect.arrayContaining(["place", "update", "focus"]));
    const api = comp.value as unknown as {
      addView(id: string, c: Element | string): void; removeView(id: string): Element | null;
      getViewElement(id: string): Element | null; hasView(id: string): boolean;
    };
    api.addView("c", "C");
    expect(api.hasView("c")).toBe(true);
    expect(api.getViewElement("c")!.textContent).toBe("C");
    expect(api.removeView("c")!.textContent).toBe("C");
    app.unmount();
    expect(api.hasView("c")).toBe(false);
    expect(api.getViewElement("c")).toBeNull();
    expect(() => api.addView("d", "D")).toThrow(/not mounted/);
  });
});

describe("svelte action", () => {
  it("applies options, updates and destroys", () => {
    const el = document.createElement("flexdock-manager");
    document.body.append(el);
    const change = vi.fn();
    const a = flexdock(el, { model: model(), on: { change } });
    el.dismiss("a");
    expect(change).toHaveBeenCalledTimes(1);
    const other = vi.fn();
    a.update({ theme: "dark", on: { change: other } });
    expect(el.theme).toBe("dark");
    el.reveal("a");
    expect(other).toHaveBeenCalled();
    a.destroy();
    el.dismiss("a");
    expect(other).toHaveBeenCalledTimes(1);
    flexdock(el).destroy();
  });
});
