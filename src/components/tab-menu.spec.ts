import { afterEach, describe, expect, it } from "vitest";
import { defineParts, type PartRequest } from "../index.js";

defineParts();
function requests(): PartRequest[] {
  const out: PartRequest[] = [];
  document.addEventListener("flexdock-request", (e) => out.push((e as CustomEvent<PartRequest>).detail));
  return out;
}
afterEach(() => { document.body.innerHTML = ""; });

describe("<flexdock-tab-menu>", () => {
  it("renders items, checkboxes, disabled entries and separators, and reports choices", async () => {
    const got = requests();
    const el = document.createElement("flexdock-tab-menu");
    Object.assign(el, {
      view: "a", x: 3, y: 4, label: "Tab actions",
      items: [{ key: "close", label: "Close" }, "separator", { key: "pin", label: "Pin", checked: false }, { key: "x", label: "Off", disabled: true }]
    });
    document.body.append(el);
    await el.updateComplete;
    expect(el.getAttribute("role")).toBe("menu");
    expect(el.getAttribute("part")).toBe("menu tab-menu");
    expect(el.style.top).toBe("4px");
    const b = Array.from(el.querySelectorAll("button"));
    expect(b.map((x) => x.getAttribute("role"))).toEqual(["menuitem", "menuitemcheckbox", "menuitem"]);
    expect(b[2]!.disabled).toBe(true);
    el.focusFirst();
    expect(document.activeElement).toBe(b[0]);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(document.activeElement).toBe(b[1]);
    b[1]!.click();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(got).toEqual([
      expect.objectContaining({ action: "tab-menu-choose", id: "a", index: 2 }),
      expect.objectContaining({ action: "tab-menu-close", id: "a" })
    ]);
  });
});
