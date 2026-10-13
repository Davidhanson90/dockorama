import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { icons } from "./icons.js";
import { DEFAULT_LABELS, type FlexdockLabels } from "./labels.js";
import { Timeline } from "./history.js";
import { styles } from "./styles.js";
import {
  clampBox, compassSpots, edgeSpots, hit, insertionIndex, previewFor, shareSpace, snapBox, type Rect, type Spot
} from "./geometry.js";
import type { Box, DockNode, DropZone, EdgeZone, FlexdockModel, Side, StackNode, ViewInfo } from "./model.js";
import * as ops from "./ops.js";

/** Why the model changed (detail of `flexdock-change`). */
export type ChangeReason =
  | "set" | "place" | "edge" | "detach" | "window" | "stow" | "unstow" | "dismiss" | "reveal" | "select"
  | "reorder" | "resize" | "zoom" | "add" | "forget" | "undo" | "redo" | "focus" | "restore";

const SILENT: ChangeReason[] = ["select", "focus"];
const slotOf = (id: string) => `v:${id}`;
/** Quote a value for an attribute selector. */
const attr = (v: string) => JSON.stringify(v);

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
  edge?: EdgeZone;
  preview?: Rect;
  pointerId: number;
}

/**
 * `<flexdock-manager>`: a docking layout of views (panels and documents) the user can rearrange.
 * Content is light DOM: give each child `data-view="<id>"` matching an id in `model.views`.
 */
