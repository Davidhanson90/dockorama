import type { DockHost } from "./host.js";
import type { Box, DropZone, EdgeZone, Side } from "./model.js";
import * as ops from "./ops.js";

/** The layout operations behind the manager's public methods: each checks `caps`, asks `dockorama-beforemove` where it applies, then commits. */
export class LayoutActions {
  constructor(private readonly h: DockHost) {}

  place(id: string, target: string, zone: DropZone, index?: number): void {
    if (!this.allowMove(id, target, zone)) return;
    this.h.commit(ops.place(this.h._model, id, target, zone, index), "place");
  }
  dockToEdge(id: string, zone: EdgeZone): void {
    if (this.h.caps(id).docsOnly) return;
    if (!this.h.emitBefore("dockorama-beforemove", { id, zone })) return;
    this.h.commit(ops.placeAtEdge(this.h._model, id, zone), "edge");
  }
  dropBetween(id: string, path: number[], after: number, windowKey?: string): void {
    if (this.h.caps(id).move === false || this.h.caps(id).docsOnly) return;
    if (!this.h.emitBefore("dockorama-beforemove", { id, zone: "between" })) return;
    this.h.commit(ops.insertBetween(this.h._model, id, path, after, windowKey), "place");
  }
  dropIntoDocs(id: string, path: number[], windowKey?: string): void {
    if (this.h.caps(id).move === false) return;
    if (!this.h.emitBefore("dockorama-beforemove", { id, zone: "into" })) return;
    this.h.commit(ops.fillDocs(this.h._model, id, path, windowKey), "place");
  }
  detach(id: string, box?: Box): void {
    if (this.h.caps(id).float === false || this.h.caps(id).docsOnly) return;
    const b = box ?? this.h.defaultBox();
    this.h.commit(ops.detach(this.h._model, id, this.h.fitBox(b)), "detach");
  }
  stow(id: string, side?: Side): void {
    if (this.h.caps(id).hide === false) return;
    if (this.h._peek === id) this.h._peek = undefined;
    this.h.commit(ops.stow(this.h._model, id, side), "stow");
  }
  unstow(id: string): void {
    this.h._peek = undefined;
    this.h.commit(ops.unstow(this.h._model, id), "unstow");
  }
  showPreview(id: string): void {
    if (!this.h.hasView(id)) return;
    const where = ops.locate(this.h._model, id);
    if (where.place === "tree" && !where.stack.preview) return this.reveal(id);
    const shown = where.place === "tree" ? ops.select(this.h._model, id) : ops.reveal(this.h._model, id);
    this.h.commit(ops.setPreview(shown, id).model, where.place === "tree" ? "select" : "reveal");
  }
  reveal(id: string): void {
    const where = ops.locate(this.h._model, id);
    if (where.place === "drawer") {
      this.h.router.openPeek(id);
      this.h.commit(this.h._model, "focus", false);
      return;
    }
    this.h.commit(ops.reveal(this.h._model, id), where.place === "tree" ? "select" : "reveal");
  }
  toggleZoom(id?: string): void {
    if (id && this.h.caps(id).zoom === false) return;
    this.h.commit(ops.toggleZoom(this.h._model, id ?? this.h._model.focus), "zoom");
  }
  activate(id: string): void {
    if (this.h._model.focus === id) return;
    const where = ops.locate(this.h._model, id);
    const m = where.place === "tree" ? ops.select(this.h._model, id) : { ...this.h._model, focus: id };
    this.h.commit(m, "focus", false);
  }

  private allowMove(id: string, target: string, zone: DropZone): boolean {
    if (this.h.caps(id).move === false) return false;
    if (this.h.caps(id).docsOnly) {
      const where = ops.locate(this.h._model, target);
      if (where.place !== "tree" || !where.stack.docs || zone !== "into") return false;
    }
    return this.h.emitBefore("dockorama-beforemove", { id, target, zone });
  }
}
