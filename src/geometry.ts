import type { Box, DropZone, EdgeZone } from "./model.js";

export interface Rect { left: number; top: number; width: number; height: number; }
export interface Spot<Z extends string> { zone: Z; x: number; y: number; }

/** Five drop targets around the centre of a group. */
export function compassSpots(r: Rect, gap = 40): Array<Spot<DropZone>> {
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const g = Math.min(gap, r.width / 3, r.height / 3);
  return [
    { zone: "into", x: cx, y: cy },
    { zone: "left", x: cx - g, y: cy },
    { zone: "right", x: cx + g, y: cy },
    { zone: "above", x: cx, y: cy - g },
    { zone: "below", x: cx, y: cy + g }
  ];
}

/** Four drop targets near the outer edges of the whole layout. */
export function edgeSpots(r: Rect, inset = 24): Array<Spot<EdgeZone>> {
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return [
    { zone: "edge-left", x: r.left + inset, y: cy },
    { zone: "edge-right", x: r.left + r.width - inset, y: cy },
    { zone: "edge-above", x: cx, y: r.top + inset },
    { zone: "edge-below", x: cx, y: r.top + r.height - inset }
  ];
}

/** The spot under a point, if any. */
export function hit<Z extends string>(spots: Array<Spot<Z>>, x: number, y: number, radius = 17): Z | undefined {
  return spots.find((s) => Math.abs(s.x - x) <= radius && Math.abs(s.y - y) <= radius)?.zone;
}

/** Where the dropped view would end up, for the translucent preview. */
export function previewFor(r: Rect, zone: DropZone | EdgeZone, share = 0.5): Rect {
  const z = zone.replace("edge-", "") as DropZone;
  const s = zone.startsWith("edge-") ? Math.min(share, 0.33) : share;
  switch (z) {
    case "left": return { ...r, width: r.width * s };
    case "right": return { ...r, left: r.left + r.width * (1 - s), width: r.width * s };
    case "above": return { ...r, height: r.height * s };
    case "below": return { ...r, top: r.top + r.height * (1 - s), height: r.height * s };
    default: return { ...r };
  }
}

/** Insertion index for a tab dropped at `x` among tab rects (visual order). */
export function insertionIndex(rects: Rect[], x: number, rtl = false): number {
  let i = 0;
  for (const r of rects) {
    const mid = r.left + r.width / 2;
    if (rtl ? x < mid : x > mid) i++;
  }
  return i;
}

/** Snap a window box to a grid. */
export function snapBox(b: Box, grid: number): Box {
  if (!grid || grid < 2) return b;
  const s = (v: number) => Math.round(v / grid) * grid;
  return { x: s(b.x), y: s(b.y), w: Math.max(grid, s(b.w)), h: Math.max(grid, s(b.h)) };
}

/** Keep a window box reachable inside a container. */
export function clampBox(b: Box, width: number, height: number, minW = 160, minH = 90): Box {
  const w = Math.max(minW, Math.min(b.w, Math.max(minW, width)));
  const h = Math.max(minH, Math.min(b.h, Math.max(minH, height)));
  const x = Math.min(Math.max(b.x, 40 - w), Math.max(0, width - 40));
  const y = Math.min(Math.max(b.y, 0), Math.max(0, height - 30));
  return { x, y, w, h };
}

/** Resize two neighbouring cells by `delta` px, honouring a minimum; returns new pixel sizes. */
export function shareSpace(sizes: number[], index: number, delta: number, min = 48): number[] {
  const out = [...sizes];
  const a = out[index]!;
  const b = out[index + 1]!;
  const d = Math.max(min - a, Math.min(delta, b - min));
  out[index] = a + d;
  out[index + 1] = b - d;
  return out;
}
