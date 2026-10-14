import { afterEach, describe, expect, it } from "vitest";
import { defineParts, type PartRequest } from "../index.js";

defineParts();
afterEach(() => { document.body.innerHTML = ""; });

describe("<flexdock-notice>", () => {
  it("shows a message and sends each action", async () => {
    const got: PartRequest[] = [];
    document.addEventListener("flexdock-request", (e) => got.push((e as CustomEvent<PartRequest>).detail));
    const el = document.createElement("flexdock-notice");
    Object.assign(el, { message: "Blocked", actions: [{ label: "Retry", action: "go", primary: true }, { label: "No", action: "stop" }] });
    document.body.append(el);
    await el.updateComplete;
    expect(el.getAttribute("role")).toBe("alertdialog");
    expect(el.querySelector(".notice-text")!.textContent).toBe("Blocked");
    const b = el.querySelectorAll("button");
    expect(b[0]!.hasAttribute("data-primary")).toBe(true);
    b[1]!.click();
    expect(got.map((r) => r.action)).toEqual(["stop"]);
  });
});
