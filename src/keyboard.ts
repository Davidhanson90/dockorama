import { pathOf, stackEls } from "./dom.js";
import { previewFor, rectOf } from "./geometry.js";
import type { DockHost, DragState } from "./host.js";
import type { DropZone, EdgeZone } from "./model.js";
import * as ops from "./ops.js";
import type { Rect } from "./geometry.js";

type MoveTarget = { view: string; rect: Rect; label: string; path?: number[]; win?: string; empty?: boolean } | { edge: true; rect: Rect; label: string };

const SIDES: Record<string, DropZone> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "above", ArrowDown: "below" };
const EDGES: Record<string, EdgeZone> = { ArrowLeft: "edge-left", ArrowRight: "edge-right", ArrowUp: "edge-above", ArrowDown: "edge-below" };

/** `Alt+<letter>` shortcuts on the focused view. */
const ALT_SHORTCUTS: Record<string, (h: DockHost, id: string) => void> = {
  z: (h, id) => h.toggleZoom(id),
  m: (h, id) => void h.beginMove(id),
  h: (h, id) => h.stow(id),
  f: (h, id) => h.detach(id)
};

/** Keyboard shortcuts, keyboard docking ("move mode"), and focus movement between groups. */
export class KeyboardController {
  constructor(private readonly h: DockHost) {}

  /** Drop targets for keyboard docking: every visible group except the moving view's own lone group, then the outer edge. */
  private moveTargets(id: string): MoveTarget[] {
    const where = ops.locate(this.h._model, id);
    const lone = where.place === "tree" && where.stack.views.length === 1 ? where.stack.views[0] : undefined;
    const out: MoveTarget[] = [];
    for (const el of stackEls(this.h.renderRoot)) {
      if (el.closest(".drawer")) continue;
      const empty = el.hasAttribute("data-empty");
      const view = empty ? "" : (el.querySelector<HTMLElement>(".tab")?.dataset["view"] ?? el.dataset["stack"]!);
      if (view && view === lone) continue;
      const r = el.getBoundingClientRect();
      const label = empty ? this.h.t.emptyDocs : (el.getAttribute("aria-label") ?? view);
      out.push({ view, rect: rectOf(r), label, empty,
        path: pathOf(el), win: el.dataset["win"] || undefined });
    }
    const main = this.h.mainRect();
    if (main && !this.h.caps(id).docsOnly) out.push({ edge: true, rect: main, label: this.h.t.outerEdge });
    return out;
  }

  /**
   * Start moving a view with the keyboard (default: the focused one; shortcut `Alt+M`). Tab / Shift+Tab choose a
   * group (or the outer edge), arrow keys a side, Enter drops, Escape cancels. Progress is announced in a live region.
   * Returns false when the view cannot move.
   */
  begin(id = this.h._model.focus): boolean {
    if (!id || this.h.caps(id).move === false || ops.locate(this.h._model, id).place !== "tree") return false;
    const targets = this.moveTargets(id);
    if (!targets.length) return false;
    const first = "edge" in targets[0]! ? "edge-left" : "into";
    this.h._keyMove = { id, index: 0, zone: first };
    this.h._say = `${this.h.t.moveMode.replace("{title}", this.h._model.views[id]?.title ?? id)} ${this.describe()}`;
    return true;
  }

  /** Stop keyboard docking without moving. */
  cancel(): void {
    if (!this.h._keyMove) return;
    this.h._keyMove = undefined;
    this.h._say = this.h.t.moveCancelled;
  }

  describe(): string {
    const k = this.h._keyMove;
    if (!k) return "";
    const target = this.moveTargets(k.id)[k.index];
    return target ? this.h.t.moveTarget.replace("{target}", target.label).replace("{zone}", k.zone) : "";
  }

