import type { PropertyValues } from "lit";
import { PazuruStack } from "./stack.js";

/**
 * `<pazuru-docs>`: the document host. Behaves like `<pazuru-stack>` but always shows tabs with close
 * buttons, accepts document-only views, and shows a "Drop a view here" zone when it is empty.
 */
export class PazuruDocs extends PazuruStack {
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.mark("data-docs", true);
    this.mark("part", "group docs");
  }
}