export class FlexdockManager extends LitElement {
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
    document.addEventListener("pointerdown", this.onOutside, true);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.removeEventListener("keydown", this.onKey);
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
  /** Float a view in its own window. */
  detach(id: string, box?: Box): void {
    if (this.caps(id).float === false) return;
    const r = this.getBoundingClientRect();
    const b = box ?? { x: Math.max(20, r.width / 2 - 180), y: Math.max(20, r.height / 2 - 120), w: 360, h: 240 };
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
      this._peek = id;
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
  /** Register a new view and show it. */
  addView(id: string, info: ViewInfo, near?: { view: string; zone: DropZone }): void {
    this.commit(ops.addView(this._model, id, info, near), "add");
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

  private commit(next: FlexdockModel, reason: ChangeReason, record = true): void {
    const prev = this._model;
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

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has("storageKey") && this.storageKey && !this.restoredFromStorage) {
      const stored = this.loadStored(this._model);
      if (stored) {
        this.restoredFromStorage = true;
        this.commit(stored, "restore", false);
      }
    }
    for (const slot of Array.from(this.renderRoot.querySelectorAll<HTMLSlotElement>("slot[name]"))) {
      const id = slot.name.slice(2);
      if (!this.shown.has(id)) {
        this.shown.add(id);
        this.dispatchEvent(new CustomEvent("flexdock-viewshow", { detail: { id }, bubbles: true, composed: true }));
      }
    }
  }

  // ------------------------------------------------------------- rendering

  override render(): TemplateResult {
    const m = this._model;
    const zoomed = m.zoom ? ops.locate(m, m.zoom) : undefined;
    const body = zoomed?.place === "tree"
      ? this.renderStack(zoomed.stack, [], zoomed.window)
      : m.root
        ? this.renderNode(m.root, [])
        : html`<div class="empty">${this.t.emptyDocs}</div>`;
    return html`<div class="frame" part="frame" dir=${getComputedStyle(this).direction || "ltr"}>
      ${this.renderRail("top")}
      <div class="middle">
        ${this.renderRail("start")}
        <div class="main" part="main">${body}${this.renderDrawer()}</div>
        ${this.renderRail("end")}
      </div>
      ${this.renderRail("bottom")}
      ${m.windows.map((w, i) => this.renderWindow(w.key, w.box, w.tree, i))}
      ${this.renderOverlay()}
      ${this.renderMenu()}
      ${this.renderPalette()}
      <div class="sr" role="status" aria-live="polite">${this._say}</div>
    </div>`;
  }

  private renderNode(node: DockNode, path: number[], win?: string): TemplateResult {
    if (node.kind === "stack") return this.renderStack(node, path, win);
    const total = node.weights.reduce((a, b) => a + b, 0) || 1;
    const parts: TemplateResult[] = [];
    node.children.forEach((child, i) => {
      if (i > 0) {
        const pct = Math.round((node.weights.slice(0, i).reduce((a, b) => a + b, 0) / total) * 100);
        parts.push(html`<div class="gutter" part="gutter" role="separator" tabindex="0"
          aria-orientation=${node.axis === "row" ? "vertical" : "horizontal"} aria-label=${this.t.resize}
          aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct}
          @pointerdown=${(e: PointerEvent) => this.startGutter(e, path, i - 1, node.axis, win)}
          @keydown=${(e: KeyboardEvent) => this.keyGutter(e, path, i - 1, node, win)}></div>`);
      }
      parts.push(html`<div class="cell" style="flex: ${node.weights[i] ?? 1} 1 0px">${this.renderNode(child, [...path, i], win)}</div>`);
    });
    return html`<div class="split" part="split" data-axis=${node.axis}>${parts}</div>`;
  }

  private renderStack(s: StackNode, path: number[], win?: string): TemplateResult {
    const m = this._model;
    const active = s.views.includes(m.focus ?? "\u0000");
    const tabbed = s.docs || s.views.length > 1;
    const cur = s.current;
    const info = m.views[cur];
    const key = s.views[0] ?? `docs-${path.join(".")}`;
    return html`<section class="stack" part="group${s.docs ? " docs" : ""}" data-stack=${key} data-win=${win ?? ""}
      ?data-active=${active} ?data-tabs=${tabbed} aria-label=${info?.title ?? this.t.emptyDocs}
      @pointerdown=${() => cur && this.activate(cur)}>
      <div class="bar" part="bar" @pointerdown=${(e: PointerEvent) => !tabbed && cur && this.startDrag(e, cur, win)}
        @dblclick=${() => cur && this.toggleZoom(cur)}>
        ${tabbed
          ? html`<div class="tabs" role="tablist" aria-label=${info?.title ?? ""}>${s.views.map((v) => this.renderTab(v, v === cur, s, win))}</div>`
          : html`<span class="title" id="t-${cur}">${info?.icon ? html`<span class="glyph">${info.icon}</span>` : nothing}${info?.title ?? cur}</span>`}
        ${cur ? this.renderActions(cur, s, win) : nothing}
      </div>
      <div class="body" part="body" role=${tabbed ? "tabpanel" : "region"} aria-labelledby=${cur ? `tab-${cur}` : nothing}
        ?data-inert=${Boolean(info?.caps?.inert)}>
        ${cur ? this.renderContent(cur) : html`<div class="empty">${this.t.emptyDocs}</div>`}
      </div>
    </section>`;
  }

  private renderContent(id: string): TemplateResult {
    if (this.popped.has(id)) {
      return html`<div class="away"><p>${this.t.poppedOut}</p><button class="btn" style="width:auto;padding:0 10px" @click=${() => this.popIn(id)}>${this.t.popin}</button></div>`;
    }
    return html`<slot name=${slotOf(id)}></slot>`;
  }

  private renderTab(id: string, selected: boolean, s: StackNode, win?: string): TemplateResult {
    const info = this._model.views[id];
    return html`<div class="tab" part="tab${selected ? " tab-current" : ""}" role="tab" id="tab-${id}" data-view=${id}
      aria-selected=${selected ? "true" : "false"} tabindex=${selected ? "0" : "-1"}
      @click=${() => this.reveal(id)} @pointerdown=${(e: PointerEvent) => this.startDrag(e, id, win)}
      @auxclick=${(e: MouseEvent) => e.button === 1 && this.dismiss(id)}>
      ${info?.icon ? html`<span class="glyph">${info.icon}</span>` : nothing}<span class="label">${info?.title ?? id}</span>
      ${s.docs && info?.caps?.dismiss !== false
        ? html`<button class="btn" part="tab-close" tabindex="-1" aria-label="${this.t.dismiss} ${info?.title ?? id}"
            @pointerdown=${(e: Event) => e.stopPropagation()} @click=${(e: Event) => { e.stopPropagation(); this.dismiss(id); }}>${icons.close}</button>`
        : nothing}
    </div>`;
  }

  private renderActions(id: string, s: StackNode, win?: string): TemplateResult {
    const c = this.caps(id);
    const zoomed = Boolean(this._model.zoom);
    const stop = (e: Event) => e.stopPropagation();
    const b = (label: string, icon: unknown, fn: () => void, part: string) =>
      html`<button class="btn" part="action ${part}" title=${label} aria-label=${label} @pointerdown=${stop} @click=${(e: Event) => { stop(e); fn(); }}>${icon}</button>`;
    return html`
      ${!win && !s.docs && c.hide !== false && !zoomed ? b(this.t.stow, icons.stow, () => this.stow(id), "stow") : nothing}
      ${c.zoom !== false ? b(zoomed ? this.t.unzoom : this.t.zoom, zoomed ? icons.unzoom : icons.zoom, () => this.toggleZoom(id), "zoom") : nothing}
      ${b(this.t.more, icons.more, () => this.openMenu(id), "more")}
      ${!s.docs && c.dismiss !== false ? b(this.t.dismiss, icons.close, () => this.dismiss(id), "close") : nothing}`;
  }

  private renderRail(side: Side): TemplateResult | typeof nothing {
    const ids = this._model.drawers[side];
    if (!ids.length) return nothing;
    return html`<div class="rail" part="rail" data-side=${side} role="toolbar" aria-label=${side}>
      ${ids.map((id) => html`<button class="rail-item" part="rail-item" aria-expanded=${this._peek === id ? "true" : "false"}
        @click=${() => { this._peek = this._peek === id ? undefined : id; }}
        @pointerenter=${(e: PointerEvent) => { if (e.pointerType === "mouse") this._peek = id; }}>
        ${this._model.views[id]?.title ?? id}</button>`)}
    </div>`;
  }

  private renderDrawer(): TemplateResult | typeof nothing {
    const id = this._peek;
    if (!id) return nothing;
    const where = ops.locate(this._model, id);
    if (where.place !== "drawer") return nothing;
    const info = this._model.views[id];
    return html`<div class="drawer" part="drawer" data-side=${where.side} @keydown=${(e: KeyboardEvent) => e.key === "Escape" && (this._peek = undefined)}>
      <section class="stack" data-active data-stack=${id}>
        <div class="bar" part="bar"><span class="title">${info?.title ?? id}</span>
          <button class="btn" part="action unstow" aria-label=${this.t.unstow} title=${this.t.unstow} @click=${() => this.unstow(id)}>${icons.unstow}</button>
          ${info?.caps?.dismiss !== false ? html`<button class="btn" part="action close" aria-label=${this.t.dismiss} @click=${() => this.dismiss(id)}>${icons.close}</button>` : nothing}
        </div>
        <div class="body" part="body" role="region" aria-label=${info?.title ?? id}>${this.renderContent(id)}</div>
      </section>
    </div>`;
  }

  private renderWindow(key: string, box: Box, tree: DockNode, i: number): TemplateResult {
    const title = ops.viewsIn(tree).map((v) => this._model.views[v]?.title ?? v).join(", ");
    return html`<div class="window" part="window" role="dialog" aria-label=${title} data-window=${key}
      style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;z-index:${30 + i}"
      @pointerdown=${() => this.raise(key)}>
      <div class="content">${this.renderNode(tree, [], key)}</div>
      <div class="grip" part="grip" @pointerdown=${(e: PointerEvent) => this.startGrip(e, key)}></div>
    </div>`;
  }

  private renderOverlay(): TemplateResult | typeof nothing {
    const d = this._drag;
    if (!d || d.mode === "pending" || d.mode === "tab") return nothing;
    const host = this.getBoundingClientRect();
    const rel = (x: number, y: number) => `left:${x - host.left}px;top:${y - host.top}px`;
    const main = this.mainRect();
    const arrow: Record<string, number> = { left: -90, right: 90, above: 0, below: 180 };
    const compass = d.target ? compassSpots(d.target.rect) : [];
    const edges = main ? edgeSpots(main) : [];
    const spot = (s: Spot<string>, hot: boolean) => {
      const dir = s.zone.replace("edge-", "");
      return html`<div class="target" part="target" data-zone=${s.zone} ?data-hot=${hot} style=${rel(s.x, s.y)}>
        ${dir === "into" ? icons.join : icons.arrow(arrow[dir] ?? 0)}</div>`;
    };
    return html`<div class="overlay" part="overlay">
      ${d.preview ? html`<div class="preview" part="preview" style="${rel(d.preview.left, d.preview.top)};width:${d.preview.width}px;height:${d.preview.height}px"></div>` : nothing}
      ${compass.map((s) => spot(s, s.zone === d.target?.zone))}
      ${edges.map((s) => spot(s, s.zone === d.edge))}
      ${d.mode === "loose" ? html`<div class="ghost" part="ghost" style=${rel(d.x, d.y)}>${this._model.views[d.id]?.title ?? d.id}</div>` : nothing}
    </div>`;
  }

  private openMenu(id: string): void {
    const btn = this.renderRoot.querySelector<HTMLElement>(`[data-stack] [part~="more"]`);
    const host = this.getBoundingClientRect();
    const stackEl = Array.from(this.renderRoot.querySelectorAll<HTMLElement>("[data-stack]")).find((el) =>
      el.querySelector(`[id=${attr(`t-${id}`)}], [id=${attr(`tab-${id}`)}]`));
    const anchor = stackEl?.querySelector<HTMLElement>('[part~="more"]') ?? btn;
    const r = anchor?.getBoundingClientRect();
    this._menu = { id, x: r ? Math.min(r.left - host.left, host.width - 200) : 20, y: r ? r.bottom - host.top + 4 : 20 };
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLButtonElement>(".menu button")?.focus());
  }

