import { afterEach, describe, expect, it } from "vitest";
import { defineParts, type PartRequest } from "../index.js";

defineParts();
afterEach(() => { document.body.innerHTML = ""; });

describe("<dockorama-confirm>", () => {
  it("asks, focuses Cancel, traps Tab and answers", async () => {
    const got: PartRequest[] = [];
    document.addEventListener("dockorama-request", (e) => got.push((e as CustomEvent<PartRequest>).detail));
    const el = document.createElement("dockorama-confirm");
    Object.assign(el, { view: "a", message: "Unsaved. Close?", okLabel: "Close", cancelLabel: "Keep" });
    document.body.append(el);
    await el.updateComplete;
    expect(el.getAttribute("role")).toBe("alertdialog");
    expect(el.getAttribute("aria-modal")).toBe("true");
    el.focusSafe();
    const [cancel, ok] = Array.from(el.querySelectorAll("button"));
    expect(document.activeElement).toBe(cancel);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(document.activeElement).toBe(ok);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }));
    expect(document.activeElement).toBe(cancel);
    const other = new KeyboardEvent("keydown", { key: "a", cancelable: true });
    el.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    ok!.click();
    cancel!.click();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(got.map((r) => r["ok"])).toEqual([true, false, false]);
  });
});
