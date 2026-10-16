import { attr } from "./dom.js";
import type { DockHost } from "./host.js";
import * as ops from "./ops.js";

/** Closing views: veto and confirmation (`dockorama-beforeclose`, `confirmClose`), and the unsaved-changes ("dirty") set. */
export class ClosingController {
  readonly dirtySet = new Set<string>();

  constructor(private readonly h: DockHost) {}

  dismiss(id: string): Promise<boolean> {
    if (this.h.caps(id).dismiss === false) return Promise.resolve(false);
    const place = ops.locate(this.h._model, id).place;
    if (place === "parked" || place === "nowhere") return Promise.resolve(false);
    if (!this.h.emitBefore("dockorama-beforeclose", { id })) return Promise.resolve(false);
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
    if (this.h._peek === id) this.h._peek = undefined;
    if (this.dirtySet.has(id)) this.setDirty(id, false);
    const before = this.h._model;
    const hadFocus = before.focus === id;
    this.h.commit(ops.dismiss(this.h._model, id), "dismiss");
    if (before !== this.h._model) this.h.emit("dockorama-close", { id });
    // The focused view closed: keep model focus and DOM focus together on the view that took its place.
    const next = this.h._model.focus;
    if (hadFocus && next && next !== id) {
      void this.h.updateComplete.then(() => {
        const root = this.h.renderRoot;
        const el = root.querySelector<HTMLElement>(`[id=${attr(`tab-${next}`)}]`) ?? root.querySelector<HTMLElement>(`[data-stack="${next}"]`);
        el?.focus({ preventScroll: true });
      });
    }
  }

  /** Ask `confirmClose`, or show the built-in dialog, before a dirty view closes. */
  private askClose(id: string): Promise<boolean> {
    if (this.h.confirmClose) {
      try {
        return Promise.resolve(this.h.confirmClose(id)).then(Boolean, () => false);
      } catch {
        return Promise.resolve(false);
      }
    }
    this.h._confirm?.done(false);
    return new Promise<boolean>((done) => {
      this.h._confirm = { id, done };
      void this.h.updateComplete.then(() => this.h.renderRoot.querySelector<HTMLElement & { focusSafe(): void }>("dockorama-confirm")?.focusSafe());
    });
  }

  setDirty(id: string, dirty = true): void {
    if (this.dirtySet.has(id) === dirty) return;
    if (dirty) this.dirtySet.add(id);
    else this.dirtySet.delete(id);
    if (dirty) this.h.promote(id);
    this.h.emit("dockorama-dirty", { id, dirty });
    this.h.requestUpdate();
  }
  isDirty(id: string): boolean {
    return this.dirtySet.has(id);
  }
  get dirtyViews(): string[] {
    return [...this.dirtySet];
  }

  dismissMany(ids: string[]): string[] {
    const done: string[] = [];
    const later: string[] = [];
    let m = this.h._model;
    for (const id of ids) {
      if (this.dirtySet.has(id)) {
        later.push(id);
        continue;
      }
      if (this.h.caps(id).dismiss === false || !this.h.emitBefore("dockorama-beforeclose", { id })) continue;
      m = ops.dismiss(m, id);
      done.push(id);
    }
    if (done.length) {
      this.h.commit(m, "dismiss");
      for (const id of done) this.h.emit("dockorama-close", { id });
    }
    // Views with unsaved changes ask one at a time.
    void later.reduce((p, id) => p.then(() => this.dismiss(id)), Promise.resolve(true));
    return done;
  }
}
