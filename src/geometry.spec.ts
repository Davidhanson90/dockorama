import { describe, expect, it } from "vitest";
import * as g from "./geometry.js";

const r = { left: 0, top: 0, width: 300, height: 200 };

describe("geometry", () => {
  it("compass and edge spots + hit testing", () => {
    const c = g.compassSpots(r);
    expect(c.map((s) => s.zone)).toEqual(["into", "left", "right", "above", "below"]);
    expect(g.hit(c, 150, 100)).toBe("into");
    expect(g.hit(c, 110, 100)).toBe("left");
    expect(g.hit(c, 5, 5)).toBeUndefined();
    const e = g.edgeSpots(r);
    expect(g.hit(e, 24, 100)).toBe("edge-left");
    expect(g.hit(e, 150, 176)).toBe("edge-below");
  });
  it("previews", () => {
    expect(g.previewFor(r, "left")).toEqual({ ...r, width: 150 });
    expect(g.previewFor(r, "right").left).toBe(150);
    expect(g.previewFor(r, "above").height).toBe(100);
    expect(g.previewFor(r, "below").top).toBe(100);
    expect(g.previewFor(r, "into")).toEqual(r);
    expect(g.previewFor(r, "edge-left").width).toBeCloseTo(99);
  });
  it("insertion index (ltr and rtl)", () => {
    const tabs = [0, 100, 200].map((left) => ({ left, top: 0, width: 100, height: 20 }));
    expect(g.insertionIndex(tabs, 10)).toBe(0);
    expect(g.insertionIndex(tabs, 160)).toBe(2);
    expect(g.insertionIndex(tabs, 290, true)).toBe(0);
  });
  it("snap and clamp", () => {
    expect(g.snapBox({ x: 13, y: 26, w: 101, h: 3 }, 10)).toEqual({ x: 10, y: 30, w: 100, h: 10 });
    expect(g.snapBox({ x: 13, y: 26, w: 101, h: 3 }, 0)).toEqual({ x: 13, y: 26, w: 101, h: 3 });
    expect(g.clampBox({ x: -999, y: -5, w: 50, h: 5000 }, 800, 600)).toEqual({ x: -120, y: 0, w: 160, h: 600 });
  });
  it("shares space with a minimum", () => {
    expect(g.shareSpace([100, 100, 100], 0, 30)).toEqual([130, 70, 100]);
    expect(g.shareSpace([100, 100], 0, 500)).toEqual([152, 48]);
    expect(g.shareSpace([100, 100], 0, -500)).toEqual([48, 152]);
  });
});
