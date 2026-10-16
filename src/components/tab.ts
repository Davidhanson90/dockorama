import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import type { ViewInfo } from "../core/contracts.js";
import { DockoramaPart } from "./part.js";

/**
 * `<dockorama-tab>`: one tab. The element is a presentational wrapper; inside it a `.tab-main` element carries
 * `role="tab"` (and holds the glyph, label and marks), followed by the close button as its sibling, so no control is
 * nested inside the tab. Click reveals, pointer-drag moves, middle-click, Delete or the close button (when `closable`) closes.
 * Left/Right (mirrored in RTL), Home and End move to another tab of the strip and select it.
 */
export class DockoramaTab extends DockoramaPart {
  static override properties = {
    view: {},
    info: { attribute: false },
    selected: { type: Boolean },
    closable: { type: Boolean },
    closeLabel: { attribute: "close-label" },
    win: {},
    pinned: { type: Boolean },
    preview: { type: Boolean },
    dirty: { type: Boolean },
    dirtyLabel: { attribute: "dirty-label" }
  };
  view = "";
  info?: ViewInfo;
  selected = false;
  closable = false;
  closeLabel = "Close";
  win?: string;
  /** Pinned tabs are drawn compact (glyph only when there is one) and never show a close button. */
  pinned = false;
  /** Preview tab: italic, replaced by the next preview; double-click keeps it. */
  preview = false;
  /** Unsaved changes: shows a dot (the close button replaces it on hover). */
  dirty = false;
  dirtyLabel = "Unsaved changes";

  protected override get listeners() {
    return {
      contextmenu: this.onContext,
      keydown: this.onKeyDown,
      click: this.onClick,
      dblclick: this.onDouble,
      pointerdown: this.onDown,
      auxclick: this.onAux
    };
  }
  private readonly onContext = (e: MouseEvent): void => {
    e.preventDefault();
    this.request("tab-menu", { id: this.view, x: e.clientX, y: e.clientY });
  };
  /** Moves keyboard focus to the tab element (the wrapper itself is not focusable). */
  override focus(options?: FocusOptions): void {
    const main = this.querySelector<HTMLElement>(".tab-main");
    if (main) main.focus(options);
    else super.focus(options);
  }

  /**
   * Shift+F10 or the menu key open the tab menu. Left/Right (mirrored in RTL), Home and End move to another tab of the
   * strip and select it; Delete closes it (when it can be closed).
   */
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.target !== this && e.target !== this.querySelector(".tab-main")) return;
    if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      const r = this.getBoundingClientRect();
      this.request("tab-menu", { id: this.view, x: r.left, y: r.bottom, keyboard: true });
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    // While the manager is in keyboard move mode (Alt+M) it owns the arrow, Enter and Space keys.
    if ((this.getRootNode() as ShadowRoot).host?.hasAttribute("data-moving")) return;
    const rtl = getComputedStyle(this).direction === "rtl";
    const step = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    if (step || e.key === "Home" || e.key === "End") {
      const tabs = Array.from(this.closest(".tabs")?.querySelectorAll<HTMLElement & { view: string }>("dockorama-tab") ?? []);
      const at = tabs.indexOf(this as unknown as HTMLElement & { view: string });
      const next = e.key === "Home" ? tabs[0] : e.key === "End" ? tabs.at(-1) : tabs[(at + step + tabs.length) % tabs.length];
      if (!next || next === (this as unknown)) return;
      e.preventDefault();
      e.stopPropagation();
      next.focus();
      this.request("reveal", { id: next.view });
    } else if (e.key === "Delete" && this.closable && !this.pinned) {
      e.preventDefault();
      e.stopPropagation();
      this.request("dismiss", { id: this.view });
    }
  };
  private readonly onDouble = (e: MouseEvent): void => {
    if (!this.preview) return;
    e.stopPropagation();
    this.request("promote", { id: this.view });
  };
  private readonly onClick = (): void => this.request("reveal", { id: this.view });
  private readonly onDown = (event: PointerEvent): void => this.request("grab", { id: this.view, win: this.win, event, source: this });
  private readonly onAux = (e: MouseEvent): void => {
    if (e.button === 1) this.request("dismiss", { id: this.view });
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("tab");
    this.mark("part", this.selected ? "tab tab-current" : "tab");
    this.mark("role", "presentation");
    this.mark("data-view", this.view);
    this.mark("data-selected", this.selected);
    this.mark("data-closable", this.closable && !this.pinned);
    this.mark("data-pinned", this.pinned);
    this.mark("data-preview", this.preview);
    this.mark("data-dirty", this.dirty);
  }

  override render(): TemplateResult {
    const title = this.info?.title ?? this.view;
    const compact = this.pinned && Boolean(this.info?.icon);
    if (this.pinned) this.title = title;
    const close = (): void => this.request("dismiss", { id: this.view });
    return html`<span class="tab-main" part="tab-main" role="tab" id="tab-${this.view}" aria-selected=${this.selected ? "true" : "false"}
      tabindex=${this.selected ? "0" : "-1"} aria-haspopup="menu">${this.paint("tab", {
      view: this.view, title, ...(this.info ? { info: this.info } : {}), selected: this.selected, pinned: this.pinned, preview: this.preview,
      dirty: this.dirty, closable: this.closable, compact, closeLabel: this.closeLabel, dirtyLabel: this.dirtyLabel, close
    })}</span>${this.closable && !this.pinned ? this.paint("tab-close-button", { title, label: this.closeLabel, close }) : nothing}`;
  }
}