  private renderMenu(): TemplateResult | typeof nothing {
    const menu = this._menu;
    if (!menu) return nothing;
    const id = menu.id;
    const c = this.caps(id);
    const where = ops.locate(this._model, id);
    const s = where.place === "tree" ? where.stack : undefined;
    const run = (fn: () => void) => () => { this._menu = undefined; fn(); };
    return html`<div class="menu" part="menu" role="menu" style="left:${menu.x}px;top:${menu.y}px"
      @keydown=${(e: KeyboardEvent) => this.menuKeys(e)}>
      ${s && s.views.length > 1 ? html`${s.views.map((v) => html`<button role="menuitemradio" aria-checked=${v === s.current ? "true" : "false"}
        @click=${run(() => this.reveal(v))}>${this._model.views[v]?.title ?? v}</button>`)}<hr>` : nothing}
      ${where.place === "tree" && where.window
        ? html`<button role="menuitem" @click=${run(() => this.dockToEdge(id, "edge-right"))}>${this.t.dock}</button>`
        : c.float !== false ? html`<button role="menuitem" @click=${run(() => this.detach(id))}>${this.t.float}</button>` : nothing}
      ${c.popout !== false ? html`<button role="menuitem" @click=${run(() => this.popOut(id))}>${this.t.popout}</button>` : nothing}
      ${s && !s.docs && !(where.place === "tree" && where.window) && c.hide !== false ? html`<button role="menuitem" @click=${run(() => this.stow(id))}>${this.t.stow}</button>` : nothing}
      ${c.dismiss !== false ? html`<button role="menuitem" @click=${run(() => this.dismiss(id))}>${this.t.dismiss}</button>` : nothing}
    </div>`;
  }

