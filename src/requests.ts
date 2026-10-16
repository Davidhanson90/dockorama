import type { PartRequest } from "./components/index.js";
import type { DockHost } from "./host.js";
import type { TabCommand } from "./manager.js";
import * as ops from "./ops.js";

type Handler = (h: DockHost, r: PartRequest, id: string) => void;

const axisOf = (r: PartRequest) => r["axis"] as "row" | "column";
const winOf = (r: PartRequest) => r["win"] as string | undefined;

/** What each `dockorama-request` action a UI part can raise does. */
const ROUTES: Record<string, Handler> = {
  grab: (h, r, id) => h.drag.start(r["event"] as PointerEvent, id, winOf(r), r["source"] as HTMLElement),
  reveal: (h, _r, id) => h.reveal(id),
  dismiss: (h, _r, id) => void h.dismiss(id),
  zoom: (h, _r, id) => h.toggleZoom(id),
  stow: (h, _r, id) => h.stow(id),
  unstow: (h, _r, id) => h.unstow(id),
  float: (h, _r, id) => h.detach(id),
  dock: (h, _r, id) => h.dockToEdge(id, "edge-right"),
  popout: (h, _r, id) => void h.popOut(id),
  popin: (h, _r, id) => h.popIn(id),
  promote: (h, _r, id) => h.promote(id),
  "outside-reopen": (h) => h.reopenWindows(),
  "outside-dismiss": (h) => h.keepWindowsDocked(),
  menu: (h, _r, id) => h.menus.openMenu(id),
  "menu-close": (h) => { h._menu = undefined; },
  "peek-close": (h) => { h._peek = undefined; },
  raise: (h, r) => h.router.raise(r["key"] as string),
  grip: (h, r) => h.resize.grip(r["event"] as PointerEvent, r["key"] as string),
  "gutter-grab": (h, r) => h.resize.gutter(r["event"] as PointerEvent, r["path"] as number[], r["after"] as number, axisOf(r), winOf(r), r["source"] as HTMLElement),
  "gutter-fold": (h, r) => h.resize.fold(r["path"] as number[], r["after"] as number, winOf(r), r["source"] as HTMLElement | undefined),
  "gutter-key": (h, r) => h.resize.key(r["event"] as KeyboardEvent, r["path"] as number[], r["after"] as number, axisOf(r),
    r["weights"] as number[], winOf(r), r["source"] as HTMLElement | undefined),
  "tab-menu": (h, r, id) => h.menus.openTabMenu(id, r["keyboard"] ? undefined : { x: Number(r["x"]), y: Number(r["y"]) }),
  "tab-menu-close": (h) => h.menus.closeTabMenu(true),
  "tab-menu-choose": (h, r, id) => {
    const item = h._tabMenu?.items[Number(r["index"])];
    h.menus.closeTabMenu(true);
    if (!item || item === "separator" || item.disabled) return;
    if (!h.menus.askCommand(id, item.key, "tab-menu", Boolean(item.run))) return;
    if (item.run) item.run(id);
    else h.menus.runTabCommand(item.key as TabCommand, id);
  },
  "confirm-close": (h, r) => {
    const c = h._confirm;
    h._confirm = undefined;
    c?.done(Boolean(r["ok"]));
  },
  "palette-query": (h, r) => { h._palette = { query: String(r["query"] ?? ""), index: 0 }; },
  "palette-index": (h, r) => { if (h._palette) h._palette = { ...h._palette, index: Number(r["index"]) }; },
  "palette-close": (h) => { h._palette = undefined; },
  "palette-choose": (h, r) => {
    const it = h.menus.paletteItems(h._palette?.query)[Number(r["index"])];
    h._palette = undefined;
    it?.run();
  }
};

/** Routes UI-part requests to the manager, owns the rail flyout ("peek") and dismisses popups on outside clicks. */
export class PartRouter {
  private peekAt = 0;
  private peekByHover = false;

  constructor(private readonly h: DockHost) {}

  onRequest = (e: Event): void => {
    const { h } = this;
    const r = (e as CustomEvent<PartRequest>).detail;
    e.stopPropagation();
    const id = r.id ?? "";
    if (r.fromMenu) {
      h._menu = undefined;
      if (!h.menus.askCommand(id, r.action, "pane-menu", false)) return;
    }
    if (r.action === "activate") return this.onStackPointer(r["event"] as PointerEvent, id, r["source"] as HTMLElement);
    if (r.action === "peek") return r["toggle"] ? this.togglePeek(id) : this.openPeek(id, true);
    ROUTES[r.action]?.(h, r, id);
  };

  /** Open a drawer view's flyout. */
  openPeek(id: string, byHover = false): void {
    this.h._peek = id;
    this.peekAt = Date.now();
    this.peekByHover = byHover;
  }

  /** A click on a rail item toggles its flyout. Only a click right after a hover opened it keeps it open (the pointer was already on the item). */
  private togglePeek(id: string): void {
    if (this.h._peek === id && !(this.peekByHover && Date.now() - this.peekAt < 400)) this.h._peek = undefined;
    else this.openPeek(id);
  }

  private onStackPointer(e: PointerEvent, id: string, section: HTMLElement): void {
    const { h } = this;
    if (id) h.activate(id);
    const first = e.composedPath()[0] as HTMLElement | undefined;
    const focusable = first?.closest?.("button, a, input, select, textarea, [tabindex], [contenteditable]");
    if (focusable && focusable !== h && (h.contains(focusable) || h.renderRoot.contains(focusable))) return;
    // Run after the browser's own mousedown focus handling.
    setTimeout(() => {
      if (!h.hasFocus()) section.focus({ preventScroll: true });
    });
  }

  /** Typing in a preview view keeps it. */
  onInput = (e: Event): void => {
    const el = (e.target as Element | null)?.closest?.("[data-view]");
    const id = el?.parentElement === this.h ? el.getAttribute("data-view") : null;
    if (id) this.h.promote(id);
  };

  /** Bring a floating window to the front. */
  raise(key: string): void {
    const { h } = this;
    const next = ops.raiseWindow(h._model, key);
    if (next !== h._model) h.commit(next, "focus", false);
  }

  /** A press outside an open popup closes it. */
  onOutside = (e: PointerEvent): void => {
    const { h } = this;
    const path = e.composedPath();
    const within = (...names: string[]) => path.some((n) => names.some((c) => (n as HTMLElement).classList?.contains(c)));
    if (h._menu && !within("menu")) h._menu = undefined;
    if (h._tabMenu && !within("tab-menu")) h._tabMenu = undefined;
    if (h._palette && !within("palette")) h._palette = undefined;
    if (h._peek && !within("drawer", "rail") && !path.some((n) => (n as HTMLElement).getAttribute?.("data-view") === h._peek)) h._peek = undefined;
  };
}
