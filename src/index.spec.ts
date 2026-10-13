import { describe, expect, it } from "vitest";
import { FlexdockManager, VERSION } from "./index.js";

describe("flexdock", () => {
  it("exports a version", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("registers <flexdock-manager> and renders a root part with a slot", async () => {
    expect(customElements.get("flexdock-manager")).toBe(FlexdockManager);
    const el = document.createElement("flexdock-manager");
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot?.querySelector('[part="root"]');
    expect(root).not.toBeNull();
    expect(root?.querySelector("slot")).not.toBeNull();
    el.remove();
  });
});

describe("module re-import", () => {
  it("does not throw when the element is already defined", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    await expect(import("./index.js")).resolves.toBeDefined();
  });
});
