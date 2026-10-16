import { LitElement, type PropertyValues, type TemplateResult } from "lit";
import { DEFAULT_LABELS } from "../core/constants.js";
import type { ChangeReason, DockoramaLabels, TabCommand } from "../core/contracts.js";
import { Timeline } from "../core/history.js";
import { styles } from "./styles.js";
import { clampBox, snapBox, type Rect } from "../core/geometry.js";
import { DockoramaPart, defineParts, type TabMenuItem } from "../components/index.js";
import type { Box, DropZone, EdgeZone, DockoramaModel, LayoutMigrations, Side, SizeLimits, ViewContent, ViewInfo, ViewOptions, ViewSpot } from "../core/contracts.js";
import * as ops from "../core/ops.js";
import { LayoutStore } from "../core/storage.js";
import { DragEngine } from "./drag.js";
import { LayoutActions } from "./actions.js";
import { Lifecycle } from "./lifecycle.js";
import { PartRouter } from "./requests.js";
import { SkinSheet } from "./skinsheet.js";
import { ViewRegistry } from "./views.js";
import { ClosingController } from "./closing.js";
import { MenuController } from "./menus.js";
import { afterParts, renderDock } from "./render.js";
import { KeyboardController } from "./keyboard.js";
import { ResizeController } from "./resize.js";
import { OutsideWindows } from "./outside.js";
import type { DockHost, DragState } from "./host.js";
import { skinNamed, type Skin, type SkinPatch, type SkinScope } from "../skins/core.js";
import { stateEvents } from "../core/events.js";

