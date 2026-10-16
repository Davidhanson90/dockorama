import { attr } from "../utils/dom.js";
import { contains } from "../core/geometry.js";
import type { DockHost } from "./host.js";
import type { Box, OutsideWindow } from "../core/contracts.js";
import * as ops from "../core/ops.js";

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

/**
 * The browser windows a manager's views are popped out into: opening and closing them, painting their tab bar,
 * dragging tabs between them and the layout, and keeping them in step with `model.outside`.
 */
export class OutsideWindows {
  /** Open windows by key. */
  readonly wins = new Map<string, Window>();
  /** Windows dockorama is closing itself (their pagehide is not a user close). */
  private readonly closing = new WeakSet<Window>();
  private unloading = false;

  constructor(private readonly h: DockHost) {}

  /** The content element of a view that currently lives in an outside window. */
  elementOf(id: string): Element | null {
    for (const win of this.wins.values()) {
      const el = win.closed ? null : win.document.querySelector(`.dko-body > [data-view=${attr(id)}]`);
      if (el) return el;
    }
    return null;
  }

  /** Open a view's content in a new (or, with `into`, an existing) outside window. False when not allowed or blocked. */
  popOut(id: string, options: { into?: string; box?: Partial<Box> } = {}): boolean {
    const h = this.h;
    if (h.caps(id).popout === false || ops.locate(h._model, id).place !== "tree") return false;
    const cur = ops.outsideOf(h._model, id);
    if (cur && (!options.into || cur.key === options.into)) return false;
    if (!h.getViewElement(id) && !h.views.factories.has(id)) return false;
    const live = options.into ? this.wins.get(options.into) : undefined;
    let key = options.into;
    let box: Box | undefined;
    if (!live || live.closed) {
      key = `o-${id}-${Date.now().toString(36)}`;
      box = { x: options.box?.x ?? NaN, y: options.box?.y ?? NaN, w: options.box?.w ?? 640, h: options.box?.h ?? 480 };
      if (!this.open(key, box)) return false;
      if (Number.isNaN(box.x)) box = undefined;
    }
    h.commit(ops.goOutside(h._model, id, key!, box), "popout");
    return true;
  }

  /** Give up on blocked windows: their views show in the layout again (undoable). */
  keepDocked(): void {
    const h = this.h;
    const keys = new Set(h._blocked);
    const m = ops.copy(h._model);
    m.outside = (m.outside ?? []).filter((o) => !keys.has(o.key));
    h.commit(ops.normalize(m), "popin");
  }

  open(key: string, box?: Box): Window | null {
    const pos = box && !Number.isNaN(box.x) ? `,left=${Math.round(box.x)},top=${Math.round(box.y)}` : "";
    const size = box ? `,width=${Math.round(box.w)},height=${Math.round(box.h)}` : ",width=640,height=480";
    let win: Window | null = null;
    try {
      win = window.open("", `dockorama-${key}`, `popup${size}${pos}`) ?? null;
    } catch {
      win = null;
    }
    if (!win) return null;
    this.prepare(win, key);
    this.wins.set(key, win);
    return win;
  }