  /** The keyboard move as a drag state, for the drop guide. */
  guide(): DragState | undefined {
    const k = this.h._keyMove;
    if (!k) return undefined;
    const t = this.moveTargets(k.id)[k.index];
    if (!t) return undefined;
    const d: DragState = { id: k.id, mode: "window", startX: 0, startY: 0, x: 0, y: 0, origin: this.h._model, pointerId: -1 };
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
    const k = this.h._keyMove;
    if (!k) return false;
    const targets = this.moveTargets(k.id);
    const t = targets[k.index];
    if (e.key === "Escape") this.cancel();
    else if (e.key === "Tab") {
      const index = (k.index + (e.shiftKey ? targets.length - 1 : 1)) % targets.length;
      const next = targets[index]!;
      this.h._keyMove = { ...k, index, zone: "edge" in next ? "edge-left" : "into" };
      this.h._say = this.describe();
    } else if (SIDES[e.key] && t) {
      const zone = "edge" in t ? EDGES[e.key]! : t.empty ? "into" : k.zone === SIDES[e.key] ? "into" : SIDES[e.key]!;
      this.h._keyMove = { ...k, zone };
      this.h._say = this.describe();
    } else if (e.key === "Enter" || e.key === " ") {
      this.h._keyMove = undefined;
      const title = this.h._model.views[k.id]?.title ?? k.id;
      if (t && "edge" in t) this.h.dockToEdge(k.id, k.zone as EdgeZone);
      else if (t?.empty) this.h.dropIntoDocs(k.id, t.path ?? [], t.win);
      else if (t) this.h.place(k.id, t.view, k.zone as DropZone);
      this.h._say = this.h.t.moveDone.replace("{title}", title);
    } else return true;
    e.preventDefault();
    e.stopPropagation();
    return true;
  }

  /** Global shortcuts (and keyboard docking while it is active). */
  onKey = (e: KeyboardEvent): void => {
    const { h } = this;
    if (h._keyMove && this.onMoveKey(e)) return;
    const focus = h._model.focus;
    const { key } = e;
    const mod = e.ctrlKey || e.metaKey;
    const run = (fn: () => void) => this.handled(e, fn);
    if (mod && key === ".") return run(() => h.openPalette());
    if (mod && e.altKey && key.toLowerCase() === "z") return run(() => h.undo());
    if (mod && e.altKey && key.toLowerCase() === "y") return run(() => h.redo());
    if (key === "Escape") {
      if (h._peek) return run(() => { h._peek = undefined; });
      if (h._model.zoom) return run(() => h.toggleZoom());
    }
    if (!e.altKey || !focus) return;
    const side = SIDES[key];
    if (side) return run(() => (e.shiftKey ? this.nudge(focus, side) : this.focusNeighbour(side)));
    if (key === "PageDown" || key === "PageUp") return run(() => this.cycleTab(focus, key === "PageDown" ? 1 : -1));
    if (key === "Backspace") return run(() => h.dismiss(focus));
    const action = ALT_SHORTCUTS[key.toLowerCase()];
    if (action) run(() => action(h, focus));
  };

  private handled(e: KeyboardEvent, fn: () => void): void {
    e.preventDefault();
    e.stopPropagation();
    fn();
  }

  /** Split the focused view off its group to one side (or move it beside its group). */
  nudge(id: string, zone: DropZone): void {
    const where = ops.locate(this.h._model, id);
    if (where.place !== "tree") return;
    const other = where.stack.views.find((v) => v !== id);
    if (other) return this.h.place(id, other, zone);
    const edge = ({ left: "edge-left", right: "edge-right", above: "edge-above", below: "edge-below" } as const)[zone as "left"];
    if (edge && !where.window) this.h.dockToEdge(id, edge);
  }

  /** Select the next/previous tab in the focused view's group. */
  cycleTab(id: string, step: number): void {
    const where = ops.locate(this.h._model, id);
    if (where.place !== "tree") return;
    const v = where.stack.views;
    const next = v[(v.indexOf(id) + step + v.length) % v.length];
    if (next) this.h.reveal(next);
  }

  /** Move focus to the nearest visible group in a direction. */
  focusNeighbour(zone: DropZone): void {
    const els = stackEls(this.h.renderRoot);
    const cur = els.find((el) => el.hasAttribute("data-active"));
    if (!cur) {
      const first = els[0]?.dataset["stack"];
      if (first) this.h.activate(first);
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
      if (id) this.h.activate(id);
      (tab ?? best.el.querySelector<HTMLElement>(".btn"))?.focus();
    }
  }
}
