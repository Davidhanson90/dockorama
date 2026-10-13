import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { DEFAULT_LABELS, type FlexdockLabels } from "./labels.js";
import { Timeline } from "./history.js";
import { styles } from "./styles.js";
import {
  clampBox, compassSpots, edgeSpots, hit, insertionIndex, previewFor, shareSpace, snapBox, type Rect, type Spot
} from "./geometry.js";
import { FlexdockPart, defineParts, type DockContext, type GuideSpot, type MenuEntry, type PartRequest } from "./components/index.js";
import { slotOf } from "./components/context.js";
import { renderNode } from "./components/tree.js";
import type { Box, DropZone, EdgeZone, FlexdockModel, Side, ViewContent, ViewInfo, ViewOptions } from "./model.js";
import * as ops from "./ops.js";

/** Why the model changed (detail of `flexdock-change`). */
export type ChangeReason =
  | "set" | "place" | "edge" | "detach" | "window" | "stow" | "unstow" | "dismiss" | "reveal" | "select"
  | "reorder" | "resize" | "zoom" | "add" | "forget" | "undo" | "redo" | "focus" | "restore" | "cancel";

const SILENT: ChangeReason[] = ["select", "focus", "cancel"];
/** Quote a value for an attribute selector. */
const attr = (v: string) => JSON.stringify(v);
const isContent = (v: unknown): v is ViewContent =>
  typeof v === "string" || typeof v === "function" || (typeof Element !== "undefined" && v instanceof Element);

/** Plain-text view body: never HTML, padded via `.flexdock-text` / `--fd-text-padding`. */
const textNode = (text: string): HTMLElement => {
  const el = document.createElement("div");
  el.className = "flexdock-text";
  el.textContent = text;
  return el;
};

interface DragState {
  id: string;
  mode: "pending" | "tab" | "loose" | "window";
  startX: number;
  startY: number;
  x: number;
  y: number;
  windowKey?: string;
  windowStart?: Box;
  strip?: HTMLElement;
  target?: { view: string; rect: Rect; zone?: DropZone };
  /** Drop onto a gutter between two siblings. */
  gap?: { path: number[]; after: number; win?: string; rect: Rect };
  /** Drop into an empty document area. */
  fill?: { path: number[]; win?: string; rect: Rect };
  edge?: EdgeZone;
  /** Model when the drag started (restored by Escape). */
  origin: FlexdockModel;
  preview?: Rect;
  pointerId: number;
}

/**
 * `<flexdock-manager>`: a docking layout of views (panels and documents) the user can rearrange.
 * Content is light DOM: give each child `data-view="<id>"` matching an id in `model.views`.
 */
export class FlexdockManager extends LitElement {
  static {
    defineParts();
  }
  static override styles = styles;
  static override properties = {
    theme: { reflect: true },
    snap: { type: Number },
    storageKey: { attribute: "storage-key" },
    keepEmpty: { type: Boolean, attribute: "keep-empty" },
    labels: { attribute: false },
    _peek: { state: true },
    _drag: { state: true },
    _menu: { state: true },
    _palette: { state: true },
    _say: { state: true }
  };

  /** `light` (default), `dark` or `auto` (follows the OS). */
  theme: "light" | "dark" | "auto" = "light";
  /** Grid size in px that floating windows snap to (0 = off). */
  snap = 0;
  /** When set, the layout is saved to localStorage under this key and restored on load. */
  storageKey?: string;
  /** Keep empty groups instead of removing them. */
  keepEmpty = false;
  /** Partial overrides of user-facing strings. */
  labels: Partial<FlexdockLabels> = {};

  private _model: FlexdockModel = ops.emptyModel();
  private readonly timeline = new Timeline<FlexdockModel>();
  private _peek?: string;
  private _drag?: DragState;
  private _menu?: { id: string; x: number; y: number };
  private _palette?: { query: string; index: number };
  private _say = "";
  private readonly popped = new Map<string, Window>();
  private readonly shown = new Set<string>();
  private readonly factories = new Map<string, () => Element>();
  private observer?: MutationObserver;
  private restoredFromStorage = false;

  /** The current layout model (immutable; assign a new object to change it). */
  get model(): FlexdockModel {
    return this._model;
  }
  set model(value: FlexdockModel) {
    const next = ops.normalize(value);
    const fromStore = this.loadStored(next);
    this.restoredFromStorage = Boolean(fromStore);
    this.timeline.clear();
    this.commit(fromStore ?? next, "set", false);
  }

  private get t(): FlexdockLabels {
    return { ...DEFAULT_LABELS, ...this.labels };
  }

  /** True when the model was restored from storage the last time it was assigned. */
  get restored(): boolean {
    return this.restoredFromStorage;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.assignSlots();
    this.observer = new MutationObserver(() => this.assignSlots());
    this.observer.observe(this, { childList: true, attributes: true, attributeFilter: ["data-view"] });
    this.addEventListener("keydown", this.onKey);
    this.renderRoot.addEventListener("flexdock-request", this.onRequest);
    document.addEventListener("pointerdown", this.onOutside, true);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.removeEventListener("keydown", this.onKey);
    this.renderRoot.removeEventListener("flexdock-request", this.onRequest);
    document.removeEventListener("pointerdown", this.onOutside, true);
  }

  private assignSlots(): void {
    for (const child of Array.from(this.children)) {
      const id = child.getAttribute("data-view");
      if (id && child.getAttribute("slot") !== slotOf(id)) child.setAttribute("slot", slotOf(id));
    }
  }