  /** Build the outside window's page: a tab bar and a body that holds the content elements. */
  private prepare(win: Window, key: string): void {
    const doc = win.document;
    doc.head.replaceChildren();
    doc.body.replaceChildren();
    for (const node of Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))) doc.head.append(node.cloneNode(true));
    const style = doc.createElement("style");
    style.textContent = OUTSIDE_CSS;
    doc.head.append(style);
    doc.body.className = "dko";
    doc.body.dataset["theme"] = this.h.theme;
    const tabs = doc.createElement("div");
    tabs.className = "dko-tabs";
    tabs.setAttribute("role", "tablist");
    const body = doc.createElement("div");
    body.className = "dko-body";
    doc.body.append(tabs, body);
    win.addEventListener("pagehide", () => {
      if (this.closing.has(win) || this.unloading) return;
      // The user closed the window: bring its views back.
      this.wins.delete(key);
      const o = this.h._model.outside?.find((x) => x.key === key);
      if (!o) return;
      let m = this.h._model;
      for (const v of o.views) m = ops.comeInside(m, v);
      this.adoptHome(win);
      this.h.commit(m, "popin");
    });
    let t: ReturnType<typeof setTimeout> | undefined;
    win.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(() => this.noteBox(key, win), 250);
    });
  }

  /** Record an outside window's screen box without an undo step or change event. */
  private noteBox(key: string, win: Window): void {
    if (win.closed || !this.h._model.outside?.some((o) => o.key === key)) return;
    this.h._model = ops.tuneOutside(this.h._model, key, { box: { x: win.screenX, y: win.screenY, w: win.outerWidth, h: win.outerHeight } });
    this.h.store.save(this.h._model);
  }

  readonly onUnload = (): void => {
    for (const [key, win] of this.wins) this.noteBox(key, win);
    this.unloading = true;
    for (const win of this.wins.values()) if (!win.closed) win.close();
    this.wins.clear();
  };

  /** Move every content element in an outside window back into the manager. */
  private adoptHome(win: Window): void {
    if (win.closed && !win.document) return;
    for (const el of Array.from(win.document.querySelectorAll<HTMLElement>(".dko-body > [data-view]"))) {
      this.release(el);
    }
  }

  /** Put a content element back into the manager. */
  private release(el: HTMLElement): void {
    el.removeAttribute("data-outside-hidden");
    this.h.append(el);
  }

  /** Make open outside windows match `model.outside`; optionally try to open missing ones. */
  reconcile(allowOpen: boolean): void {
    const want = this.h._model.outside ?? [];
    if (!want.length && !this.wins.size && !this.h._blocked.length) return;
    for (const [key, win] of Array.from(this.wins)) {
      if (want.some((o) => o.key === key) && !win.closed) continue;
      this.wins.delete(key);
      if (!win.closed) {
        this.adoptHome(win);
        this.closing.add(win);
        win.close();
      }
    }
    const blocked: string[] = [];
    for (const o of want) {
      let win = this.wins.get(o.key);
      if (!win && allowOpen && this.h.isConnected) win = this.open(o.key, o.box) ?? undefined;
      if (!win) {
        blocked.push(o.key);
        continue;
      }
      this.paint(o, win);
    }
    this.h._blocked = blocked;
  }

  /** Put the right content into an outside window and redraw its tab bar. */
  private paint(o: OutsideWindow, win: Window): void {
    const doc = win.document;
    const body = doc.querySelector<HTMLElement>(".dko-body");
    const tabs = doc.querySelector<HTMLElement>(".dko-tabs");
    if (!body || !tabs) return;
    for (const el of Array.from(body.querySelectorAll<HTMLElement>(":scope > [data-view]"))) {
      if (!o.views.includes(el.dataset["view"] ?? "")) this.release(el);
    }
    for (const id of o.views) {
      let el = this.h.getViewElement(id) as HTMLElement | null;
      const make = this.h.views.factories.get(id);
      if (!el && make) {
        this.h.views.factories.delete(id);
        el = make() as HTMLElement;
        el.setAttribute("data-view", id);
      }
      if (!el) continue;
      this.h.views.stash.delete(id);
      if (el.parentNode !== body) body.append(el);
      el.toggleAttribute("data-outside-hidden", id !== o.current);
    }
    doc.title = o.views.map((v) => this.h._model.views[v]?.title ?? v).join(" · ");
    tabs.replaceChildren(...o.views.map((id) => {
      const tab = doc.createElement("div");
      tab.className = "dko-tab";
      tab.setAttribute("role", "tab");
      tab.dataset["view"] = id;
      tab.tabIndex = 0;
      tab.setAttribute("aria-selected", String(id === o.current));
      const label = doc.createElement("span");
      label.textContent = this.h._model.views[id]?.title ?? id;
      const back = doc.createElement("button");
      back.className = "dko-back";
      back.type = "button";
      back.title = this.h.t.popin;
      back.setAttribute("aria-label", `${this.h.t.popin} ${label.textContent}`);
      back.textContent = "\u2199";
      back.addEventListener("pointerdown", (e) => e.stopPropagation());
      back.addEventListener("click", () => this.h.popIn(id));
      tab.append(label, back);
      tab.addEventListener("click", () => this.h.commit(ops.tuneOutside(this.h._model, o.key, { current: id }), "select"));
      tab.addEventListener("pointerdown", (e) => this.startDrag(e, o.key, id, win));
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
  at(sx: number, sy: number, except?: string): string | undefined {
    for (const [key, w] of this.wins) {
      const box = { left: w.screenX, top: w.screenY, width: w.outerWidth, height: w.outerHeight };
      if (key !== except && !w.closed && contains(box, sx, sy)) return key;
    }
    return undefined;
  }

  /** Drag a tab out of an outside window: into another one, or back onto the layout (with drop guides). */
  private startDrag(e: PointerEvent, key: string, id: string, win: Window): void {
    if (e.button !== 0) return;
    const sx0 = e.screenX;
    const sy0 = e.screenY;
    let moved = false;
    const inside = (ev: PointerEvent) => contains({ left: 0, top: 0, width: win.innerWidth, height: win.innerHeight }, ev.clientX, ev.clientY);
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.screenX - sx0, ev.screenY - sy0) < 6) return;
      moved = true;
      if (inside(ev)) {
        this.h.drag.clearGuest();
        return;
      }
      const p = this.toClient(ev.screenX, ev.screenY);
      this.h.drag.hoverAt(id, p.x, p.y);
    };
    const up = (ev: PointerEvent) => {
      win.removeEventListener("pointermove", move);
      win.removeEventListener("pointerup", up);
      const g = this.h._guest;
      this.h.drag.clearGuest();
      if (!moved || inside(ev)) return;
      const into = this.at(ev.screenX, ev.screenY, key);
      if (into) {
        this.h.popOut(id, { into });
        return;
      }
      const placed = g ? this.h.drag.applyDrop(ops.comeInside(this.h._model, id), id, g) : undefined;
      this.h.commit(placed ?? ops.comeInside(this.h._model, id), placed ? "place" : "popin");
    };
    win.addEventListener("pointermove", move);
    win.addEventListener("pointerup", up);
  }
}
