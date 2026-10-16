import { pathOf } from "./dom.js";
import { compassSpots, contains, edgeSpots, hit, insertionIndex, previewFor, rectOf } from "./geometry.js";
import type { DockHost, DragState } from "./host.js";
import type { Caps, DockoramaModel } from "./model.js";
import * as ops from "./ops.js";
import type { DragKind, DragOverDetail, DropDetail } from "./events.js";

/** Every connected manager, for drags between managers that share a `drag-group`. */
export const managers = new Set<DockHost>();

/** Pointer drags of tabs, loose views and floating windows, and drops between docks of one drag group. */
export class DragEngine {
  constructor(private readonly h: DockHost) {}

  /** Show drop guides for a view at a client point of this manager (used by drags that started elsewhere). */
  /** Another manager in the same drag group whose box contains a client point (not this one). */
  private peerAt(x: number, y: number): DockHost | undefined {
    const { h } = this;
    if (!h.dragGroup || contains(h.getBoundingClientRect(), x, y)) return undefined;
    for (const m of managers) {
      if (m !== h && m.dragGroup === h.dragGroup && m.isConnected && contains(m.getBoundingClientRect(), x, y)) return m;
    }
    return undefined;
  }

  hoverAt(id: string, x: number, y: number, caps?: Caps): void {
    const g: DragState = { id, mode: "loose", startX: x, startY: y, x, y, origin: this.h._model, pointerId: -1, caps };
    this.findTarget(g);
    this.h._guest = g;
  }

  clearGuest(): void {
    if (this.h._guest) this.h._guest = undefined;
  }

  /** Apply the drop a drag state points at to `model` (pure); undefined when it points nowhere. */
  applyDrop(model: DockoramaModel, id: string, d: DragState): DockoramaModel | undefined {
    if (d.edge) return ops.placeAtEdge(model, id, d.edge);
    if (d.gap) return ops.insertBetween(model, id, d.gap.path, d.gap.after, d.gap.win);
    if (d.fill && d.target?.zone) return ops.fillDocs(model, id, d.fill.path, d.fill.win);
    if (d.target?.zone) return ops.place(model, id, d.target.view, d.target.zone);
    return undefined;
  }


