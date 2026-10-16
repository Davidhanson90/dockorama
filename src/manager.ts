import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { DEFAULT_LABELS, type DockoramaLabels } from "./labels.js";
import { Timeline } from "./history.js";
import { styles } from "./styles.js";
import {
  clampBox, compassSpots, edgeSpots, hit, insertionIndex, previewFor, shareSpace, snapBox, type Rect, type Spot
} from "./geometry.js";
import { DockoramaPart, defineParts, type DockContext, type GuideSpot, type MenuEntry, type PartRequest, type TabMenuItem } from "./components/index.js";
import { slotOf } from "./components/context.js";
import { renderNode } from "./components/tree.js";
import type { Box, Caps, DropZone, EdgeZone, DockoramaModel, LayoutMigrations, LayoutSource, OutsideWindow, Side, SizeLimits, SplitNode, ViewContent, ViewInfo, ViewOptions } from "./model.js";
import * as ops from "./ops.js";
import { LayoutStore } from "./storage.js";
import { activeSkin, cssFor, skinNamed, watchSkins, type Skin, type SkinPatch, type SkinScope } from "./skins/core.js";
import { stateEvents, type BeforeAddDetail, type CommandDetail, type CommandSource, type DragKind, type DragOverDetail, type DropDetail, type DockoramaStateEvents, type ResizeDetail } from "./events.js";

/** Why the model changed (detail of `dockorama-change`). */
export type ChangeReason =
  | "set" | "place" | "edge" | "detach" | "window" | "stow" | "unstow" | "dismiss" | "reveal" | "select"
  | "reorder" | "resize" | "zoom" | "add" | "forget" | "undo" | "redo" | "focus" | "restore" | "cancel"
  | "transfer" | "popout" | "popin" | "pin" | "promote";

/** Every connected manager, for drags between managers that share a `drag-group`. */
const managers = new Set<DockoramaManager>();
/** Built-in keys of the tab context menu. */
export type TabCommand =
  | "close" | "close-others" | "close-right" | "close-all" | "pin" | "float" | "popout" | "split-right" | "split-down" | "stow";

const SILENT: ChangeReason[] = ["select", "focus", "cancel"];
/** Changes after which saved outside windows are (re-)opened. */
const OPEN_ON: ChangeReason[] = ["set", "restore", "undo", "redo"];
/** Styles of the page dockorama builds inside an outside window. */
const OUTSIDE_CSS = `
body.dko { margin: 0; display: flex; flex-direction: column; height: 100vh; font: 13px system-ui, sans-serif; background: #fff; color: #1d2433; }
body.dko[data-theme="dark"] { background: #171b24; color: #e6e9f0; }
.dko-tabs { display: flex; gap: 2px; padding: 4px 6px 0; background: rgba(127,127,127,.12); border-bottom: 1px solid rgba(127,127,127,.25); flex: 0 0 auto; }
.dko-tab { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 6px 6px 0 0; cursor: grab; user-select: none; touch-action: none; }
.dko-tab[aria-selected="true"] { background: inherit; box-shadow: inset 0 2px 0 #4f7cff; }
body.dko .dko-tab[aria-selected="true"] { background: #fff; }
body.dko[data-theme="dark"] .dko-tab[aria-selected="true"] { background: #171b24; }
.dko-back { border: 0; background: none; color: inherit; cursor: pointer; padding: 0 2px; opacity: .6; }
.dko-back:hover { opacity: 1; }
.dko-body { flex: 1 1 auto; min-height: 0; overflow: auto; }
.dko-body > [data-view] { height: 100%; box-sizing: border-box; }
.dko-body > [data-outside-hidden] { display: none !important; }`;
/** Quote a value for an attribute selector. */
const attr = (v: string) => JSON.stringify(v);
const isContent = (v: unknown): v is ViewContent =>
  typeof v === "string" || typeof v === "function" || (typeof Element !== "undefined" && v instanceof Element);

/** Plain-text view body: never HTML, padded via `.dockorama-text` / `--dk-text-padding`. */
const textNode = (text: string): HTMLElement => {
  const el = document.createElement("div");
  el.className = "dockorama-text";
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
  /** Last spot reported through `dockorama-dragover`. */
  over?: string;
  /** Model when the drag started (restored by Escape). */
  origin: DockoramaModel;
  preview?: Rect;
  pointerId: number;
  /** Capabilities of the dragged view (set when another manager is the drop target). */
  caps?: Caps;
  /** Another manager in the same drag group under the pointer. */
  peer?: DockoramaManager;
  /** The pointer left the browser window (dropping pops the view out). */
  beyond?: boolean;
  sx?: number;
  sy?: number;
}

/**
 * `<dockorama-manager>`: a docking layout of views (panels and documents) the user can rearrange.
 * Content is light DOM: give each child `data-view="<id>"` matching an id in `model.views`.
 */