  private menuKeys(e: KeyboardEvent): void {
    const items = Array.from(this.renderRoot.querySelectorAll<HTMLButtonElement>(".menu button"));
    const i = items.indexOf(this.renderRoot.querySelector(".menu button:focus") as HTMLButtonElement);
    if (e.key === "Escape") this._menu = undefined;
    else if (e.key === "ArrowDown") items[(i + 1) % items.length]?.focus();
    else if (e.key === "ArrowUp") items[(i - 1 + items.length) % items.length]?.focus();
    else return;
    e.preventDefault();
    e.stopPropagation();
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
    const items = this.paletteItems(p.query);
    const index = Math.min(p.index, Math.max(0, items.length - 1));
    const choose = (n: number) => { const it = items[n]; this._palette = undefined; it?.run(); };
    return html`<div class="palette" part="palette" role="dialog" aria-label=${this.t.palette}>
      <input role="combobox" aria-expanded="true" aria-controls="fd-pal" aria-label=${this.t.palette}
        placeholder=${this.t.palettePlaceholder} .value=${p.query}
        @input=${(e: Event) => { this._palette = { query: (e.target as HTMLInputElement).value, index: 0 }; }}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "ArrowDown") this._palette = { ...p, index: Math.min(index + 1, items.length - 1) };
          else if (e.key === "ArrowUp") this._palette = { ...p, index: Math.max(index - 1, 0) };
          else if (e.key === "Enter") choose(index);
          else if (e.key === "Escape") this._palette = undefined;
          else return;
          e.preventDefault();
          e.stopPropagation();
        }}>
      <ul id="fd-pal" role="listbox">
        ${items.length ? items.map((it, n) => html`<li role="option" aria-selected=${n === index ? "true" : "false"}
          @pointerdown=${(e: Event) => { e.preventDefault(); choose(n); }}>${it.label}<small>${it.detail}</small></li>`)
          : html`<li aria-disabled="true">${this.t.noMatches}</li>`}
      </ul>
    </div>`;
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

  private startDrag(e: PointerEvent, id: string, win?: string): void {
    if (e.button !== 0 || this.caps(id).move === false) return;
    const target = e.currentTarget as HTMLElement;
    const w = win ? this._model.windows.find((x) => x.key === win) : undefined;
    const soleInWindow = w && ops.viewsIn(w.tree).length === 1;
    this._drag = {
      id, mode: "pending", startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, pointerId: e.pointerId,
      windowKey: soleInWindow ? win : undefined, windowStart: soleInWindow ? { ...w!.box } : undefined,
      strip: target.classList.contains("tab") ? (target.parentElement as HTMLElement) : undefined
    };
    window.addEventListener("pointermove", this.onDragMove);
    window.addEventListener("pointerup", this.onDragEnd);
    window.addEventListener("pointercancel", this.onDragCancel);
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
    const stacks = Array.from(this.renderRoot.querySelectorAll<HTMLElement>("[data-stack]"))
      .filter((el) => !el.closest(".drawer") && (!d.windowKey || el.dataset["win"] !== d.windowKey));
    // Prefer windows (topmost) over docked groups.
    const under = stacks.reverse().find((el) => {
      const r = el.getBoundingClientRect();
      return d.x >= r.left && d.x <= r.right && d.y >= r.top && d.y <= r.bottom;
    });
    if (!under) return;
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

  private onDragCancel = (): void => {
    const d = this._drag;
    this.endDragListeners();
    this._drag = undefined;
    if (d?.windowKey && d.windowStart) this._model = ops.moveWindow(this._model, d.windowKey, d.windowStart);
    this.requestUpdate();
  };

  private endDragListeners(): void {
    window.removeEventListener("pointermove", this.onDragMove);
    window.removeEventListener("pointerup", this.onDragEnd);
    window.removeEventListener("pointercancel", this.onDragCancel);
  }

  private startGutter(e: PointerEvent, path: number[], index: number, axis: "row" | "column", win?: string): void {
    if (e.button !== 0) return;
    e.preventDefault();
    const gutter = e.currentTarget as HTMLElement;
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

  private keyGutter(e: KeyboardEvent, path: number[], index: number, node: DockNode, win?: string): void {
    if (node.kind !== "split") return;
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
    "flexdock-beforemove": CustomEvent<{ id: string; target?: string; zone: DropZone | EdgeZone }>;
  }
}
