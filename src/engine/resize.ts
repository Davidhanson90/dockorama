import type { DockHost } from "./host.js";
import { shareSpace, snapBox } from "../core/geometry.js";
import type { ResizeDetail, SplitNode } from "../core/contracts.js";
import * as ops from "../core/ops.js";

/** Resizing: split gutters (pointer and keyboard), folding cells, and floating-window grips, with their resize events. */
export class ResizeController {
  constructor(private readonly h: DockHost) {}

  gutter(e: PointerEvent, path: number[], index: number, axis: "row" | "column", win: string | undefined, gutter: HTMLElement): void {
    if (e.button !== 0) return;
    e.preventDefault();
    const sizes = this.cellSizes(gutter, axis);
    const start = axis === "row" ? e.clientX : e.clientY;
    const rtl = axis === "row" && getComputedStyle(this.h).direction === "rtl";
    const before = this.h._model;
    let base = this.h._model;
    for (const i of [index, index + 1]) if (this.splitAt(path, win)?.folded?.[i]) base = ops.fold(base, path, i, false, win);
    const split = this.splitAt(path, win);
    gutter.toggleAttribute("data-live", true);
    const live = this.liveResize(() => this.splitResize(path, win));
    const move = (ev: PointerEvent) => {
      const delta = ((axis === "row" ? ev.clientX : ev.clientY) - start) * (rtl ? -1 : 1);
      const next = this.limitPair(split, index, shareSpace(sizes, index, delta));
      this.h._model = split?.fixed || split?.limits
        ? ops.resizeCells(base, path, next, win)
        : ops.setWeights(base, path, next.map((n) => Math.max(1, n)), win);
      live();
      this.h.requestUpdate();
    };
    const up = () => {
      gutter.removeAttribute("data-live");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      live.stop();
      if (this.h._model !== before) {
        this.h.timeline.push(before);
        this.h.commit(this.h._model, "resize", false);
        this.emitResize(this.splitResize(path, win));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  key(e: KeyboardEvent, path: number[], index: number, axis: "row" | "column", weights: number[], win?: string, source?: HTMLElement): void {
    const split = this.splitAt(path, win);
    const gutter = source ?? (e.target as HTMLElement | null)?.closest?.(".gutter") as HTMLElement | null;
    const px = !!(split?.fixed || split?.limits) && !!gutter;
    const sizes = px ? this.cellSizes(gutter!, axis) : weights;
    const [grow, shrink] = axis === "row" ? ["ArrowRight", "ArrowLeft"] : ["ArrowDown", "ArrowUp"];
    const total = sizes.reduce((a, b) => a + b, 0);
    const steps: Record<string, number> = { [grow!]: total * 0.03, [shrink!]: -total * 0.03, Home: -total, End: total };
    let delta = steps[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    if (getComputedStyle(this.h).direction === "rtl" && axis === "row" && e.key.startsWith("Arrow")) delta = -delta;
    const next = this.limitPair(split, index, shareSpace(sizes, index, delta, px ? 0 : total * 0.05));
    this.h.commit(px ? ops.resizeCells(this.h._model, path, next, win) : ops.setWeights(this.h._model, path, next, win), "resize");
    this.emitResize(this.splitResize(path, win));
  }

  /** Resize detail for the split at `path`: weights, or px sizes where cells are fixed/limited. */
  private splitResize(path: number[], win?: string): ResizeDetail | undefined {
    const split = this.splitAt(path, win);
    if (!split) return undefined;
    return { kind: "split", path, ...(win ? { window: win } : {}), sizes: split.weights.slice() };
  }

  private emitResize(detail: ResizeDetail | undefined): void {
    if (detail) this.h.emit("dockorama-resize", detail);
  }

  /** A live-resize reporter: fires `dockorama-resizing` at most once per animation frame. */
  private liveResize(read: () => ResizeDetail | undefined): (() => void) & { stop(): void } {
    let frame = 0;
    const fn = (() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const d = read();
        if (d) this.h.emit("dockorama-resizing", d);
      });
    }) as (() => void) & { stop(): void };
    fn.stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    return fn;
  }

  private splitAt(path: number[], win?: string): SplitNode | undefined {
    const tree = win ? this.h._model.windows.find((w) => w.key === win)?.tree ?? null : this.h._model.root;
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
  fold(path: number[], index: number, win?: string, gutter?: HTMLElement): void {
    const split = this.splitAt(path, win);
    if (!split) return;
    const open = [index, index + 1].find((i) => split.folded?.[i]);
    if (open !== undefined) return this.h.commit(ops.fold(this.h._model, path, open, false, win), "resize");
    const sizes = gutter ? this.cellSizes(gutter, split.axis) : [];
    const a = sizes[index] || split.weights[index] || 0;
    const b = sizes[index + 1] || split.weights[index + 1] || 0;
    this.h.commit(ops.fold(this.h._model, path, b < a ? index + 1 : index, true, win), "resize");
  }

  grip(e: PointerEvent, key: string): void {
    e.preventDefault();
    e.stopPropagation();
    const w = this.h._model.windows.find((x) => x.key === key);
    if (!w) return;
    const start = { ...w.box };
    const before = this.h._model;
    const read = (): ResizeDetail | undefined => {
      const box = this.h._model.windows.find((x) => x.key === key)?.box;
      return box ? { kind: "window", window: key, box: { ...box } } : undefined;
    };
    const live = this.liveResize(read);
    const move = (ev: PointerEvent) => {
      const box = snapBox({ ...start, w: Math.max(160, start.w + ev.clientX - e.clientX), h: Math.max(90, start.h + ev.clientY - e.clientY) }, this.h.snap);
      this.h._model = ops.moveWindow(this.h._model, key, box);
      live();
      this.h.requestUpdate();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      live.stop();
      this.h.timeline.push(before);
      this.h.commit(this.h._model, "window", false);
      this.emitResize(read());
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
}