  start(e: PointerEvent, id: string, win: string | undefined, target: HTMLElement): void {
    if (e.button !== 0 || this.h.caps(id).move === false) return;
    const w = win ? this.h._model.windows.find((x) => x.key === win) : undefined;
    const soleInWindow = w && ops.viewsIn(w.tree).length === 1;
    this.h._drag = {
      id, mode: "pending", startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, pointerId: e.pointerId,
      windowKey: soleInWindow ? win : undefined, windowStart: soleInWindow ? { ...w!.box } : undefined,
      strip: target.classList.contains("tab") ? (target.closest<HTMLElement>(".tabs") ?? undefined) : undefined,
      origin: this.h._model
    };
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onEnd);
    window.addEventListener("pointercancel", this.onCancel);
    window.addEventListener("keydown", this.onKey, true);
  }

  /** Escape while dragging: put everything back the way it was. */
  private onKey = (e: KeyboardEvent): void => {
    if (e.key !== "Escape" || !this.h._drag) return;
    e.preventDefault();
    e.stopPropagation();
    this.cancel();
  };

  /** Abort the current drag and restore the layout from before it started. */
  cancel(): void {
    const d = this.h._drag;
    if (!d) return;
    this.endListeners();
    this.h._drag = undefined;
    d.peer?.drag.clearGuest();
    if (this.h._model !== d.origin) this.h.commit(d.origin, "cancel", false);
    else this.h.requestUpdate();
    this.h.dispatchEvent(new CustomEvent("dockorama-dragcancel", { detail: { id: d.id }, bubbles: true, composed: true }));
  }

  private onMove = (e: PointerEvent): void => {
    const d = this.h._drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const next: DragState = { ...d, x: e.clientX, y: e.clientY };
    if (next.mode === "pending") {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      next.mode = d.windowKey ? "window" : d.strip ? "tab" : "loose";
      this.h._menu = undefined;
      if (!this.h.emit("dockorama-dragstart", { id: d.id, kind: next.mode as DragKind }, true)) {
        this.endListeners();
        this.h._drag = undefined;
        return;
      }
    }
    if (next.mode === "tab" && next.strip) {
      const r = next.strip.getBoundingClientRect();
      if (e.clientY < r.top - 16 || e.clientY > r.bottom + 16) next.mode = "loose";
      else {
        const tabs = Array.from(next.strip.querySelectorAll<HTMLElement>(".tab")).filter((t) => t.dataset["view"] !== d.id);
        const rtl = getComputedStyle(this.h).direction === "rtl";
        const idx = insertionIndex(tabs.map((t) => t.getBoundingClientRect()), e.clientX, rtl);
        const where = ops.locate(this.h._model, d.id);
        if (where.place === "tree" && where.stack.views.indexOf(d.id) !== idx) {
          this.h.commit(ops.reorder(this.h._model, d.id, idx), "reorder", false);
        }
      }
    }
    if (next.mode === "window" && next.windowKey && next.windowStart) {
      const b = next.windowStart;
      const box = { ...b, x: b.x + e.clientX - d.startX, y: b.y + e.clientY - d.startY };
      this.h._model = ops.moveWindow(this.h._model, next.windowKey, box);
    }
    if (next.mode === "loose" || next.mode === "window") {
      next.sx = e.screenX;
      next.sy = e.screenY;
      next.beyond = next.mode === "loose" && (e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight);
      const peer = next.mode === "loose" && !next.beyond ? this.peerAt(e.clientX, e.clientY) : undefined;
      if (d.peer && d.peer !== peer) d.peer.drag.clearGuest();
      next.peer = peer;
      if (peer) {
        peer.drag.hoverAt(d.id, e.clientX, e.clientY, this.h.caps(d.id));
        for (const k of ["target", "gap", "fill", "edge", "preview"] as const) next[k] = undefined;
      } else if (next.beyond) {
        for (const k of ["target", "gap", "fill", "edge", "preview"] as const) next[k] = undefined;
      } else this.findTarget(next);
    }
    this.h._drag = next;
    this.reportOver(next);
    this.h.requestUpdate();
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
    this.h.emit("dockorama-dragover", s);
  }

  private findTarget(d: DragState): void {
    d.target = undefined;
    d.gap = undefined;
    d.fill = undefined;
    d.edge = undefined;
    d.preview = undefined;
    const main = this.h.mainRect();
    if (main && !(d.caps ?? this.h.caps(d.id)).docsOnly) {
      const edge = hit(edgeSpots(main), d.x, d.y);
      if (edge) {
        d.edge = edge;
        d.preview = previewFor(main, edge);
        return;
      }
    }
    const inWindow = (el: HTMLElement) => el.closest<HTMLElement>("[data-window]");
    const overWindow = Array.from(this.h.renderRoot.querySelectorAll<HTMLElement>("[data-window]")).some((w) => {
      if (w.dataset["window"] === d.windowKey) return false;
      return contains(w.getBoundingClientRect(), d.x, d.y);
    });
    if (!(d.caps ?? this.h.caps(d.id)).docsOnly) {
      const gutters = Array.from(this.h.renderRoot.querySelectorAll<HTMLElement>(".gutter[data-path]"))
        .filter((g) => (overWindow ? inWindow(g) : !inWindow(g)) && g.dataset["win"] !== d.windowKey);
      for (const g of gutters.reverse()) {
        const r = g.getBoundingClientRect();
        if (contains(r, d.x, d.y, 6)) {
          d.gap = { path: pathOf(g), after: Number(g.dataset["after"]), win: g.dataset["win"] || undefined, rect: rectOf(r) };
          const vertical = r.height > r.width;
          const size = 80;
          d.preview = vertical
            ? { left: r.left + r.width / 2 - size / 2, top: r.top, width: size, height: r.height }
            : { left: r.left, top: r.top + r.height / 2 - size / 2, width: r.width, height: size };
          return;
        }
      }
    }
    const stacks = Array.from(this.h.renderRoot.querySelectorAll<HTMLElement>("[data-stack]"))
      .filter((el) => !el.closest(".drawer") && (!d.windowKey || el.dataset["win"] !== d.windowKey));
    // Prefer windows (topmost) over docked groups.
    const under = stacks.reverse().find((el) => contains(el.getBoundingClientRect(), d.x, d.y));
    if (!under) return;
    if (under.hasAttribute("data-empty")) {
      const rect = rectOf(under.getBoundingClientRect());
      d.fill = { path: pathOf(under), win: under.dataset["win"] || undefined, rect };
      const s = compassSpots(rect)[0]!;
      d.target = { view: "", rect, zone: hit([s], d.x, d.y) ?? undefined };
      if (d.target.zone) d.preview = rect;
      return;
    }
    if ((d.caps ?? this.h.caps(d.id)).docsOnly && !under.hasAttribute("data-docs")) return;
    const first = under.querySelector<HTMLElement>(".tab")?.dataset["view"] ?? under.dataset["stack"]!;
    const rect = under.getBoundingClientRect();
    const zone = hit(compassSpots(rect), d.x, d.y);
    d.target = { view: first, rect, zone };
    if (zone) d.preview = previewFor(rect, zone);
  }

  private onEnd = (e: PointerEvent): void => {
    const d = this.h._drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.endListeners();
    this.h._drag = undefined;
    if (d.mode === "pending") return;
    const spot = this.spotOf(d);
    // Reordering inside a strip changes the model during the drag; any other drop is judged against the layout at release,
    // because the origin can already differ (pressing a tab selects it) and a vetoed drop must report moved: false.
    const before = d.mode === "tab" ? d.origin : this.h._model;
    const done = this.finishDrop(d);
    const report = (): void => {
      const detail: DropDetail = { ...spot, moved: this.h._model !== before || done === true };
      this.h.emit("dockorama-drop", detail);
    };
    if (done instanceof Promise) void done.then(report);
    else report();
  };

  /** Apply a drop. Returns true when it handed the view to another manager, a promise for pop-outs. */
  private finishDrop(d: DragState): boolean | Promise<unknown> | void {
    if (d.mode === "tab") {
      this.h.timeline.push(this.h._model);
      this.h.commit(this.h._model, "reorder", false);
      return;
    }
    if (d.peer) {
      if (d.peer.drag.takeGuest(this.h, d.id)) return true;
      this.h.requestUpdate();
      return;
    }
    if (d.mode === "loose" && d.sx !== undefined && d.sy !== undefined) {
      const into = this.h.outside.at(d.sx, d.sy);
      if (into) return this.h.popOut(d.id, { into });
      if (d.beyond) {
        if (this.h.caps(d.id).popout !== false) return this.h.popOut(d.id, { box: { x: d.sx - 60, y: d.sy - 20 } });
        this.h.requestUpdate();
        return;
      }
    }
    if (d.edge) return this.h.dockToEdge(d.id, d.edge);
    if (d.gap) return this.h.dropBetween(d.id, d.gap.path, d.gap.after, d.gap.win);
    if (d.fill && d.target?.zone) return this.h.dropIntoDocs(d.id, d.fill.path, d.fill.win);
    if (d.target?.zone) return this.h.place(d.id, d.target.view, d.target.zone);
    if (d.mode === "window" && d.windowKey && d.windowStart) {
      const w = this.h._model.windows.find((x) => x.key === d.windowKey);
      if (w) {
        const fitted = this.h.fitBox(w.box);
        this.h._model = ops.moveWindow(this.h._model, d.windowKey, d.windowStart);
        this.h.commit(ops.moveWindow(this.h._model, d.windowKey, fitted), "window");
      }
      return;
    }
    // A view that may only live in a document area is not floated by dropping it on empty space.
    if (this.h.caps(d.id).docsOnly) {
      this.h.requestUpdate();
      return;
    }
    const host = this.h.getBoundingClientRect();
    this.h.detach(d.id, { x: d.x - host.left - 40, y: d.y - host.top - 12, w: 360, h: 240 });
  };

  private onCancel = (): void => this.cancel();

  private endListeners(): void {
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onEnd);
    window.removeEventListener("pointercancel", this.onCancel);
    window.removeEventListener("keydown", this.onKey, true);
  }

  /** Drop a view dragged from `source` where this manager's guide points. Returns false when it cannot land. */
  takeGuest(source: DockHost, id: string): boolean {
    const g = this.h._guest;
    this.h._guest = undefined;
    const info = source._model.views[id];
    if (!g || !info || this.h.hasView(id)) return false;
    if (!this.h.emitBefore("dockorama-beforemove", { id, target: g.target?.view, zone: g.edge ?? (g.gap ? "between" : g.target?.zone ?? "into"), from: source })) return false;
    const base = ops.adopt(this.h._model, id, info);
    const next = this.applyDrop(base, id, g) ?? (this.h._model.root ? undefined : ops.reveal(base, id));
    if (!next) return false;
    source.drag.handOver(id, this.h, next);
    return true;
  }

  handOver(id: string, target: DockHost, next: DockoramaModel): void {
    const el = this.h.getViewElement(id);
    this.h.stash.delete(id);
    const make = this.h.factories.get(id);
    this.h.factories.delete(id);
    this.h.shown.delete(id);
    if (this.h._peek === id) this.h._peek = undefined;
    this.h.commit(ops.forget(this.h._model, id), "transfer");
    if (make) target.factories.set(id, make);
    if (el) target.mount(id, el);
    target.shown.delete(id);
    target.commit(next, "transfer");
    const detail = { id, from: this.h, to: target };
    this.h.dispatchEvent(new CustomEvent("dockorama-transfer", { detail: { ...detail, direction: "out" }, bubbles: true, composed: true }));
    target.dispatchEvent(new CustomEvent("dockorama-transfer", { detail: { ...detail, direction: "in" }, bubbles: true, composed: true }));
  }
}