const SILENT: ChangeReason[] = ["select", "focus", "cancel"];
/** Changes after which saved outside windows are (re-)opened. */
const OPEN_ON: ChangeReason[] = ["set", "restore", "undo", "redo"];
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
  /** @internal What this dock's UI parts render with. */
  skinScope(): SkinScope {
    const skin = typeof this.skin === "string" ? skinNamed(this.skin) : this.skin;
    return { ...(skin ? { skin } : {}), ...(this.skinPatch ? { patch: this.skinPatch } : {}) };
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

  private _model: DockoramaModel = ops.emptyModel();
  private readonly store = new LayoutStore(this, (source, problems, fatal) =>
    this.emit("dockorama-layoutissue", { source, problems, fatal }));
  private readonly timeline = new Timeline<DockoramaModel>();
  private _peek?: string;
  private _drag?: DragState;
  private _menu?: { id: string; x: number; y: number };
  private _palette?: { query: string; index: number };
  private _say = "";
  /** This element as the controllers see it (they use members the typings keep private). */
  private readonly host = this as unknown as DockHost;
  private readonly outside = new OutsideWindows(this.host);
  private readonly drag = new DragEngine(this.host);
  private readonly resize = new ResizeController(this.host);
  private readonly keys = new KeyboardController(this.host);
  private readonly menus = new MenuController(this.host);
  private readonly closing = new ClosingController(this.host);
  private readonly views = new ViewRegistry(this.host);
  private readonly skinning = new SkinSheet(this.host);
  private readonly router = new PartRouter(this.host);
  private readonly life = new Lifecycle(this.host);
  private readonly actions = new LayoutActions(this.host);
  /** Drag from another manager hovering over this one. */
  private _guest?: DragState;
  private _tabMenu?: { id: string; x: number; y: number; items: TabMenuItem[] };
  /** Outside windows the browser would not re-open. */
  private _blocked: string[] = [];
  private _confirm?: { id: string; done: (ok: boolean) => void };
  /** Keyboard docking in progress: the view, the chosen target (index into `moveTargets()`) and side. */
  private _keyMove?: { id: string; index: number; zone: DropZone | EdgeZone };
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
    this.life.connect();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.life.disconnect();
  }

  // ---------------------------------------------------------------- public API

  /** Move a view beside / into the group holding `target`. */
  place(id: string, target: string, zone: DropZone, index?: number): void {
    this.actions.place(id, target, zone, index);
  }
  /** Dock a view at an outer edge of the layout. */
  dockToEdge(id: string, zone: EdgeZone): void {
    this.actions.dockToEdge(id, zone);
  }
  /** Insert a view as a new group between child `after` and `after + 1` of the split at `path`. */
  dropBetween(id: string, path: number[], after: number, windowKey?: string): void {
    this.actions.dropBetween(id, path, after, windowKey);
  }
  /** Put a view into an empty document area. */
  dropIntoDocs(id: string, path: number[], windowKey?: string): void {
    this.actions.dropIntoDocs(id, path, windowKey);
  }
  /** Float a view in its own window. */
  detach(id: string, box?: Box): void {
    this.actions.detach(id, box);
  }
  /** Auto-hide a view into an edge drawer. */
  stow(id: string, side?: Side): void {
    this.actions.stow(id, side);
  }
  /** Bring a stowed view back into the layout. */
  unstow(id: string): void {
    this.actions.unstow(id);
  }
  /** Close a view (cancellable through `dockorama-beforeclose`). It stays registered. */
  dismiss(id: string): Promise<boolean> {
    return this.closing.dismiss(id);
  }

  /** Mark a view as having unsaved changes (or not). A dirty preview tab is promoted. Fires `dockorama-dirty`. */
  setDirty(id: string, dirty = true): void {
    this.closing.setDirty(id, dirty);
  }
  /** Whether a view has unsaved changes. */
  isDirty(id: string): boolean {
    return this.closing.isDirty(id);
  }
  /** Ids of every view with unsaved changes. */
  get dirtyViews(): string[] {
    return this.closing.dirtyViews;
  }

  /** Show a registered view as its group's preview tab (replacing the current preview there). */
  showPreview(id: string): void {
    this.actions.showPreview(id);
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
    return this.closing.dismissMany(ids);
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
    this.actions.reveal(id);
  }
  /** Maximise a view's group to fill the layout, or restore. */
  toggleZoom(id?: string): void {
    this.actions.toggleZoom(id);
  }
  /** Mark a view as active (focused). */
  activate(id: string): void {
    this.actions.activate(id);
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
    this.views.add(id, content, extra);
  }
  /**
   * Remove a view completely (undoable for the layout). Returns its content element, taken out of
   * the manager unless `keepElement` is true, or null if it never had one (or `id` is unknown).
   */
  removeView(id: string, options: { keepElement?: boolean } = {}): Element | null {
    return this.views.remove(id, options);
  }
  /** The content element of a view (null if unknown, or lazy and not yet shown). */
  getViewElement(id: string): Element | null {
    return this.views.elementOf(id);
  }

  /** True when view `id` has content that is currently detached because of `retain="active"`. */
  isRetained(id: string): boolean {
    return this.views.stash.has(id);
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
  transferView(id: string, target: DockoramaManager, at: ViewSpot = "auto"): void {
    const info = this._model.views[id];
    if (!info || target === this) return;
    if (target.hasView(id)) throw new Error(`dockorama: the target already has a view with id "${id}"`);
    const next = ops.enlist(target._model, id, ops.copy(info), target.views.resolveSpot(at));
    this.drag.handOver(id, target.host, next);
  }

  /** The built-in tab context menu items for a view (before the `tabMenu` hook). */
  tabMenuItems(id: string): TabMenuItem[] {
    return this.menus.tabMenuItems(id);
  }

  /** Open the tab context menu of a view (at a client point, default: under its tab). */
  openTabMenu(id: string, at?: { x: number; y: number }): void {
    this.menus.openTabMenu(id, at);
  }

  /** Run a built-in tab command for a view. */
  runTabCommand(key: TabCommand, id: string): void {
    this.menus.runTabCommand(key, id);
  }

  /** Palette entries: views + commands. */
  paletteItems(query = ""): Array<{ label: string; detail: string; run: () => void }> {
    return this.menus.paletteItems(query);
  }

  // ------------------------------------------------------------- internals

  private defaultBox(): Box {
    const r = this.getBoundingClientRect();
    return { x: Math.max(20, r.width / 2 - 180), y: Math.max(20, r.height / 2 - 120), w: 360, h: 240 };
  }

  private caps(id: string) {
    return this._model.views[id]?.caps ?? {};
  }

  /** Fire a public event (bubbles, composed). Returns false when a cancellable one was vetoed. */
  private emit(type: string, detail: unknown, cancelable = false): boolean {
    return this.dispatchEvent(new CustomEvent(type, { detail, cancelable, bubbles: true, composed: true }));
  }

  private emitBefore(type: string, detail: unknown): boolean {
    return this.emit(type, detail, true);
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
      this.emit("dockorama-focus", { id: next.focus, previous: prev.focus });
    }
    if (reason !== "focus") {
      this.emit("dockorama-change", { model: next, reason });
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
    if (changed.has("skin") || changed.has("skinPatch") || !this.skinning.applied) this.skinning.apply();
    if (changed.has("storageKey") && this.storageKey && !this.restoredFromStorage) {
      const stored = this.store.load(this._model);
      if (stored) {
        this.restoredFromStorage = true;
        this.commit(stored, "restore", false);
      }
    }
    this.settled = afterParts(this.host);
  }

  // ------------------------------------------------------------- rendering

  override render(): TemplateResult {
    return renderDock(this.host);
  }

  /** Abort the current drag and restore the layout from before it started. */
  cancelDrag(): void {
    this.drag.cancel();
  }

  private mainRect(): Rect | undefined {
    return this.renderRoot.querySelector(".main")?.getBoundingClientRect();
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



}
