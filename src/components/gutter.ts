import { html, type PropertyValues, type TemplateResult } from "lit";
import { PazuruPart } from "./part.js";

/**
 * `<pazuru-gutter>`: the draggable, keyboard-operable splitter between two cells of a split.
 * Sends `gutter-grab` (pointer) and `gutter-key` (keyboard) requests; the manager resizes.
 */
export class PazuruGutter extends PazuruPart {
  static override properties = {
    path: { attribute: false },
    index: { type: Number },
    win: {},
    axis: {},
    weights: { attribute: false },
    value: { type: Number },
    label: {},
    drop: { type: Boolean },
    folded: {}
  };
  path: number[] = [];
  /** Index of the cell before this gutter. */
  index = 0;
  win?: string;
  axis: "row" | "column" = "row";
  weights: number[] = [];
  value = 0;
  label = "Resize";
  drop = false;
  /** Which neighbour is collapsed: `"before"`, `"after"` or `""`. Double-click or Enter toggles. */
  folded: "before" | "after" | "" = "";

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("pointerdown", this.onDown);
    this.addEventListener("keydown", this.onKey);
    this.addEventListener("dblclick", this.onFold);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("pointerdown", this.onDown);
    this.removeEventListener("keydown", this.onKey);
    this.removeEventListener("dblclick", this.onFold);
  }
  private readonly onDown = (event: PointerEvent): void =>
    this.request("gutter-grab", { path: this.path, after: this.index, axis: this.axis, win: this.win, event, source: this });
  private readonly onFold = (): void => this.request("gutter-fold", { path: this.path, after: this.index, win: this.win, source: this });
  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      this.onFold();
      return;
    }
    this.request("gutter-key", { path: this.path, after: this.index, axis: this.axis, weights: this.weights, win: this.win, event, source: this });
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("gutter");
    this.mark("part", "gutter");
    this.mark("role", "separator");
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    this.mark("data-path", this.path.join("."));
    this.mark("data-after", String(this.index));
    this.mark("data-win", this.win ?? "");
    this.mark("data-drop", this.drop);
    this.mark("aria-orientation", this.axis === "row" ? "vertical" : "horizontal");
    this.mark("aria-label", this.label);
    this.mark("aria-valuemin", "0");
    this.mark("aria-valuemax", "100");
    this.mark("aria-valuenow", String(this.value));
    this.mark("data-folded", this.folded || undefined);
  }

  override render(): TemplateResult {
    return html`${this.paint("splitter", { axis: this.axis, folded: this.folded, drop: this.drop, value: this.value })}`;
  }
}
