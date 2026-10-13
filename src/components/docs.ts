import type { PropertyValues } from "lit";
import { FlexdockStack } from "./stack.js";

/**
 * `<flexdock-docs>`: the document host. Behaves like `<flexdock-stack>` but always shows tabs with close
 * buttons, accepts document-only views, and shows a "Drop a view here" zone when it is empty.
 */
export class FlexdockDocs extends FlexdockStack {
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.mark("data-docs", true);
    this.mark("part", "group docs");
  }
}
