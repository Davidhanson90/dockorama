import { html, type PropertyValues, type TemplateResult } from "lit";
import { icons } from "../icons.js";
import type { DockContext } from "./context.js";
import { FlexdockPart } from "./part.js";

/**
 * `<flexdock-tabstrip>`: a scrollable tab list (`role="tablist"`) of `<flexdock-tab>`s with overflow
 * scroll buttons and wheel scrolling. Flags `data-overflow`, `data-can-back` and `data-can-fwd`.
 */
export class FlexdockTabstrip extends FlexdockPart {
  static override properties = {
    views: { attribute: false },
    current: {},
    pinned: { attribute: false },
    preview: {},
    docs: { type: Boolean },
    win: {},
    ctx: { attribute: false }
  };
  views: string[] = [];
  current = "";
  pinned: string[] = [];
  preview?: string;
  docs = false;
  win?: string;
  ctx!: DockContext;

  private get rtl(): number {
    return getComputedStyle(this).direction === "rtl" ? -1 : 1;
  }
  /** The scrolling tab list element. */
  get strip(): HTMLElement | null {
    return this.querySelector<HTMLElement>(".tabs");
  }

  private wheel(e: WheelEvent): void {
    const strip = e.currentTarget as HTMLElement;
    if (strip.scrollWidth <= strip.clientWidth) return;
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (!delta) return;
    e.preventDefault();
    strip.scrollLeft += delta * this.rtl;
    this.markOverflow();
  }

  /** Scroll the tab list by most of its width in a direction (1 = forward). */
  scrollTabs(dir: number): void {
    const strip = this.strip;
    if (!strip) return;
    strip.scrollLeft += dir * this.rtl * Math.max(80, strip.clientWidth * 0.6);
    this.markOverflow();
  }

  /** Update the overflow flags (on this element and on the surrounding header bar). */
  markOverflow(): void {
    const strip = this.strip;
    if (!strip) return;
    const over = strip.scrollWidth > strip.clientWidth + 1;
    const pos = Math.abs(strip.scrollLeft);
    const back = over && pos > 1;
    const fwd = over && pos < strip.scrollWidth - strip.clientWidth - 1;
    for (const el of [this, this.closest(".bar")]) {
      el?.toggleAttribute("data-overflow", over);
      el?.toggleAttribute("data-can-back", back);
      el?.toggleAttribute("data-can-fwd", fwd);
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.reveal();
    // Tabs render after the strip: measure again once they have.
    void this.updateComplete.then(() => this.reveal());
  }

  /** Scroll the selected tab into view and refresh the overflow flags. */
  private reveal(): void {
    const strip = this.strip;
    // Tabs reflect their own attributes later, so find the selected one by property.
    const sel = Array.from(strip?.children ?? []).find((t) => (t as HTMLElement & { view?: string }).view === this.current) as HTMLElement | undefined;
    if (strip && sel && strip.scrollWidth > strip.clientWidth && !this.ctx.dragging) {
      const a = sel.offsetLeft;
      const b = a + sel.offsetWidth;
      if (a < strip.scrollLeft) strip.scrollLeft = a;
      else if (b > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = b - strip.clientWidth;
    }
    this.markOverflow();
    this.stickPins();
  }

  /** Pinned tabs stay in view while the strip scrolls: offset each by the widths of the pinned tabs before it. */
  private stickPins(): void {
    let at = 0;
    for (const t of Array.from(this.strip?.querySelectorAll<HTMLElement>(".tab[data-pinned]") ?? [])) {
      t.style.insetInlineStart = `${at}px`;
      at += t.offsetWidth;
    }
  }

  override render(): TemplateResult {
    const m = this.ctx.model;
    const scroller = (dir: number) => html`<button class="btn scroll" part="tab-scroll" data-dir=${dir} tabindex="-1" aria-hidden="true"
      @pointerdown=${(e: Event) => e.stopPropagation()} @click=${(e: Event) => { e.stopPropagation(); this.scrollTabs(dir); }}>${icons.arrow(dir * 90)}</button>`;
    return html`${scroller(-1)}<div class="tabs" role="tablist" aria-label=${m.views[this.current]?.title ?? ""}
        @wheel=${(e: WheelEvent) => this.wheel(e)} @scroll=${() => this.markOverflow()}>${this.views.map((v) => {
          const info = m.views[v];
          return html`<flexdock-tab .view=${v} .info=${info} .selected=${v === this.current} .win=${this.win} .pinned=${this.pinned.includes(v)} .preview=${v === this.preview}
            .dirty=${Boolean(this.ctx.dirty?.has(v))} .dirtyLabel=${this.ctx.labels.unsaved}
            .closable=${this.docs && info?.caps?.dismiss !== false} .closeLabel=${this.ctx.labels.dismiss}></flexdock-tab>`;
        })}</div>${scroller(1)}`;
  }
}