export class DockoramaManager extends LitElement {
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
    dragGroup: { attribute: "drag-group", reflect: true },
    tabMenu: { attribute: false },
    confirmClose: { attribute: false },
    layoutVersion: { type: Number, attribute: "layout-version" },
    migrations: { attribute: false },
    retain: { reflect: true },
    skin: { converter: { fromAttribute: (v: string | null) => v ?? undefined, toAttribute: (v: unknown) => (typeof v === "string" ? v : (v as Skin | undefined)?.name) } },
    skinPatch: { attribute: false },
    _confirm: { state: true },
    _keyMove: { state: true },
    _peek: { state: true },
    _drag: { state: true },
    _menu: { state: true },
    _palette: { state: true },
    _say: { state: true },
    _guest: { state: true },
    _tabMenu: { state: true },
    _blocked: { state: true }
  };

  /**
   * This dock's skin: a skin object or the name of a registered one (attribute `skin`). When unset the
   * page-wide skin (`useSkin`) is used.
   */
  skin?: Skin | string;
  /** Template and/or CSS overrides for this dock only, layered over its skin and any page-wide overrides. */
  skinPatch?: SkinPatch;
  private unwatchSkins?: () => void;
  private skinStyle?: HTMLStyleElement;
  private skinSheet?: CSSStyleSheet;

  /** @internal What this dock's UI parts render with. */
  skinScope(): SkinScope {
    const skin = typeof this.skin === "string" ? skinNamed(this.skin) : this.skin;
    return { ...(skin ? { skin } : {}), ...(this.skinPatch ? { patch: this.skinPatch } : {}) };
  }

  /** Apply skin CSS after the built-in styles and re-render every part. */
  private applySkin(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const cssText = cssFor(this.skinScope());
    const canAdopt = "adoptedStyleSheets" in root && typeof CSSStyleSheet !== "undefined" && "replaceSync" in CSSStyleSheet.prototype;
    if (canAdopt) {
      if (!this.skinSheet) {
        this.skinSheet = new CSSStyleSheet();
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, this.skinSheet];
      }
      this.skinSheet.replaceSync(cssText);
    } else {
      if (!this.skinStyle) {
        this.skinStyle = document.createElement("style");
        this.skinStyle.dataset["skin"] = "";
        root.append(this.skinStyle);
      }
      this.skinStyle.textContent = cssText;
    }
    this.dataset["skinName"] = (this.skinScope().skin ?? activeSkin()).name;
    for (const el of Array.from(root.querySelectorAll("*"))) if (el instanceof DockoramaPart) el.requestUpdate();
    this.requestUpdate();
  }

  /** `light` (default), `dark` or `auto` (follows the OS). */
  theme: "light" | "dark" | "auto" = "light";
  /** Grid size in px that floating windows snap to (0 = off). */
  snap = 0;
  /** When set, the layout is saved to localStorage under this key and restored on load. */
  storageKey?: string;
  /** Keep empty groups instead of removing them. */
  keepEmpty = false;
  /** Partial overrides of user-facing strings. */
  labels: Partial<DockoramaLabels> = {};
  /**
   * Managers with the same non-empty `drag-group` accept views dragged from each other. Unset (default):
   * views stay in this manager.
   */
  dragGroup?: string;
  /**
   * Customise the tab context menu: receives the view id and the built-in items, returns the items to show.
   * Add your own `{ key, label, run }` entries, remove or relabel built-ins.
   */
  tabMenu?: (viewId: string, items: TabMenuItem[]) => TabMenuItem[];
  /**
   * Asked before a view with unsaved changes (see `setDirty`) closes. Return or resolve `true` to close.
   * Unset: dockorama shows its own `<dockorama-confirm>` dialog.
   */
  confirmClose?: (viewId: string) => boolean | Promise<boolean>;
  /**
   * Your app's current layout version. Models from storage or `restore()` with a lower `version` are upgraded with
   * `migrations` first; models you assign without a `version` are taken as current. Set it (and `migrations`) before `model`.
   */
  layoutVersion?: number;
  /** Upgrade steps: `migrations[n]` turns a version-`n` layout into version `n + 1`. */
  migrations?: LayoutMigrations;
  /**
   * What happens to the content of hidden views: `"all"` (default) keeps every view's element attached;
   * `"active"` detaches the content of views that are not on screen (background tabs, collapsed drawers)
   * and re-attaches it when shown, so only visible contents take part in layout and rendering.
   * Views added with `keepAlive: true` stay attached either way.
   */
  retain: "all" | "active" = "all";
  /** Detached content of hidden views (with `retain="active"`). */
  private readonly stash = new Map<string, Element>();

  private _model: DockoramaModel = ops.emptyModel();
  private readonly store = new LayoutStore(this, (source, problems, fatal) =>
    this.emit("dockorama-layoutissue", { source, problems, fatal }));
  private readonly timeline = new Timeline<DockoramaModel>();
  private _peek?: string;
  private _drag?: DragState;
  private _menu?: { id: string; x: number; y: number };
  private _palette?: { query: string; index: number };
  private _say = "";
  /** Open outside (browser) windows by key. */
  private readonly outsideWins = new Map<string, Window>();
  /** Windows dockorama is closing itself (their pagehide is not a user close). */
  private readonly closing = new WeakSet<Window>();
  private unloading = false;
  /** Drag from another manager hovering over this one. */
  private _guest?: DragState;
  private _tabMenu?: { id: string; x: number; y: number; items: TabMenuItem[] };
  /** Outside windows the browser would not re-open. */
  private _blocked: string[] = [];
  private readonly dirtySet = new Set<string>();
  private _confirm?: { id: string; done: (ok: boolean) => void };
  /** Keyboard docking in progress: the view, the chosen target (index into `moveTargets()`) and side. */
  private _keyMove?: { id: string; index: number; zone: DropZone | EdgeZone };
  private readonly shown = new Set<string>();
  /** Views whose content slot was on screen after the last render (for `dockorama-viewshow` / `dockorama-viewhide`). */
  private visible = new Set<string>();
  private readonly factories = new Map<string, () => Element>();
  private observer?: MutationObserver;
  private restoredFromStorage = false;

  /** The current layout model (immutable; assign a new object to change it). */
  get model(): DockoramaModel {
    return this._model;
  }
  set model(value: DockoramaModel) {
    const stamped = this.layoutVersion !== undefined && value && value.version === undefined ? { ...value, version: this.layoutVersion } : value;
    const next = this.store.prepare(stamped, "set") ?? ops.normalize(value);
    const fromStore = this.store.load(next);
    this.restoredFromStorage = Boolean(fromStore);
    this.timeline.clear();
    this.commit(fromStore ?? next, "set", false);
  }

  private get t(): DockoramaLabels {
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
    this.addEventListener("input", this.onInput);
    this.renderRoot.addEventListener("dockorama-request", this.onRequest);
    document.addEventListener("pointerdown", this.onOutside, true);
    window.addEventListener("pagehide", this.onUnload);
    managers.add(this);
    this.unwatchSkins = watchSkins(() => this.applySkin());
    // Direction comes from CSS (usually a `dir` attribute on this element or an ancestor): re-render when it changes.
    this.lastDir = getComputedStyle(this).direction;
    this.dirObserver = new MutationObserver(() => {
      const now = getComputedStyle(this).direction;
      if (now !== this.lastDir) {
        this.lastDir = now;
        this.requestUpdate();
      }
    });
    this.dirObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["dir", "lang"], subtree: true });
    this.reconcileOutside(true);
  }

  private dirObserver?: MutationObserver;
  private lastDir = "ltr";

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.dirObserver?.disconnect();
    this.removeEventListener("keydown", this.onKey);
    this.removeEventListener("input", this.onInput);
    this.renderRoot.removeEventListener("dockorama-request", this.onRequest);
    document.removeEventListener("pointerdown", this.onOutside, true);
    window.removeEventListener("pagehide", this.onUnload);
    managers.delete(this);
    this.unwatchSkins?.();
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
    if (!this.emitBefore("dockorama-beforemove", { id, zone })) return;
    this.commit(ops.placeAtEdge(this._model, id, zone), "edge");
  }
  /** Insert a view as a new group between child `after` and `after + 1` of the split at `path`. */
  dropBetween(id: string, path: number[], after: number, windowKey?: string): void {
    if (this.caps(id).move === false || this.caps(id).docsOnly) return;
    if (!this.emitBefore("dockorama-beforemove", { id, zone: "between" })) return;
    this.commit(ops.insertBetween(this._model, id, path, after, windowKey), "place");
  }
  /** Put a view into an empty document area. */
  dropIntoDocs(id: string, path: number[], windowKey?: string): void {
    if (this.caps(id).move === false) return;
    if (!this.emitBefore("dockorama-beforemove", { id, zone: "into" })) return;
    this.commit(ops.fillDocs(this._model, id, path, windowKey), "place");
  }
  /** Float a view in its own window. */
  detach(id: string, box?: Box): void {
    if (this.caps(id).float === false || this.caps(id).docsOnly) return;
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
  /** Close a view (cancellable through `dockorama-beforeclose`). It stays registered. */
  dismiss(id: string): Promise<boolean> {
    if (this.caps(id).dismiss === false) return Promise.resolve(false);
    const place = ops.locate(this._model, id).place;
    if (place === "parked" || place === "nowhere") return Promise.resolve(false);
    if (!this.emitBefore("dockorama-beforeclose", { id })) return Promise.resolve(false);
    if (!this.dirtySet.has(id)) {
      this.close(id);
      return Promise.resolve(true);
    }
    return this.askClose(id).then((ok) => {
      if (ok) this.close(id);
      return ok;
    });
  }

  private close(id: string): void {
    if (this._peek === id) this._peek = undefined;
    if (this.dirtySet.has(id)) this.setDirty(id, false);
    const before = this._model;
    const hadFocus = before.focus === id;
    this.commit(ops.dismiss(this._model, id), "dismiss");
    if (before !== this._model) this.emit("dockorama-close", { id });
    // The focused view closed: keep model focus and DOM focus together on the view that took its place.
    const next = this._model.focus;
    if (hadFocus && next && next !== id) {
      void this.updateComplete.then(() => {
        const root = this.renderRoot;
        const el = root.querySelector<HTMLElement>(`[id=${attr(`tab-${next}`)}]`) ?? root.querySelector<HTMLElement>(`[data-stack="${next}"]`);
        el?.focus({ preventScroll: true });
      });
    }
  }

  /** Ask `confirmClose`, or show the built-in dialog, before a dirty view closes. */
  private askClose(id: string): Promise<boolean> {
    if (this.confirmClose) {
      try {
        return Promise.resolve(this.confirmClose(id)).then(Boolean, () => false);
      } catch {
        return Promise.resolve(false);
      }
    }
    this._confirm?.done(false);
    return new Promise<boolean>((done) => {
      this._confirm = { id, done };
      void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement & { focusSafe(): void }>("dockorama-confirm")?.focusSafe());
    });
  }

  /** Mark a view as having unsaved changes (or not). A dirty preview tab is promoted. Fires `dockorama-dirty`. */
  setDirty(id: string, dirty = true): void {
    if (this.dirtySet.has(id) === dirty) return;
    if (dirty) this.dirtySet.add(id);
    else this.dirtySet.delete(id);
    if (dirty) this.promote(id);
    this.dispatchEvent(new CustomEvent("dockorama-dirty", { detail: { id, dirty }, bubbles: true, composed: true }));
    this.requestUpdate();
  }
  /** Whether a view has unsaved changes. */
  isDirty(id: string): boolean {
    return this.dirtySet.has(id);
  }
  /** Ids of every view with unsaved changes. */
  get dirtyViews(): string[] {
    return [...this.dirtySet];
  }

  /** Show a registered view as its group's preview tab (replacing the current preview there). */
  showPreview(id: string): void {
    if (!this.hasView(id)) return;
    const where = ops.locate(this._model, id);
    if (where.place === "tree" && !where.stack.preview) return this.reveal(id);
    const shown = where.place === "tree" ? ops.select(this._model, id) : ops.reveal(this._model, id);
    this.commit(ops.setPreview(shown, id).model, where.place === "tree" ? "select" : "reveal");
  }
  /** Keep a preview tab: it stops being replaced. Also happens on double-click, typing in it, or `setDirty`. */
  promote(id: string): void {
    const next = ops.promote(this._model, id);
    if (next !== this._model) this.commit(next, "promote");
  }
  /**
   * Close several views as one undoable change. Each one still asks `dockorama-beforeclose` and respects
   * `caps.dismiss`; vetoed views stay. Returns the ids that were closed.
   */
  dismissMany(ids: string[]): string[] {
    const done: string[] = [];
    const later: string[] = [];
    let m = this._model;
    for (const id of ids) {
      if (this.dirtySet.has(id)) {
        later.push(id);
        continue;
      }
      if (this.caps(id).dismiss === false || !this.emitBefore("dockorama-beforeclose", { id })) continue;
      m = ops.dismiss(m, id);
      done.push(id);
    }
    if (done.length) {
      this.commit(m, "dismiss");
      for (const id of done) this.emit("dockorama-close", { id });
    }
    // Views with unsaved changes ask one at a time.
    void later.reduce((p, id) => p.then(() => this.dismiss(id)), Promise.resolve(true));
    return done;
  }
  /** Pin (default) or unpin a tab: pinned tabs stay first in their group, compact, and survive "close others/all". */
  pin(id: string, on = true): void {
    const next = ops.pin(this._model, id, on);
    if (next !== this._model) this.commit(next, "pin");
  }
  /** True when a view is pinned in its group. */
  hasPin(id: string): boolean {
    const where = ops.locate(this._model, id);
    return where.place === "tree" && Boolean(where.stack.pinned?.includes(id));
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
   * (`dockorama-change` reason `"add"`).
   *
   * `content` is an element, a string (wrapped in a padded `.dockorama-text` div), or a factory called the first time the view is
   * shown. `options.at` says where it goes (see `ViewSpot`); the default is the document area, else
   * the right edge. Throws if `id` is already registered or the `near` target is not in the layout.
   */
  addView(id: string, content: ViewContent, options?: ViewOptions): void;
  /** Register a view whose `data-view` content is already (or will be) a child, and show it. */
  addView(id: string, info: ViewInfo, near?: { view: string; zone: DropZone }): void;
  addView(id: string, content: ViewContent | ViewInfo, extra?: ViewOptions | { view: string; zone: DropZone }): void {
    const spot0 = isContent(content) ? ((extra ?? {}) as ViewOptions).at : undefined;
    const title = isContent(content) ? (((extra ?? {}) as ViewOptions).title ?? id) : content.title;
    const ask: BeforeAddDetail = spot0 === undefined ? { id, title } : { id, title, at: spot0 };
    if (!this.emit("dockorama-beforeadd", ask, true)) return;
    if (!isContent(content)) {
      this.commit(ops.addView(this._model, id, content, extra as { view: string; zone: DropZone } | undefined), "add");
      return;
    }
    const { at = "auto", preview, ...rest } = (extra ?? {}) as ViewOptions;
    const info: ViewInfo = { ...rest, title: rest.title ?? id };
    if (typeof content === "function") info.lazy = true;
    const spot = typeof at === "object" && "float" in at ? { float: this.fitBox({ ...this.defaultBox(), ...(at.float === true ? {} : at.float) }) } : at;
    let next = ops.enlist(this._model, id, info, spot);
    if (preview) next = ops.setPreview(next, id).model;
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
    const el = this.getViewElement(id);
    this.factories.delete(id);
    this.shown.delete(id);
    if (id in this._model.views) this.commit(ops.forget(this._model, id), "forget");
    this.stash.delete(id);
    if (el && !options.keepElement) el.remove();
    return el;
  }
  /** The content element of a view (null if unknown, or lazy and not yet shown). */
  getViewElement(id: string): Element | null {
    for (const win of this.outsideWins.values()) {
      const el = win.closed ? null : win.document.querySelector(`.dko-body > [data-view=${attr(id)}]`);
      if (el) return el;
    }
    return this.querySelector(`:scope > [data-view=${attr(id)}]`) ?? this.stash.get(id) ?? null;
  }

  /** True when view `id` has content that is currently detached because of `retain="active"`. */
  isRetained(id: string): boolean {
    return this.stash.has(id);
  }
  /** True when a view with this id is registered (wherever it is, including parked). */
  hasView(id: string): boolean {
    return Object.prototype.hasOwnProperty.call(this._model.views, id);
  }
  /** Remove a view from the model entirely. */
  forget(id: string): void {
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
  snapshot(): DockoramaModel {
    return ops.copy(this._model);
  }
  /** Restore a snapshot as an undoable change. */
  restore(model: DockoramaModel): void {
    const next = this.store.prepare(model, "restore");
    if (!next) throw new TypeError("dockorama: not a usable layout model (see dockorama-layoutissue)");
    this.commit(next, "restore");
  }
  /** Open the "go to view" palette. */
  openPalette(): void {
    this._palette = { query: "", index: 0 };
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLInputElement>(".palette input")?.focus());
  }
  /**
   * Open a view's content in a separate browser window (or, with `into`, in an existing one). The view keeps its
   * place in the layout, and the window is saved in the model (`outside`) and re-opened on load.
   * `box` is the window's screen position / size. Returns false when not allowed or the browser blocked it.
   */
  popOut(id: string, options: { into?: string; box?: Partial<Box> } = {}): boolean {
    if (this.caps(id).popout === false || ops.locate(this._model, id).place !== "tree") return false;
    const cur = ops.outsideOf(this._model, id);
    if (cur && (!options.into || cur.key === options.into)) return false;
    if (!this.getViewElement(id) && !this.factories.has(id)) return false;
    const live = options.into ? this.outsideWins.get(options.into) : undefined;
    let key = options.into;
    let box: Box | undefined;
    if (!live || live.closed) {
      key = `o-${id}-${Date.now().toString(36)}`;
      box = { x: options.box?.x ?? NaN, y: options.box?.y ?? NaN, w: options.box?.w ?? 640, h: options.box?.h ?? 480 };
      if (!this.openOutside(key, box)) return false;
      if (Number.isNaN(box.x)) box = undefined;
    }
    this.commit(ops.goOutside(this._model, id, key!, box), "popout");
    return true;
  }
  /** Move popped-out content back into the layout. */
  popIn(id: string): void {
    const next = ops.comeInside(this._model, id);
    if (next !== this._model) this.commit(next, "popin");
  }
  /** Keys of outside windows saved in the model that the browser refused to open (see the re-open notice). */
  get blockedWindows(): string[] {
    return [...this._blocked];
  }
  /** Try again to open saved outside windows (call from a click: browsers only allow pop-ups on user input). */
  reopenWindows(): void {
    this.reconcileOutside(true);
  }
  /** Give up on blocked outside windows: their views show in the layout again (undoable). */
  keepWindowsDocked(): void {
    const keys = new Set(this._blocked);
    const m = ops.copy(this._model);
    m.outside = (m.outside ?? []).filter((o) => !keys.has(o.key));
    this.commit(ops.normalize(m), "popin");
  }

  // ------------------------------------------------------------- outside windows

  private openOutside(key: string, box?: Box): Window | null {
    const pos = box && !Number.isNaN(box.x) ? `,left=${Math.round(box.x)},top=${Math.round(box.y)}` : "";
    const size = box ? `,width=${Math.round(box.w)},height=${Math.round(box.h)}` : ",width=640,height=480";
    let win: Window | null = null;
    try {
      win = window.open("", `dockorama-${key}`, `popup${size}${pos}`) ?? null;
    } catch {
      win = null;
    }
    if (!win) return null;
    this.prepareOutside(win, key);
    this.outsideWins.set(key, win);
    return win;
  }

  /** Build the outside window's page: a tab bar and a body that holds the content elements. */
  private prepareOutside(win: Window, key: string): void {
    const doc = win.document;
    doc.head.replaceChildren();
    doc.body.replaceChildren();
    for (const node of Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))) doc.head.append(node.cloneNode(true));
    const style = doc.createElement("style");
    style.textContent = OUTSIDE_CSS;
    doc.head.append(style);
    doc.body.className = "dko";
    doc.body.dataset["theme"] = this.theme;
    const tabs = doc.createElement("div");
    tabs.className = "dko-tabs";
    tabs.setAttribute("role", "tablist");
    const body = doc.createElement("div");
    body.className = "dko-body";
    doc.body.append(tabs, body);
    win.addEventListener("pagehide", () => {
      if (this.closing.has(win) || this.unloading) return;
      // The user closed the window: bring its views back.
      this.outsideWins.delete(key);
      const o = this._model.outside?.find((x) => x.key === key);
      if (!o) return;
      let m = this._model;
      for (const v of o.views) m = ops.comeInside(m, v);
      this.adoptHome(win);
      this.commit(m, "popin");
    });
    let t: ReturnType<typeof setTimeout> | undefined;
    win.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(() => this.noteBox(key, win), 250);
    });
  }

  /** Record an outside window's screen box without an undo step or change event. */
  private noteBox(key: string, win: Window): void {
    if (win.closed || !this._model.outside?.some((o) => o.key === key)) return;
    this._model = ops.tuneOutside(this._model, key, { box: { x: win.screenX, y: win.screenY, w: win.outerWidth, h: win.outerHeight } });
    this.store.save(this._model);
  }

  private readonly onUnload = (): void => {
    for (const [key, win] of this.outsideWins) this.noteBox(key, win);
    this.unloading = true;
    for (const win of this.outsideWins.values()) if (!win.closed) win.close();
    this.outsideWins.clear();
  };

  /** Move every content element in an outside window back into the manager. */
  private adoptHome(win: Window): void {
    if (win.closed && !win.document) return;
    for (const el of Array.from(win.document.querySelectorAll<HTMLElement>(".dko-body > [data-view]"))) {
      el.removeAttribute("data-outside-hidden");
      this.append(el);
    }
  }

  /** Make open outside windows match `model.outside`; optionally try to open missing ones. */
  private reconcileOutside(allowOpen: boolean): void {
    const want = this._model.outside ?? [];
    if (!want.length && !this.outsideWins.size && !this._blocked.length) return;
    for (const [key, win] of Array.from(this.outsideWins)) {
      if (want.some((o) => o.key === key) && !win.closed) continue;
      this.outsideWins.delete(key);
      if (!win.closed) {
        this.adoptHome(win);
        this.closing.add(win);
        win.close();
      }
    }
    const blocked: string[] = [];
    for (const o of want) {
      let win = this.outsideWins.get(o.key);
      if (!win && allowOpen && this.isConnected) win = this.openOutside(o.key, o.box) ?? undefined;
      if (!win) {
        blocked.push(o.key);
        continue;
      }
      this.paintOutside(o, win);
    }
    this._blocked = blocked;
  }

  /** Put the right content into an outside window and redraw its tab bar. */
  private paintOutside(o: OutsideWindow, win: Window): void {
    const doc = win.document;
    const body = doc.querySelector<HTMLElement>(".dko-body");
    const tabs = doc.querySelector<HTMLElement>(".dko-tabs");
    if (!body || !tabs) return;
    for (const el of Array.from(body.querySelectorAll<HTMLElement>(":scope > [data-view]"))) {
      if (!o.views.includes(el.dataset["view"] ?? "")) {
        el.removeAttribute("data-outside-hidden");
        this.append(el);
      }
    }
    for (const id of o.views) {
      let el = this.getViewElement(id) as HTMLElement | null;
      const make = this.factories.get(id);
      if (!el && make) {
        this.factories.delete(id);
        el = make() as HTMLElement;
        el.setAttribute("data-view", id);
      }
      if (!el) continue;
      this.stash.delete(id);
      if (el.parentNode !== body) body.append(el);
      el.toggleAttribute("data-outside-hidden", id !== o.current);
    }
    doc.title = o.views.map((v) => this._model.views[v]?.title ?? v).join(" · ");
    tabs.replaceChildren(...o.views.map((id) => {
      const tab = doc.createElement("div");
      tab.className = "dko-tab";
      tab.setAttribute("role", "tab");
      tab.dataset["view"] = id;
      tab.tabIndex = 0;
      tab.setAttribute("aria-selected", String(id === o.current));
      const label = doc.createElement("span");
      label.textContent = this._model.views[id]?.title ?? id;
      const back = doc.createElement("button");
      back.className = "dko-back";
      back.type = "button";
      back.title = this.t.popin;
      back.setAttribute("aria-label", `${this.t.popin} ${label.textContent}`);
      back.textContent = "\u2199";
      back.addEventListener("pointerdown", (e) => e.stopPropagation());
      back.addEventListener("click", () => this.popIn(id));
      tab.append(label, back);
      tab.addEventListener("click", () => this.commit(ops.tuneOutside(this._model, o.key, { current: id }), "select"));
      tab.addEventListener("pointerdown", (e) => this.startOutsideDrag(e, o.key, id, win));
      return tab;
    }));
  }

  /** Opener-window client coordinates of a screen point (approximate: browsers do not expose the frame size). */
  private toClient(sx: number, sy: number): { x: number; y: number } {
    const bx = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
    const by = Math.max(0, window.outerHeight - window.innerHeight - bx);
    return { x: sx - window.screenX - bx, y: sy - window.screenY - by };
  }

  /** The open outside window whose screen rectangle contains a screen point. */
  private outsideAt(sx: number, sy: number, except?: string): string | undefined {
    for (const [key, w] of this.outsideWins) {
      if (key === except || w.closed) continue;
      if (sx >= w.screenX && sx <= w.screenX + w.outerWidth && sy >= w.screenY && sy <= w.screenY + w.outerHeight) return key;
    }
    return undefined;
  }

  /** Drag a tab out of an outside window: into another one, or back onto the layout (with drop guides). */
  private startOutsideDrag(e: PointerEvent, key: string, id: string, win: Window): void {
    if (e.button !== 0) return;
    const sx0 = e.screenX;
    const sy0 = e.screenY;
    let moved = false;
    const inside = (ev: PointerEvent) => ev.clientX >= 0 && ev.clientY >= 0 && ev.clientX <= win.innerWidth && ev.clientY <= win.innerHeight;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.screenX - sx0, ev.screenY - sy0) < 6) return;
      moved = true;
      if (inside(ev)) {
        this.clearGuest();
        return;
      }
      const p = this.toClient(ev.screenX, ev.screenY);
      this.hoverAt(id, p.x, p.y);
    };
    const up = (ev: PointerEvent) => {
      win.removeEventListener("pointermove", move);
      win.removeEventListener("pointerup", up);
      const g = this._guest;
      this.clearGuest();
      if (!moved || inside(ev)) return;
      const into = this.outsideAt(ev.screenX, ev.screenY, key);
      if (into) {
        this.popOut(id, { into });
        return;
      }
      const placed = g ? this.applyDrop(ops.comeInside(this._model, id), id, g) : undefined;
      this.commit(placed ?? ops.comeInside(this._model, id), placed ? "place" : "popin");
    };
    win.addEventListener("pointermove", move);
    win.addEventListener("pointerup", up);
  }

  /** Show drop guides for a view at a client point of this manager (used by drags that started elsewhere). */
  private hoverAt(id: string, x: number, y: number, caps?: Caps): void {
    const g: DragState = { id, mode: "loose", startX: x, startY: y, x, y, origin: this._model, pointerId: -1, caps };
    this.findTarget(g);
    this._guest = g;
  }

  private clearGuest(): void {
    if (this._guest) this._guest = undefined;
  }

  /** Apply the drop a drag state points at to `model` (pure); undefined when it points nowhere. */
  private applyDrop(model: DockoramaModel, id: string, d: DragState): DockoramaModel | undefined {
    if (d.edge) return ops.placeAtEdge(model, id, d.edge);
    if (d.gap) return ops.insertBetween(model, id, d.gap.path, d.gap.after, d.gap.win);
    if (d.fill && d.target?.zone) return ops.fillDocs(model, id, d.fill.path, d.fill.win);
    if (d.target?.zone) return ops.place(model, id, d.target.view, d.target.zone);
    return undefined;
  }

  // ------------------------------------------------------------- drag between managers

  /** Another manager in the same drag group whose box contains a client point (not this one). */
  private peerAt(x: number, y: number): DockoramaManager | undefined {
    if (!this.dragGroup) return undefined;
    const own = this.getBoundingClientRect();
    if (x >= own.left && x <= own.right && y >= own.top && y <= own.bottom) return undefined;
    for (const m of managers) {
      if (m === this || m.dragGroup !== this.dragGroup || !m.isConnected) continue;
      const r = m.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return m;
    }
    return undefined;
  }

  /**
   * Move a view, with its content element, from this manager to another one: `at` is any `ViewSpot`
   * (default `"auto"`). One undoable change in each manager (reason `"transfer"`), and a
   * `dockorama-transfer` event on both. Throws if the target already has a view with this id.
   */
  transferView(id: string, target: DockoramaManager, at: import("./model.js").ViewSpot = "auto"): void {
    const info = this._model.views[id];
    if (!info || target === this) return;
    if (target.hasView(id)) throw new Error(`dockorama: the target already has a view with id "${id}"`);
    const spot = typeof at === "object" && "float" in at ? { float: target.fitBox({ ...target.defaultBox(), ...(at.float === true ? {} : at.float) }) } : at;
    const next = ops.enlist(target._model, id, ops.copy(info), spot);
    this.handOver(id, target, next);
  }

  private handOver(id: string, target: DockoramaManager, next: DockoramaModel): void {
    const el = this.getViewElement(id);
    this.stash.delete(id);
    const make = this.factories.get(id);
    this.factories.delete(id);
    this.shown.delete(id);
    if (this._peek === id) this._peek = undefined;
    this.commit(ops.forget(this._model, id), "transfer");
    if (make) target.factories.set(id, make);
    if (el) target.mount(id, el);
    target.shown.delete(id);
    target.commit(next, "transfer");
    const detail = { id, from: this, to: target };
    this.dispatchEvent(new CustomEvent("dockorama-transfer", { detail: { ...detail, direction: "out" }, bubbles: true, composed: true }));
    target.dispatchEvent(new CustomEvent("dockorama-transfer", { detail: { ...detail, direction: "in" }, bubbles: true, composed: true }));
  }

  /** Drop a view dragged from `source` where this manager's guide points. Returns false when it cannot land. */
  private takeGuest(source: DockoramaManager, id: string): boolean {
    const g = this._guest;
    this._guest = undefined;
    const info = source._model.views[id];
    if (!g || !info || this.hasView(id)) return false;
    if (!this.emitBefore("dockorama-beforemove", { id, target: g.target?.view, zone: g.edge ?? (g.gap ? "between" : g.target?.zone ?? "into"), from: source })) return false;
    const base = ops.adopt(this._model, id, info);
    const next = this.applyDrop(base, id, g) ?? (this._model.root ? undefined : ops.reveal(base, id));
    if (!next) return false;
    source.handOver(id, this, next);
    return true;
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
    return this.emitBefore("dockorama-beforemove", { id, target, zone });
  }

  /** Fire a public event (bubbles, composed). Returns false when a cancellable one was vetoed. */
  private emit(type: string, detail: unknown, cancelable = false): boolean {
    return this.dispatchEvent(new CustomEvent(type, { detail, cancelable, bubbles: true, composed: true }));
  }

  private emitBefore(type: string, detail: unknown): boolean {
    return this.dispatchEvent(new CustomEvent(type, { detail, cancelable: true, bubbles: true, composed: true }));
  }

  private keepFocus = false;

  /** Whether focus is inside the component (shadow or light DOM). */
  private hasFocus(): boolean {
    return Boolean(this.shadowRoot?.activeElement) || (document.activeElement !== this && this.contains(document.activeElement));
  }

  private commit(next: DockoramaModel, reason: ChangeReason, record = true): void {
    const prev = this._model;
    this.keepFocus = this.keepFocus || this.hasFocus();
    if (record && next !== prev && !SILENT.includes(reason)) this.timeline.push(prev);
    this._model = next;
    if (reason !== "set") this.store.save(this._model);
    this.reconcileOutside(OPEN_ON.includes(reason));
    if (prev.focus !== next.focus && next.focus) {
      this.dispatchEvent(new CustomEvent("dockorama-focus", { detail: { id: next.focus, previous: prev.focus }, bubbles: true, composed: true }));
    }
    if (reason !== "focus") {
      this.dispatchEvent(new CustomEvent("dockorama-change", { detail: { model: next, reason }, bubbles: true, composed: true }));
    }
    if (reason !== "set") for (const ev of stateEvents(prev, next)) this.emit(ev.type, ev.detail);
    if (!SILENT.includes(reason) && reason !== "set") this._say = `${reason}`;
    this.requestUpdate();
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
      if (el instanceof DockoramaPart) done = (await el.updateComplete) && done;
    }
    return done;
  }

  protected override updated(changed: PropertyValues): void {
    this.toggleAttribute("data-moving", Boolean(this._keyMove));
    super.updated(changed);
    if (changed.has("skin") || changed.has("skinPatch") || !this.skinStyle && !this.skinSheet) this.applySkin();
    if (changed.has("storageKey") && this.storageKey && !this.restoredFromStorage) {
      const stored = this.store.load(this._model);
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
      if (el instanceof DockoramaPart) await el.updateComplete;
    }
    if (this.keepFocus) {
      this.keepFocus = false;
      if (!this.hasFocus() && !this._palette && !this._menu) {
        const active = this.renderRoot.querySelector<HTMLElement>("[data-stack][data-active]");
        (active?.querySelector<HTMLElement>('.tab[data-selected]') ?? active)?.focus({ preventScroll: true });
      }
    }
    const now = new Set<string>();
    for (const slot of Array.from(this.renderRoot.querySelectorAll<HTMLSlotElement>("slot[name]"))) {
      const id = slot.name.slice(2);
      now.add(id);
      if (this.visible.has(id)) continue;
      const first = !this.shown.has(id);
      if (first) {
        this.shown.add(id);
        const make = this.factories.get(id);
        if (make) {
          this.factories.delete(id);
          this.mount(id, make());
        }
      }
      this.emit("dockorama-viewshow", { id, first });
    }
    for (const id of this.visible) if (!now.has(id)) this.emit("dockorama-viewhide", { id });
    this.visible = now;
    this.applyRetain();
  }

  /** Detach hidden contents / re-attach shown ones according to `retain`. */
  private applyRetain(): void {
    const visible = new Set(Array.from(this.renderRoot.querySelectorAll<HTMLSlotElement>("slot[name]")).map((s) => s.name.slice(2)));
    const active = this.retain === "active";
    for (const [id, el] of Array.from(this.stash)) {
      if (!active || visible.has(id) || !(id in this._model.views) || this._model.views[id]?.keepAlive) {
        this.stash.delete(id);
        this.append(el);
      }
    }
    if (!active) return;
    for (const el of Array.from(this.querySelectorAll(":scope > [data-view]"))) {
      const id = el.getAttribute("data-view")!;
      if (visible.has(id) || this._model.views[id]?.keepAlive || !(id in this._model.views)) continue;
      this.stash.set(id, el);
      el.remove();
    }
  }

  // ------------------------------------------------------------- rendering

  private context(): DockContext {
    const g = this._drag?.gap;
    return {
      model: this._model,
      labels: this.t,
      popped: new Set((this._model.outside ?? []).flatMap((o) => o.views)),
      gap: g ? { path: g.path.join("."), after: g.after, win: g.win ?? "" } : undefined,
      dragging: Boolean(this._drag),
      dirty: new Set(this.dirtySet)
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
      ? html`<dockorama-rail .side=${side} .views=${m.drawers[side]} .open=${this._peek} .ctx=${ctx}></dockorama-rail>`
      : nothing;
    return html`<div class="frame" part="frame" dir=${getComputedStyle(this).direction || "ltr"}>
      ${rail("top")}
      <div class="middle">
        ${rail("start")}
        <div class="main" part="main">${body}${this.renderFlyout(ctx)}</div>
        ${rail("end")}
      </div>
      ${rail("bottom")}
      ${m.windows.map((w, i) => html`<dockorama-window .key=${w.key} .box=${w.box} .tree=${w.tree} .layer=${i} .ctx=${ctx}></dockorama-window>`)}
      ${this.renderGuide()}
      ${this.renderMenu()}
      ${this.renderTabMenu()}
      ${this.renderPalette()}
      ${this.renderNotice()}
      ${this.renderConfirm()}
      <div class="sr" role="status" aria-live="polite">${this._say}</div>
    </div>`;
  }

  private renderFlyout(ctx: DockContext): TemplateResult | typeof nothing {
    const id = this._peek;
    if (!id) return nothing;
    const where = ops.locate(this._model, id);
    if (where.place !== "drawer") return nothing;
    return html`<dockorama-flyout .view=${id} .side=${where.side} .ctx=${ctx}></dockorama-flyout>`;
  }

  private renderConfirm(): TemplateResult | typeof nothing {
    const c = this._confirm;
    if (!c) return nothing;
    const t = this.t;
    const title = this._model.views[c.id]?.title ?? c.id;
    return html`<dockorama-confirm .view=${c.id} .message=${t.confirmClose.replace("{title}", title)} .okLabel=${t.closeAnyway} .cancelLabel=${t.cancel}></dockorama-confirm>`;
  }

  private renderNotice(): TemplateResult | typeof nothing {
    if (!this._blocked.length) return nothing;
    const t = this.t;
    return html`<dockorama-notice .message=${t.reopenBlocked}
      .actions=${[{ label: t.reopen, action: "outside-reopen", primary: true }, { label: t.keepDocked, action: "outside-dismiss" }]}></dockorama-notice>`;
  }

  private renderTabMenu(): TemplateResult | typeof nothing {
    const m = this._tabMenu;
    if (!m) return nothing;
    return html`<dockorama-tab-menu .view=${m.id} .items=${m.items} .x=${m.x} .y=${m.y} .label=${this.t.tabMenu}></dockorama-tab-menu>`;
  }

  /** The built-in tab context menu items for a view (before the `tabMenu` hook). */
  tabMenuItems(id: string): TabMenuItem[] {
    const c = this.caps(id);
    const t = this.t;
    const where = ops.locate(this._model, id);
    const s = where.place === "tree" ? where.stack : undefined;
    const views = s?.views ?? [];
    const pinned = this.hasPin(id);
    const others = ops.closeSet(this._model, id, "others");
    const right = ops.closeSet(this._model, id, "right");
    const floating = where.place === "tree" && Boolean(where.window);
    const out: TabMenuItem[] = [
      { key: "close", label: t.dismiss, disabled: c.dismiss === false },
      { key: "close-others", label: t.closeOthers, disabled: !others.length },
      { key: "close-right", label: t.closeRight, disabled: !right.length },
      { key: "close-all", label: t.closeAll, disabled: !ops.closeSet(this._model, id, "all").length },
      "separator",
      { key: "pin", label: pinned ? t.unpin : t.pin, checked: pinned },
      { key: "float", label: floating ? t.dock : t.float, disabled: c.float === false && !floating },
      { key: "popout", label: t.popout, disabled: c.popout === false || Boolean(ops.outsideOf(this._model, id)) },
      { key: "split-right", label: t.splitRight, disabled: views.length < 2 || c.move === false },
      { key: "split-down", label: t.splitDown, disabled: views.length < 2 || c.move === false }
    ];
    if (s && !s.docs && !floating) out.push({ key: "stow", label: t.stow, disabled: c.hide === false });
    return out;
  }

  /** Open the tab context menu of a view (at a client point, default: under its tab). */
  openTabMenu(id: string, at?: { x: number; y: number }): void {
    if (ops.locate(this._model, id).place !== "tree") return;
    const host = this.getBoundingClientRect();
    let x = at?.x;
    let y = at?.y;
    if (x === undefined || y === undefined) {
      const r = this.renderRoot.querySelector(`[id=${attr(`tab-${id}`)}], [id=${attr(`t-${id}`)}]`)?.getBoundingClientRect();
      x = r?.left ?? host.left + 20;
      y = r?.bottom ?? host.top + 20;
    }
    const base = this.tabMenuItems(id);
    const items = this.tabMenu ? this.tabMenu(id, base) : base;
    this._menu = undefined;
    this._tabMenu = { id, items, x: Math.max(0, Math.min(x - host.left, host.width - 220)), y: Math.max(0, y - host.top) };
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement & { focusFirst(): void }>("dockorama-tab-menu")?.focusFirst());
  }

  /** Run a built-in tab command for a view. */
  runTabCommand(key: TabCommand, id: string): void {
    const where = ops.locate(this._model, id);
    switch (key) {
      case "close": void this.dismiss(id); return;
      case "close-others": void this.dismissMany(ops.closeSet(this._model, id, "others")); return;
      case "close-right": void this.dismissMany(ops.closeSet(this._model, id, "right")); return;
      case "close-all": void this.dismissMany(ops.closeSet(this._model, id, "all")); return;
      case "pin": return this.pin(id, !this.hasPin(id));
      case "float":
        if (where.place === "tree" && where.window) return this.dockToEdge(id, "edge-right");
        return this.detach(id);
      case "popout": void this.popOut(id); return;
      case "stow": return this.stow(id);
      case "split-right":
      case "split-down": {
        const other = where.place === "tree" ? where.stack.views.find((v) => v !== id) : undefined;
        if (other) this.place(id, other, key === "split-right" ? "right" : "below");
        return;
      }
    }
  }

  /** Fire the cancellable `dockorama-command` for a menu choice. */
  private askCommand(id: string, command: string, source: CommandSource, custom: boolean): boolean {
    const detail: CommandDetail = { id, command, source, custom };
    return this.emit("dockorama-command", detail, true);
  }

  private closeTabMenu(refocus: boolean): void {
    const id = this._tabMenu?.id;
    this._tabMenu = undefined;
    if (refocus && id) void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`[id=${attr(`tab-${id}`)}]`)?.focus());
  }

  private renderGuide(): TemplateResult | typeof nothing {
    const d = this._drag?.peer || this._drag?.beyond ? undefined : (this._drag ?? this._guest ?? this.keyMoveGuide());
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
    return html`<dockorama-drop-guide .spots=${spots} .preview=${preview} .ghost=${ghost}></dockorama-drop-guide>`;
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
    return html`<dockorama-menu .entries=${this.menuEntries(menu.id)} .x=${menu.x} .y=${menu.y}></dockorama-menu>`;
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
    return html`<dockorama-palette .items=${this.paletteItems(p.query)} .query=${p.query} .index=${p.index}
      .label=${this.t.palette} .placeholder=${this.t.palettePlaceholder} .empty=${this.t.noMatches}></dockorama-palette>`;
  }

  // ------------------------------------------------------------- part requests

  private onRequest = (e: Event): void => {
    const r = (e as CustomEvent<PartRequest>).detail;
    e.stopPropagation();
    const id = r.id ?? "";
    if (r.fromMenu) {
      this._menu = undefined;
      if (!this.askCommand(id, r.action, "pane-menu", false)) return;
    }
    switch (r.action) {
      case "activate": return this.onStackPointer(r["event"] as PointerEvent, id, r["source"] as HTMLElement);
      case "grab": return this.startDrag(r["event"] as PointerEvent, id, r["win"] as string | undefined, r["source"] as HTMLElement);
      case "reveal": return this.reveal(id);
      case "dismiss": void this.dismiss(id); return;
      case "zoom": return this.toggleZoom(id);
      case "stow": return this.stow(id);
      case "unstow": return this.unstow(id);
      case "float": return this.detach(id);
      case "dock": return this.dockToEdge(id, "edge-right");
      case "popout": void this.popOut(id); return;
      case "popin": return this.popIn(id);
      case "menu": return this.openMenu(id);
      case "menu-close": this._menu = undefined; return;
      case "peek": return r["toggle"] ? this.togglePeek(id) : this.openPeek(id, true);
      case "peek-close": this._peek = undefined; return;
      case "raise": return this.raise(r["key"] as string);
      case "grip": return this.startGrip(r["event"] as PointerEvent, r["key"] as string);
      case "gutter-grab":
        return this.startGutter(r["event"] as PointerEvent, r["path"] as number[], r["after"] as number, r["axis"] as "row" | "column",
          r["win"] as string | undefined, r["source"] as HTMLElement);
      case "gutter-fold": return this.foldAt(r["path"] as number[], r["after"] as number, r["win"] as string | undefined, r["source"] as HTMLElement | undefined);
      case "gutter-key":
        return this.keyGutter(r["event"] as KeyboardEvent, r["path"] as number[], r["after"] as number, r["axis"] as "row" | "column",
          r["weights"] as number[], r["win"] as string | undefined, r["source"] as HTMLElement | undefined);
      case "tab-menu": return this.openTabMenu(id, r["keyboard"] ? undefined : { x: Number(r["x"]), y: Number(r["y"]) });
      case "tab-menu-close": return this.closeTabMenu(true);
      case "tab-menu-choose": {
        const item = this._tabMenu?.items[Number(r["index"])];
        this.closeTabMenu(true);
        if (!item || item === "separator" || item.disabled) return;
        if (!this.askCommand(id, item.key, "tab-menu", Boolean(item.run))) return;
        if (item.run) item.run(id);
        else this.runTabCommand(item.key as TabCommand, id);
        return;
      }
      case "promote": return this.promote(id);
      case "confirm-close": {
        const c = this._confirm;
        this._confirm = undefined;
        c?.done(Boolean(r["ok"]));
        return;
      }
      case "outside-reopen": return this.reopenWindows();
      case "outside-dismiss": return this.keepWindowsDocked();
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
  private peekByHover = false;
  private openPeek(id: string, byHover = false): void {
    this._peek = id;
    this.peekAt = Date.now();
    this.peekByHover = byHover;
  }
  /** A click on a rail item toggles its flyout. Only a click right after a hover opened it keeps it open (the pointer was already on the item). */
  private togglePeek(id: string): void {
    if (this._peek === id && !(this.peekByHover && Date.now() - this.peekAt < 400)) this._peek = undefined;
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
    if (this._tabMenu && !path.some((n) => (n as HTMLElement).classList?.contains("tab-menu"))) this._tabMenu = undefined;
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
    d.peer?.clearGuest();
    if (this._model !== d.origin) this.commit(d.origin, "cancel", false);
    else this.requestUpdate();
    this.dispatchEvent(new CustomEvent("dockorama-dragcancel", { detail: { id: d.id }, bubbles: true, composed: true }));
  }

  private onDragMove = (e: PointerEvent): void => {
    const d = this._drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const next: DragState = { ...d, x: e.clientX, y: e.clientY };
    if (next.mode === "pending") {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      next.mode = d.windowKey ? "window" : d.strip ? "tab" : "loose";
      this._menu = undefined;
      if (!this.emit("dockorama-dragstart", { id: d.id, kind: next.mode as DragKind }, true)) {
        this.endDragListeners();
        this._drag = undefined;
        return;
      }
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
    if (next.mode === "loose" || next.mode === "window") {
      next.sx = e.screenX;
      next.sy = e.screenY;
      next.beyond = next.mode === "loose" && (e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight);
      const peer = next.mode === "loose" && !next.beyond ? this.peerAt(e.clientX, e.clientY) : undefined;
      if (d.peer && d.peer !== peer) d.peer.clearGuest();
      next.peer = peer;
      if (peer) {
        peer.hoverAt(d.id, e.clientX, e.clientY, this.caps(d.id));
        for (const k of ["target", "gap", "fill", "edge", "preview"] as const) next[k] = undefined;
      } else if (next.beyond) {
        for (const k of ["target", "gap", "fill", "edge", "preview"] as const) next[k] = undefined;
      } else this.findTarget(next);
    }
    this._drag = next;
    this.reportOver(next);
    this.requestUpdate();
  };

  /** Where a drag would drop right now. */
  private spotOf(d: DragState): DragOverDetail {
    if (d.mode === "tab") return { id: d.id, spot: "tabs" };
    if (d.peer) return { id: d.id, spot: "other-dock" };
    if (d.beyond) return { id: d.id, spot: "outside" };
    if (d.edge) return { id: d.id, spot: d.edge };
    if (d.gap) return { id: d.id, spot: "between" };
    if (d.fill && d.target?.zone) return { id: d.id, spot: "empty" };
    if (d.target?.zone) return { id: d.id, spot: d.target.zone, target: d.target.view };
    return { id: d.id, spot: "none" };
  }

  /** Fire `dockorama-dragover` only when the drop spot or target changes. */
  private reportOver(d: DragState): void {
    const s = this.spotOf(d);
    const sig = `${s.spot}|${s.target ?? ""}`;
    if (d.over === sig) return;
    d.over = sig;
    this.emit("dockorama-dragover", s);
  }

  private findTarget(d: DragState): void {
    d.target = undefined;
    d.gap = undefined;
    d.fill = undefined;
    d.edge = undefined;
    d.preview = undefined;
    const main = this.mainRect();
    if (main && !(d.caps ?? this.caps(d.id)).docsOnly) {
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
    if (!(d.caps ?? this.caps(d.id)).docsOnly) {
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
    if ((d.caps ?? this.caps(d.id)).docsOnly && !under.hasAttribute("data-docs")) return;
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
    const spot = this.spotOf(d);
    // Reordering inside a strip changes the model during the drag; any other drop is judged against the layout at release,
    // because the origin can already differ (pressing a tab selects it) and a vetoed drop must report moved: false.
    const before = d.mode === "tab" ? d.origin : this._model;
    const done = this.finishDrop(d);
    const report = (): void => {
      const detail: DropDetail = { ...spot, moved: this._model !== before || done === true };
      this.emit("dockorama-drop", detail);
    };
    if (done instanceof Promise) void done.then(report);
    else report();
  };

  /** Apply a drop. Returns true when it handed the view to another manager, a promise for pop-outs. */
  private finishDrop(d: DragState): boolean | Promise<unknown> | void {
    if (d.mode === "tab") {
      this.timeline.push(this._model);
      this.commit(this._model, "reorder", false);
      return;
    }
    if (d.peer) {
      if (d.peer.takeGuest(this, d.id)) return true;
      this.requestUpdate();
      return;
    }
    if (d.mode === "loose" && d.sx !== undefined && d.sy !== undefined) {
      const into = this.outsideAt(d.sx, d.sy);
      if (into) return this.popOut(d.id, { into });
      if (d.beyond) {
        if (this.caps(d.id).popout !== false) return this.popOut(d.id, { box: { x: d.sx - 60, y: d.sy - 20 } });
        this.requestUpdate();
        return;
      }
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
    // A view that may only live in a document area is not floated by dropping it on empty space.
    if (this.caps(d.id).docsOnly) {
      this.requestUpdate();
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
    let base = this._model;
    for (const i of [index, index + 1]) if (this.splitAt(path, win)?.folded?.[i]) base = ops.fold(base, path, i, false, win);
    const split = this.splitAt(path, win);
    gutter.toggleAttribute("data-live", true);
    const live = this.liveResize(() => this.splitResize(path, win));
    const move = (ev: PointerEvent) => {
      const delta = ((axis === "row" ? ev.clientX : ev.clientY) - start) * (rtl ? -1 : 1);
      const next = this.limitPair(split, index, shareSpace(sizes, index, delta));
      this._model = split?.fixed || split?.limits
        ? ops.resizeCells(base, path, next, win)
        : ops.setWeights(base, path, next.map((n) => Math.max(1, n)), win);
      live();
      this.requestUpdate();
    };
    const up = () => {
      gutter.removeAttribute("data-live");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      live.stop();
      if (this._model !== before) {
        this.timeline.push(before);
        this.commit(this._model, "resize", false);
        this.emitResize(this.splitResize(path, win));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  private keyGutter(e: KeyboardEvent, path: number[], index: number, axis: "row" | "column", weights: number[], win?: string, source?: HTMLElement): void {
    const split = this.splitAt(path, win);
    const gutter = source ?? (e.target as HTMLElement | null)?.closest?.(".gutter") as HTMLElement | null;
    const px = !!(split?.fixed || split?.limits) && !!gutter;
    const sizes = px ? this.cellSizes(gutter!, axis) : weights;
    const grow = axis === "row" ? ["ArrowRight"] : ["ArrowDown"];
    const shrink = axis === "row" ? ["ArrowLeft"] : ["ArrowUp"];
    const total = sizes.reduce((a, b) => a + b, 0);
    let delta = 0;
    if (grow.includes(e.key)) delta = total * 0.03;
    else if (shrink.includes(e.key)) delta = -total * 0.03;
    else if (e.key === "Home") delta = -total;
    else if (e.key === "End") delta = total;
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (getComputedStyle(this).direction === "rtl" && axis === "row" && e.key.startsWith("Arrow")) delta = -delta;
    const next = this.limitPair(split, index, shareSpace(sizes, index, delta, px ? 0 : total * 0.05));
    this.commit(px ? ops.resizeCells(this._model, path, next, win) : ops.setWeights(this._model, path, next, win), "resize");
    this.emitResize(this.splitResize(path, win));
  }

  /** Resize detail for the split at `path`: weights, or px sizes where cells are fixed/limited. */
  private splitResize(path: number[], win?: string): ResizeDetail | undefined {
    const split = this.splitAt(path, win);
    if (!split) return undefined;
    return { kind: "split", path, ...(win ? { window: win } : {}), sizes: split.weights.slice() };
  }

  private emitResize(detail: ResizeDetail | undefined): void {
    if (detail) this.emit("dockorama-resize", detail);
  }

  /** A live-resize reporter: fires `dockorama-resizing` at most once per animation frame. */
  private liveResize(read: () => ResizeDetail | undefined): (() => void) & { stop(): void } {
    let frame = 0;
    const fn = (() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const d = read();
        if (d) this.emit("dockorama-resizing", d);
      });
    }) as (() => void) & { stop(): void };
    fn.stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    return fn;
  }

  private splitAt(path: number[], win?: string): SplitNode | undefined {
    const tree = win ? this._model.windows.find((w) => w.key === win)?.tree ?? null : this._model.root;
    const node = ops.nodeAt(tree, path);
    return node?.kind === "split" ? node : undefined;
  }

  private cellSizes(gutter: HTMLElement, axis: "row" | "column"): number[] {
    const cells = Array.from(gutter.parentElement?.children ?? []).filter((c) => c.classList.contains("cell")) as HTMLElement[];
    return cells.map((c) => (axis === "row" ? c.getBoundingClientRect().width : c.getBoundingClientRect().height));
  }

  private limitPair(split: SplitNode | undefined, index: number, next: number[]): number[] {
    if (!split?.limits) return next;
    const out = next.slice();
    const [a, b] = ops.clampPair(out[index]!, out[index + 1]!, split.limits[index], split.limits[index + 1]);
    out[index] = a;
    out[index + 1] = b;
    return out;
  }

  /** Double-click / Enter on a gutter: restore a folded neighbour, otherwise fold the smaller one. */
  private foldAt(path: number[], index: number, win?: string, gutter?: HTMLElement): void {
    const split = this.splitAt(path, win);
    if (!split) return;
    const open = [index, index + 1].find((i) => split.folded?.[i]);
    if (open !== undefined) return this.commit(ops.fold(this._model, path, open, false, win), "resize");
    const sizes = gutter ? this.cellSizes(gutter, split.axis) : [];
    const a = sizes[index] || split.weights[index] || 0;
    const b = sizes[index + 1] || split.weights[index + 1] || 0;
    this.commit(ops.fold(this._model, path, b < a ? index + 1 : index, true, win), "resize");
  }

  /** Collapse (`on`, default) or restore the split cell holding view `id`. */
  foldView(id: string, on = true): void {
    const c = ops.cellOf(this._model, id);
    if (c) this.commit(ops.fold(this._model, c.path, c.index, on, c.win), "resize");
  }

  /** True when the split cell holding view `id` is collapsed. */
  isFolded(id: string): boolean {
    const c = ops.cellOf(this._model, id);
    return !!c?.split.folded?.[c.index];
  }

  /** Give the split cell holding view `id` a fixed pixel size that stays put when the dock resizes (`null` to make it proportional again). */
  fixViewSize(id: string, px: number | null): void {
    const c = ops.cellOf(this._model, id);
    if (c) this.commit(ops.fixSize(this._model, c.path, c.index, px, c.win), "resize");
  }

  /** Set min/max pixel limits for the split cell holding view `id` (`null` clears them). */
  limitViewSize(id: string, limits: SizeLimits | null): void {
    const c = ops.cellOf(this._model, id);
    if (c) this.commit(ops.limitSize(this._model, c.path, c.index, limits, c.win), "resize");
  }

  private startGrip(e: PointerEvent, key: string): void {
    e.preventDefault();
    e.stopPropagation();
    const w = this._model.windows.find((x) => x.key === key);
    if (!w) return;
    const start = { ...w.box };
    const before = this._model;
    const read = (): ResizeDetail | undefined => {
      const box = this._model.windows.find((x) => x.key === key)?.box;
      return box ? { kind: "window", window: key, box: { ...box } } : undefined;
    };
    const live = this.liveResize(read);
    const move = (ev: PointerEvent) => {
      const box = snapBox({ ...start, w: Math.max(160, start.w + ev.clientX - e.clientX), h: Math.max(90, start.h + ev.clientY - e.clientY) }, this.snap);
      this._model = ops.moveWindow(this._model, key, box);
      live();
      this.requestUpdate();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      live.stop();
      this.timeline.push(before);
      this.commit(this._model, "window", false);
      this.emitResize(read());
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // ------------------------------------------------------------- keyboard

  // ------------------------------------------------------------- keyboard docking

  /** Drop targets for keyboard docking: every visible group except the moving view's own lone group, then the outer edge. */
  private moveTargets(id: string): Array<{ view: string; rect: Rect; label: string; path?: number[]; win?: string; empty?: boolean } | { edge: true; rect: Rect; label: string }> {
    const where = ops.locate(this._model, id);
    const lone = where.place === "tree" && where.stack.views.length === 1 ? where.stack.views[0] : undefined;
    const out: ReturnType<DockoramaManager["moveTargets"]> = [];
    for (const el of Array.from(this.renderRoot.querySelectorAll<HTMLElement>("[data-stack]"))) {
      if (el.closest(".drawer")) continue;
      const empty = el.hasAttribute("data-empty");
      const view = empty ? "" : (el.querySelector<HTMLElement>(".tab")?.dataset["view"] ?? el.dataset["stack"]!);
      if (view && view === lone) continue;
      const r = el.getBoundingClientRect();
      const label = empty ? this.t.emptyDocs : (el.getAttribute("aria-label") ?? view);
      out.push({ view, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, label, empty,
        path: (el.dataset["path"] ?? "").split(".").filter(Boolean).map(Number), win: el.dataset["win"] || undefined });
    }
    const main = this.mainRect();
    if (main && !this.caps(id).docsOnly) out.push({ edge: true, rect: main, label: this.t.outerEdge });
    return out;
  }

  /**
   * Start moving a view with the keyboard (default: the focused one; shortcut `Alt+M`). Tab / Shift+Tab choose a
   * group (or the outer edge), arrow keys a side, Enter drops, Escape cancels. Progress is announced in a live region.
   * Returns false when the view cannot move.
   */
  beginMove(id = this._model.focus): boolean {
    if (!id || this.caps(id).move === false || ops.locate(this._model, id).place !== "tree") return false;
    const targets = this.moveTargets(id);
    if (!targets.length) return false;
    const first = "edge" in targets[0]! ? "edge-left" : "into";
    this._keyMove = { id, index: 0, zone: first };
    this._say = `${this.t.moveMode.replace("{title}", this._model.views[id]?.title ?? id)} ${this.describeMove()}`;
    return true;
  }

  /** Stop keyboard docking without moving. */
  cancelMove(): void {
    if (!this._keyMove) return;
    this._keyMove = undefined;
    this._say = this.t.moveCancelled;
  }

  private describeMove(): string {
    const k = this._keyMove;
    if (!k) return "";
    const target = this.moveTargets(k.id)[k.index];
    return target ? this.t.moveTarget.replace("{target}", target.label).replace("{zone}", k.zone) : "";
  }

  /** The keyboard move as a drag state, for the drop guide. */
  private keyMoveGuide(): DragState | undefined {
    const k = this._keyMove;
    if (!k) return undefined;
    const t = this.moveTargets(k.id)[k.index];
    if (!t) return undefined;
    const d: DragState = { id: k.id, mode: "window", startX: 0, startY: 0, x: 0, y: 0, origin: this._model, pointerId: -1 };
    if ("edge" in t) {
      d.edge = k.zone as EdgeZone;
      d.preview = previewFor(t.rect, d.edge);
    } else {
      d.target = { view: t.view, rect: t.rect, zone: k.zone as DropZone };
      if (t.empty) d.fill = { path: t.path ?? [], win: t.win, rect: t.rect };
      d.preview = t.empty ? t.rect : previewFor(t.rect, k.zone as DropZone);
    }
    return d;
  }

  private onMoveKey(e: KeyboardEvent): boolean {
    const k = this._keyMove;
    if (!k) return false;
    const targets = this.moveTargets(k.id);
    const t = targets[k.index];
    const sides: Record<string, DropZone> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "above", ArrowDown: "below" };
    const edges: Record<string, EdgeZone> = { ArrowLeft: "edge-left", ArrowRight: "edge-right", ArrowUp: "edge-above", ArrowDown: "edge-below" };
    if (e.key === "Escape") this.cancelMove();
    else if (e.key === "Tab") {
      const index = (k.index + (e.shiftKey ? targets.length - 1 : 1)) % targets.length;
      const next = targets[index]!;
      this._keyMove = { ...k, index, zone: "edge" in next ? "edge-left" : "into" };
      this._say = this.describeMove();
    } else if (sides[e.key] && t) {
      const zone = "edge" in t ? edges[e.key]! : t.empty ? "into" : k.zone === sides[e.key] ? "into" : sides[e.key]!;
      this._keyMove = { ...k, zone };
      this._say = this.describeMove();
    } else if (e.key === "Enter" || e.key === " ") {
      this._keyMove = undefined;
      const title = this._model.views[k.id]?.title ?? k.id;
      if (t && "edge" in t) this.dockToEdge(k.id, k.zone as EdgeZone);
      else if (t?.empty) this.dropIntoDocs(k.id, t.path ?? [], t.win);
      else if (t) this.place(k.id, t.view, k.zone as DropZone);
      this._say = this.t.moveDone.replace("{title}", title);
    } else return true;
    e.preventDefault();
    e.stopPropagation();
    return true;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (this._keyMove && this.onMoveKey(e)) return;
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
    if (k === "m") return this.handled(e, () => void this.beginMove(focus));
    if (k === "h") return this.handled(e, () => this.stow(focus));
    if (k === "f") return this.handled(e, () => this.detach(focus));
    if (key === "Backspace") return this.handled(e, () => this.dismiss(focus));
  };

  /** Typing in a preview view keeps it. */
  private onInput = (e: Event): void => {
    const el = (e.target as Element | null)?.closest?.("[data-view]");
    const id = el?.parentElement === this ? el.getAttribute("data-view") : null;
    if (id) this.promote(id);
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
      const tab = best.el.querySelector<HTMLElement>('.tab[data-selected]');
      const id = tab?.dataset["view"] ?? best.el.dataset["stack"];
      if (id) this.activate(id);
      (tab ?? best.el.querySelector<HTMLElement>(".btn"))?.focus();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "dockorama-manager": DockoramaManager;
  }
  interface HTMLElementEventMap {
    "dockorama-change": CustomEvent<{ model: DockoramaModel; reason: ChangeReason }>;
    "dockorama-focus": CustomEvent<{ id: string; previous?: string }>;
    "dockorama-viewshow": CustomEvent<{ id: string; first: boolean }>;
    "dockorama-beforeclose": CustomEvent<{ id: string }>;
    "dockorama-beforemove": CustomEvent<{ id: string; target?: string; zone: DropZone | EdgeZone | "between" }>;
    "dockorama-dragcancel": CustomEvent<{ id: string }>;
    "dockorama-dirty": CustomEvent<{ id: string; dirty: boolean }>;
    "dockorama-layoutissue": CustomEvent<{ source: LayoutSource; problems: string[]; fatal: boolean }>;
    "dockorama-transfer": CustomEvent<{ id: string; from: DockoramaManager; to: DockoramaManager; direction: "in" | "out" }>;
    "dockorama-viewhide": CustomEvent<{ id: string }>;
    "dockorama-close": CustomEvent<{ id: string }>;
    "dockorama-beforeadd": CustomEvent<BeforeAddDetail>;
    "dockorama-command": CustomEvent<CommandDetail>;
    "dockorama-dragstart": CustomEvent<{ id: string; kind: DragKind }>;
    "dockorama-dragover": CustomEvent<DragOverDetail>;
    "dockorama-drop": CustomEvent<DropDetail>;
    "dockorama-resize": CustomEvent<ResizeDetail>;
    "dockorama-resizing": CustomEvent<ResizeDetail>;
    "dockorama-float": CustomEvent<DockoramaStateEvents["dockorama-float"]>;
    "dockorama-dock": CustomEvent<DockoramaStateEvents["dockorama-dock"]>;
    "dockorama-stow": CustomEvent<DockoramaStateEvents["dockorama-stow"]>;
    "dockorama-unstow": CustomEvent<DockoramaStateEvents["dockorama-unstow"]>;
    "dockorama-pin": CustomEvent<DockoramaStateEvents["dockorama-pin"]>;
    "dockorama-unpin": CustomEvent<DockoramaStateEvents["dockorama-unpin"]>;
    "dockorama-popout": CustomEvent<DockoramaStateEvents["dockorama-popout"]>;
    "dockorama-popin": CustomEvent<DockoramaStateEvents["dockorama-popin"]>;
    "dockorama-collapse": CustomEvent<DockoramaStateEvents["dockorama-collapse"]>;
    "dockorama-expand": CustomEvent<DockoramaStateEvents["dockorama-expand"]>;
    "dockorama-viewremove": CustomEvent<DockoramaStateEvents["dockorama-viewremove"]>;
  }
}