  // ---------------------------------------------------------------- public API

  /** Move a view beside / into the group holding `target`. */
  place(id: string, target: string, zone: DropZone, index?: number): void {
    if (!this.allowMove(id, target, zone)) return;
    this.commit(ops.place(this._model, id, target, zone, index), "place");
  }
  /** Dock a view at an outer edge of the layout. */
  dockToEdge(id: string, zone: EdgeZone): void {
    if (this.caps(id).docsOnly) return;
    if (!this.emitBefore("flexdock-beforemove", { id, zone })) return;
    this.commit(ops.placeAtEdge(this._model, id, zone), "edge");
  }
  /** Insert a view as a new group between child `after` and `after + 1` of the split at `path`. */
  dropBetween(id: string, path: number[], after: number, windowKey?: string): void {
    if (this.caps(id).move === false || this.caps(id).docsOnly) return;
    if (!this.emitBefore("flexdock-beforemove", { id, zone: "between" })) return;
    this.commit(ops.insertBetween(this._model, id, path, after, windowKey), "place");
  }
  /** Put a view into an empty document area. */
  dropIntoDocs(id: string, path: number[], windowKey?: string): void {
    if (this.caps(id).move === false) return;
    if (!this.emitBefore("flexdock-beforemove", { id, zone: "into" })) return;
    this.commit(ops.fillDocs(this._model, id, path, windowKey), "place");
  }
  /** Float a view in its own window. */
  detach(id: string, box?: Box): void {
    if (this.caps(id).float === false) return;
    const b = box ?? this.defaultBox();
    this.commit(ops.detach(this._model, id, this.fitBox(b)), "detach");
  }
  /** Auto-hide a view into an edge drawer. */
  stow(id: string, side?: Side): void {
    if (this.caps(id).hide === false) return;
    if (this._peek === id) this._peek = undefined;
    this.commit(ops.stow(this._model, id, side), "stow");
  }
  /** Bring a stowed view back into the layout. */
  unstow(id: string): void {
    this._peek = undefined;
    this.commit(ops.unstow(this._model, id), "unstow");
  }
  /** Close a view (cancellable through `flexdock-beforeclose`). It stays registered. */
  dismiss(id: string): void {
    if (this.caps(id).dismiss === false) return;
    if (!this.emitBefore("flexdock-beforeclose", { id })) return;
    if (this._peek === id) this._peek = undefined;
    this.popIn(id);
    this.commit(ops.dismiss(this._model, id), "dismiss");
  }
  /** Show a view wherever it is (or bring it back if closed). */
  reveal(id: string): void {
    const where = ops.locate(this._model, id);
    if (where.place === "drawer") {
      this.openPeek(id);
      this.commit(this._model, "focus", false);
      return;
    }
    this.commit(ops.reveal(this._model, id), where.place === "tree" ? "select" : "reveal");
  }
  /** Maximise a view's group to fill the layout, or restore. */
  toggleZoom(id?: string): void {
    if (id && this.caps(id).zoom === false) return;
    this.commit(ops.toggleZoom(this._model, id ?? this._model.focus), "zoom");
  }
  /** Mark a view as active (focused). */
  activate(id: string): void {
    if (this._model.focus === id) return;
    const where = ops.locate(this._model, id);
    const m = where.place === "tree" ? ops.select(this._model, id) : { ...this._model, focus: id };
    this.commit(m, "focus", false);
  }
  /**
   * Add a view in one call: register it, attach its content and place it, as a single undoable change
   * (`flexdock-change` reason `"add"`).
   *
   * `content` is an element, a string (wrapped in a padded `.flexdock-text` div), or a factory called the first time the view is
   * shown. `options.at` says where it goes (see `ViewSpot`); the default is the document area, else
   * the right edge. Throws if `id` is already registered or the `near` target is not in the layout.
   */
  addView(id: string, content: ViewContent, options?: ViewOptions): void;
  /** Register a view whose `data-view` content is already (or will be) a child, and show it. */
  addView(id: string, info: ViewInfo, near?: { view: string; zone: DropZone }): void;
  addView(id: string, content: ViewContent | ViewInfo, extra?: ViewOptions | { view: string; zone: DropZone }): void {
    if (!isContent(content)) {
      this.commit(ops.addView(this._model, id, content, extra as { view: string; zone: DropZone } | undefined), "add");
      return;
    }
    const { at = "auto", ...rest } = (extra ?? {}) as ViewOptions;
    const info: ViewInfo = { ...rest, title: rest.title ?? id };
    if (typeof content === "function") info.lazy = true;
    const spot = typeof at === "object" && "float" in at ? { float: this.fitBox({ ...this.defaultBox(), ...(at.float === true ? {} : at.float) }) } : at;
    const next = ops.enlist(this._model, id, info, spot);
    if (typeof content === "function") {
      this.factories.set(id, content);
    } else {
      const el = typeof content === "string" ? textNode(content) : content;
      this.mount(id, el);
    }
    this.shown.delete(id);
    this.commit(next, "add");
  }
  /**
   * Remove a view completely (undoable for the layout). Returns its content element, taken out of
   * the manager unless `keepElement` is true, or null if it never had one (or `id` is unknown).
   */
  removeView(id: string, options: { keepElement?: boolean } = {}): Element | null {
    this.popIn(id);
    const el = this.getViewElement(id);
    this.factories.delete(id);
    this.shown.delete(id);
    if (id in this._model.views) this.commit(ops.forget(this._model, id), "forget");
    if (el && !options.keepElement) el.remove();
    return el;
  }
  /** The content element of a view (null if unknown, or lazy and not yet shown). */
  getViewElement(id: string): Element | null {
    const win = this.popped.get(id);
    return win?.document.querySelector(`[data-view=${attr(id)}]`) ?? this.querySelector(`:scope > [data-view=${attr(id)}]`);
  }
  /** True when a view with this id is registered (wherever it is, including parked). */
  hasView(id: string): boolean {
    return Object.prototype.hasOwnProperty.call(this._model.views, id);
  }
  /** Remove a view from the model entirely. */
  forget(id: string): void {
    this.popIn(id);
    this.commit(ops.forget(this._model, id), "forget");
  }
  undo(): void {
    const prev = this.timeline.undo(this._model);
    if (prev) this.commit(prev, "undo", false);
  }
  redo(): void {
    const next = this.timeline.redo(this._model);
    if (next) this.commit(next, "redo", false);
  }
  get canUndo(): boolean {
    return this.timeline.canUndo;
  }
  get canRedo(): boolean {
    return this.timeline.canRedo;
  }
  /** A deep copy of the model, safe to JSON.stringify and store. */
  snapshot(): FlexdockModel {
    return ops.copy(this._model);
  }
  /** Restore a snapshot as an undoable change. */
  restore(model: FlexdockModel): void {
    if (!ops.isModel(model)) throw new TypeError("flexdock: not a layout model");
    this.commit(ops.normalize(model), "restore");
  }
  /** Open the "go to view" palette. */
  openPalette(): void {
    this._palette = { query: "", index: 0 };
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLInputElement>(".palette input")?.focus());
  }
  /** Open a view's content in a separate browser window. Returns false when blocked. */
  popOut(id: string): boolean {
    if (this.caps(id).popout === false || this.popped.has(id)) return false;
    const el = this.querySelector<HTMLElement>(`[data-view=${attr(id)}]`);
    const win = window.open("", `flexdock-${id}`, "popup,width=640,height=480");
    if (!win || !el) return false;
    const title = this._model.views[id]?.title ?? id;
    win.document.title = title;
    for (const node of Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))) {
      win.document.head.append(node.cloneNode(true));
    }
    win.document.body.style.margin = "0";
    win.document.body.append(el);
    this.popped.set(id, win);
    win.addEventListener("pagehide", () => this.popIn(id));
    this.requestUpdate();
    return true;
  }
  /** Move popped-out content back. */
  popIn(id: string): void {
    const win = this.popped.get(id);
    if (!win) return;
    this.popped.delete(id);
    const el = win.document.querySelector(`[data-view=${attr(id)}]`);
    if (el) this.append(el);
    if (!win.closed) win.close();
    this.requestUpdate();
  }

  // ------------------------------------------------------------- internals

  private defaultBox(): Box {
    const r = this.getBoundingClientRect();
    return { x: Math.max(20, r.width / 2 - 180), y: Math.max(20, r.height / 2 - 120), w: 360, h: 240 };
  }

  private mount(id: string, el: Element): void {
    el.setAttribute("data-view", id);
    el.setAttribute("slot", slotOf(id));
    if (el.parentNode !== this) this.append(el);
  }

  private caps(id: string) {
    return this._model.views[id]?.caps ?? {};
  }

  private allowMove(id: string, target: string, zone: DropZone): boolean {
    if (this.caps(id).move === false) return false;
    if (this.caps(id).docsOnly) {
      const where = ops.locate(this._model, target);
      if (where.place !== "tree" || !where.stack.docs || zone !== "into") return false;
    }
    return this.emitBefore("flexdock-beforemove", { id, target, zone });
  }

  private emitBefore(type: string, detail: unknown): boolean {
    return this.dispatchEvent(new CustomEvent(type, { detail, cancelable: true, bubbles: true, composed: true }));
  }

  private keepFocus = false;

  /** Whether focus is inside the component (shadow or light DOM). */
  private hasFocus(): boolean {
    return Boolean(this.shadowRoot?.activeElement) || (document.activeElement !== this && this.contains(document.activeElement));
  }

  private commit(next: FlexdockModel, reason: ChangeReason, record = true): void {
    const prev = this._model;
    this.keepFocus = this.keepFocus || this.hasFocus();
    if (record && next !== prev && !SILENT.includes(reason)) this.timeline.push(prev);
    this._model = next;
    if (this.storageKey && reason !== "set") {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(next));
      } catch {
        /* storage full or disabled */
      }
    }
    if (prev.focus !== next.focus && next.focus) {
      this.dispatchEvent(new CustomEvent("flexdock-focus", { detail: { id: next.focus, previous: prev.focus }, bubbles: true, composed: true }));
    }
    if (reason !== "focus") {
      this.dispatchEvent(new CustomEvent("flexdock-change", { detail: { model: next, reason }, bubbles: true, composed: true }));
    }
    if (!SILENT.includes(reason) && reason !== "set") this._say = `${reason}`;
    this.requestUpdate();
  }

  private loadStored(fallback: FlexdockModel): FlexdockModel | undefined {
    if (!this.storageKey) return undefined;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return undefined;
      const parsed: unknown = JSON.parse(raw);
      if (!ops.isModel(parsed)) return undefined;
      // Views come from the app (titles may have changed); placement comes from storage.
      return ops.normalize({ ...parsed, views: fallback.views });
    } catch {
      return undefined;
    }
  }

  private fitBox(b: Box): Box {
    const r = this.getBoundingClientRect();
    const w = r.width || 1200;
    const h = r.height || 800;
    return clampBox(snapBox(b, this.snap), w, h);
  }

  private settled: Promise<unknown> = Promise.resolve();

  /** Resolves once the manager and all of its UI parts have rendered. */
  protected override async getUpdateComplete(): Promise<boolean> {
    let done = await super.getUpdateComplete();
    await this.settled;
    for (const el of Array.from(this.renderRoot.querySelectorAll("*"))) {
      if (el instanceof FlexdockPart) done = (await el.updateComplete) && done;
    }
    return done;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has("storageKey") && this.storageKey && !this.restoredFromStorage) {
      const stored = this.loadStored(this._model);
      if (stored) {
        this.restoredFromStorage = true;
        this.commit(stored, "restore", false);
      }
    }
    this.settled = this.afterParts();
  }

  /** Work that needs the parts' DOM: focus restore and first-show events. */
  private async afterParts(): Promise<void> {
    for (const el of Array.from(this.renderRoot.querySelectorAll("*"))) {
      if (el instanceof FlexdockPart) await el.updateComplete;
    }
    if (this.keepFocus) {
      this.keepFocus = false;
      if (!this.hasFocus() && !this._palette && !this._menu) {
        const active = this.renderRoot.querySelector<HTMLElement>("[data-stack][data-active]");
        (active?.querySelector<HTMLElement>('.tab[aria-selected="true"]') ?? active)?.focus({ preventScroll: true });
      }
    }
    for (const slot of Array.from(this.renderRoot.querySelectorAll<HTMLSlotElement>("slot[name]"))) {
      const id = slot.name.slice(2);
      if (!this.shown.has(id)) {
        this.shown.add(id);
        const make = this.factories.get(id);
        if (make) {
          this.factories.delete(id);
          this.mount(id, make());
        }
        this.dispatchEvent(new CustomEvent("flexdock-viewshow", { detail: { id }, bubbles: true, composed: true }));
      }
    }
  }

  // ------------------------------------------------------------- rendering

  private context(): DockContext {
    const g = this._drag?.gap;
    return {
      model: this._model,
      labels: this.t,
      popped: new Set(this.popped.keys()),
      gap: g ? { path: g.path.join("."), after: g.after, win: g.win ?? "" } : undefined,
      dragging: Boolean(this._drag)
    };
  }

  override render(): TemplateResult {
    const m = this._model;
    const ctx = this.context();
    const zoomed = m.zoom ? ops.locate(m, m.zoom) : undefined;
    const body = zoomed?.place === "tree"
      ? renderNode(zoomed.stack, [], zoomed.window, ctx)
      : m.root
        ? renderNode(m.root, [], undefined, ctx)
        : html`<div class="empty">${this.t.emptyDocs}</div>`;
    const rail = (side: Side) => m.drawers[side].length
      ? html`<flexdock-rail .side=${side} .views=${m.drawers[side]} .open=${this._peek} .ctx=${ctx}></flexdock-rail>`
      : nothing;
    return html`<div class="frame" part="frame" dir=${getComputedStyle(this).direction || "ltr"}>
      ${rail("top")}
      <div class="middle">
        ${rail("start")}
        <div class="main" part="main">${body}${this.renderFlyout(ctx)}</div>
        ${rail("end")}
      </div>
      ${rail("bottom")}
      ${m.windows.map((w, i) => html`<flexdock-window .key=${w.key} .box=${w.box} .tree=${w.tree} .layer=${i} .ctx=${ctx}></flexdock-window>`)}
      ${this.renderGuide()}
      ${this.renderMenu()}
      ${this.renderPalette()}
      <div class="sr" role="status" aria-live="polite">${this._say}</div>
    </div>`;
  }

  private renderFlyout(ctx: DockContext): TemplateResult | typeof nothing {
    const id = this._peek;
    if (!id) return nothing;
    const where = ops.locate(this._model, id);
    if (where.place !== "drawer") return nothing;
    return html`<flexdock-flyout .view=${id} .side=${where.side} .ctx=${ctx}></flexdock-flyout>`;
  }

  private renderGuide(): TemplateResult | typeof nothing {
    const d = this._drag;
    if (!d || d.mode === "pending" || d.mode === "tab") return nothing;
    const host = this.getBoundingClientRect();
    const main = this.mainRect();
    const rel = (s: Spot<string>, hot: boolean): GuideSpot => ({ zone: s.zone, x: s.x - host.left, y: s.y - host.top, hot });
    const compass = d.target ? compassSpots(d.target.rect).filter((c) => !d.fill || c.zone === "into") : [];
    const spots = [
      ...compass.map((s) => rel(s, s.zone === d.target?.zone)),
      ...(main ? edgeSpots(main) : []).map((s) => rel(s, s.zone === d.edge))
    ];
    if (d.gap) {
      const r = d.gap.rect;
      spots.push(rel({ zone: "between", x: r.left + r.width / 2, y: r.top + r.height / 2 }, true));
    }
    const p = d.preview;
    const preview = p ? { left: p.left - host.left, top: p.top - host.top, width: p.width, height: p.height } : undefined;
    const ghost = d.mode === "loose" ? { x: d.x - host.left, y: d.y - host.top, label: this._model.views[d.id]?.title ?? d.id } : undefined;
    return html`<flexdock-drop-guide .spots=${spots} .preview=${preview} .ghost=${ghost}></flexdock-drop-guide>`;
  }

  private openMenu(id: string): void {
    const host = this.getBoundingClientRect();
    const stackEl = Array.from(this.renderRoot.querySelectorAll<HTMLElement>("[data-stack]")).find((el) =>
      el.querySelector(`[id=${attr(`t-${id}`)}], [id=${attr(`tab-${id}`)}]`));
    const anchor = stackEl?.querySelector<HTMLElement>('[part~="more"]') ?? this.renderRoot.querySelector<HTMLElement>(`[data-stack] [part~="more"]`);
    const r = anchor?.getBoundingClientRect();
    this._menu = { id, x: r ? Math.min(r.left - host.left, host.width - 200) : 20, y: r ? r.bottom - host.top + 4 : 20 };
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLButtonElement>(".menu button")?.focus());
  }

  /** Entries of the "more actions" menu for a view. */
  private menuEntries(id: string): MenuEntry[] {
    const c = this.caps(id);
    const t = this.t;
    const where = ops.locate(this._model, id);
    const s = where.place === "tree" ? where.stack : undefined;
    const floating = where.place === "tree" && Boolean(where.window);
    const out: MenuEntry[] = [];
    if (s && s.views.length > 1) {
      for (const v of s.views) out.push({ label: this._model.views[v]?.title ?? v, action: "reveal", id: v, checked: v === s.current });
      out.push("separator");
    }
    if (floating) out.push({ label: t.dock, action: "dock", id });
    else if (c.float !== false) out.push({ label: t.float, action: "float", id });
    if (c.popout !== false) out.push({ label: t.popout, action: "popout", id });
    if (s && !s.docs && !floating && c.hide !== false) out.push({ label: t.stow, action: "stow", id });
    if (c.dismiss !== false) out.push({ label: t.dismiss, action: "dismiss", id });
    return out;
  }

  private renderMenu(): TemplateResult | typeof nothing {
    const menu = this._menu;
    if (!menu) return nothing;
    return html`<flexdock-menu .entries=${this.menuEntries(menu.id)} .x=${menu.x} .y=${menu.y}></flexdock-menu>`;
  }

  /** Palette entries: views + commands. */
  paletteItems(query = ""): Array<{ label: string; detail: string; run: () => void }> {
    const q = query.trim().toLowerCase();
    const views = ops.catalogue(this._model).map(({ id, info, where }) => ({
      label: info.title, detail: where === "tree" ? "" : where, run: () => this.reveal(id)
    }));
    const cmds = [
      { label: "Undo layout change", detail: "command", run: () => this.undo() },
      { label: "Redo layout change", detail: "command", run: () => this.redo() },
      { label: "Toggle fill layout", detail: "command", run: () => this.toggleZoom() }
    ];
    return [...views, ...cmds].filter((it) => !q || it.label.toLowerCase().includes(q));
  }

  private renderPalette(): TemplateResult | typeof nothing {
    const p = this._palette;
    if (!p) return nothing;
    return html`<flexdock-palette .items=${this.paletteItems(p.query)} .query=${p.query} .index=${p.index}
      .label=${this.t.palette} .placeholder=${this.t.palettePlaceholder} .empty=${this.t.noMatches}></flexdock-palette>`;
  }

  // ------------------------------------------------------------- part requests

  private onRequest = (e: Event): void => {
    const r = (e as CustomEvent<PartRequest>).detail;
    e.stopPropagation();
    const id = r.id ?? "";
    if (r.fromMenu) this._menu = undefined;
    switch (r.action) {
      case "activate": return this.onStackPointer(r["event"] as PointerEvent, id, r["source"] as HTMLElement);
      case "grab": return this.startDrag(r["event"] as PointerEvent, id, r["win"] as string | undefined, r["source"] as HTMLElement);
      case "reveal": return this.reveal(id);
      case "dismiss": return this.dismiss(id);
      case "zoom": return this.toggleZoom(id);
      case "stow": return this.stow(id);
      case "unstow": return this.unstow(id);
      case "float": return this.detach(id);
      case "dock": return this.dockToEdge(id, "edge-right");
      case "popout": void this.popOut(id); return;
      case "popin": return this.popIn(id);
      case "menu": return this.openMenu(id);
      case "menu-close": this._menu = undefined; return;
      case "peek": return r["toggle"] ? this.togglePeek(id) : this.openPeek(id);
      case "peek-close": this._peek = undefined; return;
      case "raise": return this.raise(r["key"] as string);
      case "grip": return this.startGrip(r["event"] as PointerEvent, r["key"] as string);
      case "gutter-grab":
        return this.startGutter(r["event"] as PointerEvent, r["path"] as number[], r["after"] as number, r["axis"] as "row" | "column",
          r["win"] as string | undefined, r["source"] as HTMLElement);
      case "gutter-key":
        return this.keyGutter(r["event"] as KeyboardEvent, r["path"] as number[], r["after"] as number, r["axis"] as "row" | "column",
          r["weights"] as number[], r["win"] as string | undefined);
      case "palette-query": this._palette = { query: String(r["query"] ?? ""), index: 0 }; return;
      case "palette-index": if (this._palette) this._palette = { ...this._palette, index: Number(r["index"]) }; return;
      case "palette-close": this._palette = undefined; return;
      case "palette-choose": {
        const it = this.paletteItems(this._palette?.query)[Number(r["index"])];
        this._palette = undefined;
        it?.run();
        return;
      }
    }
  };

  private peekAt = 0;
  private openPeek(id: string): void {
    this._peek = id;
    this.peekAt = Date.now();
  }
  private togglePeek(id: string): void {
    if (this._peek === id && Date.now() - this.peekAt > 400) this._peek = undefined;
    else this.openPeek(id);
  }

  private onStackPointer(e: PointerEvent, id: string, section: HTMLElement): void {
    if (id) this.activate(id);
    const first = e.composedPath()[0] as HTMLElement | undefined;
    const focusable = first?.closest?.("button, a, input, select, textarea, [tabindex], [contenteditable]");
    if (focusable && focusable !== this && (this.contains(focusable) || this.renderRoot.contains(focusable))) return;
    // Run after the browser's own mousedown focus handling.
    setTimeout(() => {
      if (!this.hasFocus()) section.focus({ preventScroll: true });
    });
  }

  // ------------------------------------------------------------- pointer interactions

  private onOutside = (e: PointerEvent): void => {
    const path = e.composedPath();
    if (this._menu && !path.some((n) => (n as HTMLElement).classList?.contains("menu"))) this._menu = undefined;
    if (this._palette && !path.some((n) => (n as HTMLElement).classList?.contains("palette"))) this._palette = undefined;
    if (this._peek && !path.some((n) => {
      const el = n as HTMLElement;
      return el.classList?.contains("drawer") || el.classList?.contains("rail") || el.getAttribute?.("data-view") === this._peek;
    })) this._peek = undefined;
  };

  private mainRect(): Rect | undefined {
    return this.renderRoot.querySelector(".main")?.getBoundingClientRect();
  }

  private raise(key: string): void {
    const next = ops.raiseWindow(this._model, key);
    if (next !== this._model) this.commit(next, "focus", false);
  }

  private startDrag(e: PointerEvent, id: string, win: string | undefined, target: HTMLElement): void {
    if (e.button !== 0 || this.caps(id).move === false) return;
    const w = win ? this._model.windows.find((x) => x.key === win) : undefined;
    const soleInWindow = w && ops.viewsIn(w.tree).length === 1;
    this._drag = {
      id, mode: "pending", startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, pointerId: e.pointerId,
      windowKey: soleInWindow ? win : undefined, windowStart: soleInWindow ? { ...w!.box } : undefined,
      strip: target.classList.contains("tab") ? (target.closest<HTMLElement>(".tabs") ?? undefined) : undefined,
      origin: this._model
    };
    window.addEventListener("pointermove", this.onDragMove);
    window.addEventListener("pointerup", this.onDragEnd);
    window.addEventListener("pointercancel", this.onDragCancel);
    window.addEventListener("keydown", this.onDragKey, true);
  }

  /** Escape while dragging: put everything back the way it was. */
  private onDragKey = (e: KeyboardEvent): void => {
    if (e.key !== "Escape" || !this._drag) return;
    e.preventDefault();
    e.stopPropagation();
    this.cancelDrag();
  };

  /** Abort the current drag and restore the layout from before it started. */
  cancelDrag(): void {
    const d = this._drag;
    if (!d) return;
    this.endDragListeners();
    this._drag = undefined;
    if (this._model !== d.origin) this.commit(d.origin, "cancel", false);
    else this.requestUpdate();
    this.dispatchEvent(new CustomEvent("flexdock-dragcancel", { detail: { id: d.id }, bubbles: true, composed: true }));
  }

  private onDragMove = (e: PointerEvent): void => {
    const d = this._drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const next: DragState = { ...d, x: e.clientX, y: e.clientY };
    if (next.mode === "pending") {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      next.mode = d.windowKey ? "window" : d.strip ? "tab" : "loose";
      this._menu = undefined;
    }
    if (next.mode === "tab" && next.strip) {
      const r = next.strip.getBoundingClientRect();
      if (e.clientY < r.top - 16 || e.clientY > r.bottom + 16) next.mode = "loose";
      else {
        const tabs = Array.from(next.strip.querySelectorAll<HTMLElement>(".tab")).filter((t) => t.dataset["view"] !== d.id);
        const rtl = getComputedStyle(this).direction === "rtl";
        const idx = insertionIndex(tabs.map((t) => t.getBoundingClientRect()), e.clientX, rtl);
        const where = ops.locate(this._model, d.id);
        if (where.place === "tree" && where.stack.views.indexOf(d.id) !== idx) {
          this.commit(ops.reorder(this._model, d.id, idx), "reorder", false);
        }
      }
    }
    if (next.mode === "window" && next.windowKey && next.windowStart) {
      const b = next.windowStart;
      const box = { ...b, x: b.x + e.clientX - d.startX, y: b.y + e.clientY - d.startY };
      this._model = ops.moveWindow(this._model, next.windowKey, box);
    }
    if (next.mode === "loose" || next.mode === "window") this.findTarget(next);
    this._drag = next;
    this.requestUpdate();
  };

  private findTarget(d: DragState): void {
    d.target = undefined;
    d.gap = undefined;
    d.fill = undefined;
    d.edge = undefined;
    d.preview = undefined;
    const main = this.mainRect();
    if (main && !this.caps(d.id).docsOnly) {
      const edge = hit(edgeSpots(main), d.x, d.y);
      if (edge) {
        d.edge = edge;
        d.preview = previewFor(main, edge);
        return;
      }
    }
    const inWindow = (el: HTMLElement) => el.closest<HTMLElement>("[data-window]");
    const overWindow = Array.from(this.renderRoot.querySelectorAll<HTMLElement>("[data-window]")).some((w) => {
      if (w.dataset["window"] === d.windowKey) return false;
      const r = w.getBoundingClientRect();
      return d.x >= r.left && d.x <= r.right && d.y >= r.top && d.y <= r.bottom;
    });
    if (!this.caps(d.id).docsOnly) {
      const gutters = Array.from(this.renderRoot.querySelectorAll<HTMLElement>(".gutter[data-path]"))
        .filter((g) => (overWindow ? inWindow(g) : !inWindow(g)) && g.dataset["win"] !== d.windowKey);
      for (const g of gutters.reverse()) {
        const r = g.getBoundingClientRect();
        const pad = 6;
        if (d.x >= r.left - pad && d.x <= r.right + pad && d.y >= r.top - pad && d.y <= r.bottom + pad) {
          const path = (g.dataset["path"] ?? "").split(".").filter(Boolean).map(Number);
          const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
          d.gap = { path, after: Number(g.dataset["after"]), win: g.dataset["win"] || undefined, rect };
          const vertical = r.height > r.width;
          const size = 80;
          d.preview = vertical
            ? { left: r.left + r.width / 2 - size / 2, top: r.top, width: size, height: r.height }
            : { left: r.left, top: r.top + r.height / 2 - size / 2, width: r.width, height: size };
          return;
        }
      }
    }
    const stacks = Array.from(this.renderRoot.querySelectorAll<HTMLElement>("[data-stack]"))
      .filter((el) => !el.closest(".drawer") && (!d.windowKey || el.dataset["win"] !== d.windowKey));
    // Prefer windows (topmost) over docked groups.
    const under = stacks.reverse().find((el) => {
      const r = el.getBoundingClientRect();
      return d.x >= r.left && d.x <= r.right && d.y >= r.top && d.y <= r.bottom;
    });
    if (!under) return;
    if (under.hasAttribute("data-empty")) {
      const r = under.getBoundingClientRect();
      const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
      d.fill = { path: (under.dataset["path"] ?? "").split(".").filter(Boolean).map(Number), win: under.dataset["win"] || undefined, rect };
      const s = compassSpots(rect)[0]!;
      d.target = { view: "", rect, zone: hit([s], d.x, d.y) ?? undefined };
      if (d.target.zone) d.preview = rect;
      return;
    }
    if (this.caps(d.id).docsOnly && !under.hasAttribute("data-docs")) return;
    const first = under.querySelector<HTMLElement>(".tab")?.dataset["view"] ?? under.dataset["stack"]!;
    const rect = under.getBoundingClientRect();
    const zone = hit(compassSpots(rect), d.x, d.y);
    d.target = { view: first, rect, zone };
    if (zone) d.preview = previewFor(rect, zone);
  }

  private onDragEnd = (e: PointerEvent): void => {
    const d = this._drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.endDragListeners();
    this._drag = undefined;
    if (d.mode === "pending") return;
    if (d.mode === "tab") {
      this.timeline.push(this._model);
      this.commit(this._model, "reorder", false);
      return;
    }
    if (d.edge) return this.dockToEdge(d.id, d.edge);
    if (d.gap) return this.dropBetween(d.id, d.gap.path, d.gap.after, d.gap.win);
    if (d.fill && d.target?.zone) return this.dropIntoDocs(d.id, d.fill.path, d.fill.win);
    if (d.target?.zone) return this.place(d.id, d.target.view, d.target.zone);
    if (d.mode === "window" && d.windowKey && d.windowStart) {
      const w = this._model.windows.find((x) => x.key === d.windowKey);
      if (w) {
        const fitted = this.fitBox(w.box);
        this._model = ops.moveWindow(this._model, d.windowKey, d.windowStart);
        this.commit(ops.moveWindow(this._model, d.windowKey, fitted), "window");
      }
      return;
    }
    const host = this.getBoundingClientRect();
    this.detach(d.id, { x: d.x - host.left - 40, y: d.y - host.top - 12, w: 360, h: 240 });
  };

  private onDragCancel = (): void => this.cancelDrag();

  private endDragListeners(): void {
    window.removeEventListener("pointermove", this.onDragMove);
    window.removeEventListener("pointerup", this.onDragEnd);
    window.removeEventListener("pointercancel", this.onDragCancel);
    window.removeEventListener("keydown", this.onDragKey, true);
  }

  private startGutter(e: PointerEvent, path: number[], index: number, axis: "row" | "column", win: string | undefined, gutter: HTMLElement): void {
    if (e.button !== 0) return;
    e.preventDefault();
    const cells = Array.from(gutter.parentElement!.children).filter((c) => c.classList.contains("cell")) as HTMLElement[];
    const sizes = cells.map((c) => (axis === "row" ? c.getBoundingClientRect().width : c.getBoundingClientRect().height));
    const start = axis === "row" ? e.clientX : e.clientY;
    const rtl = axis === "row" && getComputedStyle(this).direction === "rtl";
    const before = this._model;
    gutter.toggleAttribute("data-live", true);
    const move = (ev: PointerEvent) => {
      const delta = ((axis === "row" ? ev.clientX : ev.clientY) - start) * (rtl ? -1 : 1);
      const next = shareSpace(sizes, index, delta);
      this._model = ops.setWeights(this._model, path, next.map((n) => Math.max(1, n)), win);
      this.requestUpdate();
    };
    const up = () => {
      gutter.removeAttribute("data-live");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (this._model !== before) {
        this.timeline.push(before);
        this.commit(this._model, "resize", false);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  private keyGutter(e: KeyboardEvent, path: number[], index: number, axis: "row" | "column", weights: number[], win?: string): void {
    const node = { axis, weights };
    const grow = node.axis === "row" ? ["ArrowRight"] : ["ArrowDown"];
    const shrink = node.axis === "row" ? ["ArrowLeft"] : ["ArrowUp"];
    const total = node.weights.reduce((a, b) => a + b, 0);
    let delta = 0;
    if (grow.includes(e.key)) delta = total * 0.03;
    else if (shrink.includes(e.key)) delta = -total * 0.03;
    else if (e.key === "Home") delta = -total;
    else if (e.key === "End") delta = total;
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (getComputedStyle(this).direction === "rtl" && node.axis === "row" && e.key.startsWith("Arrow")) delta = -delta;
    const next = shareSpace(node.weights, index, delta, total * 0.05);
    this.commit(ops.setWeights(this._model, path, next, win), "resize");
  }

  private startGrip(e: PointerEvent, key: string): void {
    e.preventDefault();
    e.stopPropagation();
    const w = this._model.windows.find((x) => x.key === key);
    if (!w) return;
    const start = { ...w.box };
    const before = this._model;
    const move = (ev: PointerEvent) => {
      const box = snapBox({ ...start, w: Math.max(160, start.w + ev.clientX - e.clientX), h: Math.max(90, start.h + ev.clientY - e.clientY) }, this.snap);
      this._model = ops.moveWindow(this._model, key, box);
      this.requestUpdate();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      this.timeline.push(before);
      this.commit(this._model, "window", false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // ------------------------------------------------------------- keyboard

  private onKey = (e: KeyboardEvent): void => {
    const focus = this._model.focus;
    const key = e.key;
    if ((e.ctrlKey || e.metaKey) && key === ".") return this.handled(e, () => this.openPalette());
    if ((e.ctrlKey || e.metaKey) && e.altKey && (key === "z" || key === "Z")) return this.handled(e, () => this.undo());
    if ((e.ctrlKey || e.metaKey) && e.altKey && (key === "y" || key === "Y")) return this.handled(e, () => this.redo());
    if (key === "Escape") {
      if (this._peek) return this.handled(e, () => { this._peek = undefined; });
      if (this._model.zoom) return this.handled(e, () => this.toggleZoom());
    }
    if (!e.altKey || !focus) return;
    const dir: Record<string, DropZone> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "above", ArrowDown: "below" };
    if (dir[key] && e.shiftKey) return this.handled(e, () => this.nudge(focus, dir[key]!));
    if (dir[key]) return this.handled(e, () => this.focusNeighbour(dir[key]!));
    if (key === "PageDown" || key === "PageUp") return this.handled(e, () => this.cycleTab(focus, key === "PageDown" ? 1 : -1));
    const k = key.toLowerCase();
    if (k === "z") return this.handled(e, () => this.toggleZoom(focus));
    if (k === "h") return this.handled(e, () => this.stow(focus));
    if (k === "f") return this.handled(e, () => this.detach(focus));
    if (key === "Backspace") return this.handled(e, () => this.dismiss(focus));
  };

  private handled(e: KeyboardEvent, fn: () => void): void {
    e.preventDefault();
    e.stopPropagation();
    fn();
  }

  /** Split the focused view off its group to one side (or move it beside its group). */
  nudge(id: string, zone: DropZone): void {
    const where = ops.locate(this._model, id);
    if (where.place !== "tree") return;
    const other = where.stack.views.find((v) => v !== id);
    if (other) return this.place(id, other, zone);
    const edge = ({ left: "edge-left", right: "edge-right", above: "edge-above", below: "edge-below" } as const)[zone as "left"];
    if (edge && !where.window) this.dockToEdge(id, edge);
  }

  /** Select the next/previous tab in the focused view's group. */
  cycleTab(id: string, step: number): void {
    const where = ops.locate(this._model, id);
    if (where.place !== "tree") return;
    const v = where.stack.views;
    const next = v[(v.indexOf(id) + step + v.length) % v.length];
    if (next) this.reveal(next);
  }

  /** Move focus to the nearest visible group in a direction. */
  focusNeighbour(zone: DropZone): void {
    const els = Array.from(this.renderRoot.querySelectorAll<HTMLElement>("[data-stack]"));
    const cur = els.find((el) => el.hasAttribute("data-active"));
    if (!cur) {
      const first = els[0]?.dataset["stack"];
      if (first) this.activate(first);
      return;
    }
    const c = cur.getBoundingClientRect();
    const cx = c.left + c.width / 2;
    const cy = c.top + c.height / 2;
    let best: { el: HTMLElement; d: number } | undefined;
    for (const el of els) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const ok = zone === "left" ? x < cx - 1 : zone === "right" ? x > cx + 1 : zone === "above" ? y < cy - 1 : y > cy + 1;
      if (!ok) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (!best || d < best.d) best = { el, d };
    }
    if (best) {
      const tab = best.el.querySelector<HTMLElement>('.tab[aria-selected="true"]');
      const id = tab?.dataset["view"] ?? best.el.dataset["stack"];
      if (id) this.activate(id);
      (tab ?? best.el.querySelector<HTMLElement>(".btn"))?.focus();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "flexdock-manager": FlexdockManager;
  }
  interface HTMLElementEventMap {
    "flexdock-change": CustomEvent<{ model: FlexdockModel; reason: ChangeReason }>;
    "flexdock-focus": CustomEvent<{ id: string; previous?: string }>;
    "flexdock-viewshow": CustomEvent<{ id: string }>;
    "flexdock-beforeclose": CustomEvent<{ id: string }>;
    "flexdock-beforemove": CustomEvent<{ id: string; target?: string; zone: DropZone | EdgeZone | "between" }>;
    "flexdock-dragcancel": CustomEvent<{ id: string }>;
  }
}
