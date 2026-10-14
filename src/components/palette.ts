import { html, type PropertyValues, type TemplateResult } from "lit";
import { FlexdockPart } from "./part.js";

/** `<flexdock-palette>`: the "go to view" search dialog. Sends `palette-query`, `palette-index`, `palette-choose` and `palette-close`. */
export class FlexdockPalette extends FlexdockPart {
  static override properties = {
    items: { attribute: false },
    query: {},
    index: { type: Number },
    label: {},
    placeholder: {},
    empty: {}
  };
  items: Array<{ label: string; detail: string }> = [];
  query = "";
  index = 0;
  label = "Go to view";
  placeholder = "";
  /** Text shown when nothing matches. */
  empty = "Nothing matches";

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("palette");
    this.mark("part", "palette");
    this.mark("role", "dialog");
    this.mark("aria-label", this.label);
  }

  /** Focus the search box. */
  override focus(): void {
    this.querySelector<HTMLInputElement>("input")?.focus();
  }

  private key(e: KeyboardEvent): void {
    const n = this.items.length;
    const i = Math.min(this.index, Math.max(0, n - 1));
    if (e.key === "ArrowDown") this.request("palette-index", { index: Math.min(i + 1, n - 1) });
    else if (e.key === "ArrowUp") this.request("palette-index", { index: Math.max(i - 1, 0) });
    else if (e.key === "Enter") this.request("palette-choose", { index: i });
    else if (e.key === "Escape") this.request("palette-close");
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  override render(): TemplateResult {
    const index = Math.min(this.index, Math.max(0, this.items.length - 1));
    return html`<input role="combobox" aria-expanded="true" aria-controls="fd-pal" aria-label=${this.label}
        placeholder=${this.placeholder} .value=${this.query}
        @input=${(e: Event) => this.request("palette-query", { query: (e.target as HTMLInputElement).value })}
        @keydown=${(e: KeyboardEvent) => this.key(e)}>
      <ul id="fd-pal" role="listbox">
        ${this.items.length
          ? this.items.map((it, n) => this.paint("palette-item", { label: it.label, detail: it.detail, selected: n === index, choose: () => this.request("palette-choose", { index: n }) }))
          : this.paint("palette-empty", { label: this.empty })}
      </ul>`;
  }
}
