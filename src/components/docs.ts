import type { PropertyValues } from "lit";
import { DockoramaStack } from "./stack.js";

/**
 * `<dockorama-docs>`: the document host. Behaves like `<dockorama-stack>` but always shows tabs with close
 * buttons, accepts document-only views, and shows a "Drop a view here" zone when it is empty.
 */
export class DockoramaDocs extends DockoramaStack {
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.mark("data-docs", true);
    this.mark("part", "group docs");
  }
}
