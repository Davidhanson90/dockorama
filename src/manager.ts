import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { DEFAULT_LABELS, type DockoramaLabels } from "./labels.js";
import { Timeline } from "./history.js";
import { styles } from "./styles.js";
import {
  clampBox, compassSpots, edgeSpots, snapBox, type Rect, type Spot
} from "./geometry.js";
import { DockoramaPart, defineParts, type DockContext, type GuideSpot, type MenuEntry, type PartRequest, type TabMenuItem } from "./components/index.js";
import { slotOf } from "./components/context.js";
import { renderNode } from "./components/tree.js";
import type { Box, DropZone, EdgeZone, DockoramaModel, LayoutMigrations, LayoutSource, Side, SizeLimits, ViewContent, ViewInfo, ViewOptions } from "./model.js";
import * as ops from "./ops.js";
import { LayoutStore } from "./storage.js";
import { DragEngine, managers } from "./drag.js";
import { KeyboardController } from "./keyboard.js";
import { ResizeController } from "./resize.js";
import { OutsideWindows } from "./outside.js";
import type { DockHost, DragState } from "./host.js";
import { activeSkin, cssFor, skinNamed, watchSkins, type Skin, type SkinPatch, type SkinScope } from "./skins/core.js";
import { stateEvents, type BeforeAddDetail, type CommandDetail, type CommandSource, type DragKind, type DragOverDetail, type DropDetail, type DockoramaStateEvents, type ResizeDetail } from "./events.js";

/** Why the model changed (detail of `dockorama-change`). */
export type ChangeReason =
  | "set" | "place" | "edge" | "detach" | "window" | "stow" | "unstow" | "dismiss" | "reveal" | "select"
  | "reorder" | "resize" | "zoom" | "add" | "forget" | "undo" | "redo" | "focus" | "restore" | "cancel"
  | "transfer" | "popout" | "popin" | "pin" | "promote";

/** Built-in keys of the tab context menu. */
export type TabCommand =
  | "close" | "close-others" | "close-right" | "close-all" | "pin" | "float" | "popout" | "split-right" | "split-down" | "stow";

const SILENT: ChangeReason[] = ["select", "focus", "cancel"];
/** Changes after which saved outside windows are (re-)opened. */
const OPEN_ON: ChangeReason[] = ["set", "restore", "undo", "redo"];
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
  /** This element as the controllers see it (they use members the typings keep private). */
  private readonly host = this as unknown as DockHost;
  private readonly outside = new OutsideWindows(this.host);
  private readonly drag = new DragEngine(this.host);
  private readonly resize = new ResizeController(this.host);
  private readonly keys = new KeyboardController(this.host);
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
    this.addEventListener("keydown", this.keys.onKey);
    this.addEventListener("input", this.onInput);
    this.renderRoot.addEventListener("dockorama-request", this.onRequest);
    document.addEventListener("pointerdown", this.onOutside, true);
    window.addEventListener("pagehide", this.outside.onUnload);
    managers.add(this.host);
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
    this.outside.reconcile(true);
  }

  private dirObserver?: MutationObserver;
  private lastDir = "ltr";

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.dirObserver?.disconnect();
    this.removeEventListener("keydown", this.keys.onKey);
    this.removeEventListener("input", this.onInput);
    this.renderRoot.removeEventListener("dockorama-request", this.onRequest);
    document.removeEventListener("pointerdown", this.onOutside, true);
    window.removeEventListener("pagehide", this.outside.onUnload);
    managers.delete(this.host);
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
    return this.outside.elementOf(id) ?? this.querySelector(`:scope > [data-view=${attr(id)}]`) ?? this.stash.get(id) ?? null;
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
    return this.outside.popOut(id, options);
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
    this.outside.reconcile(true);
  }
  /** Give up on blocked outside windows: their views show in the layout again (undoable). */
  keepWindowsDocked(): void {
    this.outside.keepDocked();
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
    this.drag.handOver(id, target.host, next);
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
    this.outside.reconcile(OPEN_ON.includes(reason));
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
    const d = this._drag?.peer || this._drag?.beyond ? undefined : (this._drag ?? this._guest ?? this.keys.guide());
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
      case "grab": return this.drag.start(r["event"] as PointerEvent, id, r["win"] as string | undefined, r["source"] as HTMLElement);
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
      case "grip": return this.resize.grip(r["event"] as PointerEvent, r["key"] as string);
      case "gutter-grab":
        return this.resize.gutter(r["event"] as PointerEvent, r["path"] as number[], r["after"] as number, r["axis"] as "row" | "column",
          r["win"] as string | undefined, r["source"] as HTMLElement);
      case "gutter-fold": return this.resize.fold(r["path"] as number[], r["after"] as number, r["win"] as string | undefined, r["source"] as HTMLElement | undefined);
      case "gutter-key":
        return this.resize.key(r["event"] as KeyboardEvent, r["path"] as number[], r["after"] as number, r["axis"] as "row" | "column",
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

  /** Abort the current drag and restore the layout from before it started. */
  cancelDrag(): void {
    this.drag.cancel();
  }

  private mainRect(): Rect | undefined {
    return this.renderRoot.querySelector(".main")?.getBoundingClientRect();
  }

  private raise(key: string): void {
    const next = ops.raiseWindow(this._model, key);
    if (next !== this._model) this.commit(next, "focus", false);
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

  // ------------------------------------------------------------- keyboard

  // ------------------------------------------------------------- keyboard docking

  /**
   * Start moving a view with the keyboard (default: the focused one; shortcut `Alt+M`). Tab / Shift+Tab choose a
   * group (or the outer edge), arrow keys a side, Enter drops, Escape cancels. Progress is announced in a live region.
   * Returns false when the view cannot move.
   */
  beginMove(id = this._model.focus): boolean {
    return this.keys.begin(id);
  }

  /** Stop keyboard docking without moving. */
  cancelMove(): void {
    this.keys.cancel();
  }

  /** Split the focused view off its group to one side (or move it beside its group). */
  nudge(id: string, zone: DropZone): void {
    this.keys.nudge(id, zone);
  }

  /** Select the next/previous tab in the focused view's group. */
  cycleTab(id: string, step: number): void {
    this.keys.cycleTab(id, step);
  }

  /** Move focus to the nearest visible group in a direction. */
  focusNeighbour(zone: DropZone): void {
    this.keys.focusNeighbour(zone);
  }

  /** Typing in a preview view keeps it. */
  private onInput = (e: Event): void => {
    const el = (e.target as Element | null)?.closest?.("[data-view]");
    const id = el?.parentElement === this ? el.getAttribute("data-view") : null;
    if (id) this.promote(id);
  };


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
