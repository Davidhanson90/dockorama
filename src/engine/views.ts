import { slotOf } from "../components/context.js";
import { attr } from "../utils/dom.js";
import type { BeforeAddDetail } from "../core/events.js";
import type { DockHost } from "./host.js";
import type { DropZone, ViewContent, ViewInfo, ViewOptions, ViewSpot } from "../core/model.js";
import * as ops from "../core/ops.js";

const isContent = (v: unknown): v is ViewContent =>
  typeof v === "string" || typeof v === "function" || (typeof Element !== "undefined" && v instanceof Element);

/** Plain-text view body: never HTML, padded via `.dockorama-text` / `--dk-text-padding`. */
const textNode = (text: string): HTMLElement => {
  const el = document.createElement("div");
  el.className = "dockorama-text";
  el.textContent = text;
  return el;
};

/** The views' content elements: registration, lazy factories, mounting, and `retain="active"` detaching. */
export class ViewRegistry {
  /** Detached content of hidden views (with `retain="active"`). */
  readonly stash = new Map<string, Element>();
  readonly factories = new Map<string, () => Element>();
  /** Views whose content slot has been on screen at least once. */
  readonly shown = new Set<string>();
  /** Views whose content slot was on screen after the last render. */
  private visible = new Set<string>();

  constructor(private readonly h: DockHost) {}

  /** `at` with a `float` spot turned into a window box that fits this manager. */
  resolveSpot(at: ViewSpot): Parameters<typeof ops.enlist>[3] {
    const { h } = this;
    return typeof at === "object" && "float" in at ? { float: h.fitBox({ ...h.defaultBox(), ...(at.float === true ? {} : at.float) }) } : (at as Exclude<ViewSpot, { float: unknown }>);
  }

  /** The content element of a view (null if unknown, or lazy and not yet shown). */
  elementOf(id: string): Element | null {
    return this.h.outside.elementOf(id) ?? this.h.querySelector(`:scope > [data-view=${attr(id)}]`) ?? this.stash.get(id) ?? null;
  }

  mount(id: string, el: Element): void {
    el.setAttribute("data-view", id);
    el.setAttribute("slot", slotOf(id));
    if (el.parentNode !== this.h) this.h.append(el);
  }


  add(id: string, content: ViewContent | ViewInfo, extra?: ViewOptions | { view: string; zone: DropZone }): void {
    const spot0 = isContent(content) ? ((extra ?? {}) as ViewOptions).at : undefined;
    const title = isContent(content) ? (((extra ?? {}) as ViewOptions).title ?? id) : content.title;
    const ask: BeforeAddDetail = spot0 === undefined ? { id, title } : { id, title, at: spot0 };
    if (!this.h.emit("dockorama-beforeadd", ask, true)) return;
    if (!isContent(content)) {
      this.h.commit(ops.addView(this.h._model, id, content, extra as { view: string; zone: DropZone } | undefined), "add");
      return;
    }
    const { at = "auto", preview, ...rest } = (extra ?? {}) as ViewOptions;
    const info: ViewInfo = { ...rest, title: rest.title ?? id };
    if (typeof content === "function") info.lazy = true;
    const spot = this.resolveSpot(at);
    let next = ops.enlist(this.h._model, id, info, spot);
    if (preview) next = ops.setPreview(next, id).model;
    if (typeof content === "function") {
      this.factories.set(id, content);
    } else {
      const el = typeof content === "string" ? textNode(content) : content;
      this.mount(id, el);
    }
    this.shown.delete(id);
    this.h.commit(next, "add");
  }

  remove(id: string, options: { keepElement?: boolean } = {}): Element | null {
    const el = this.h.getViewElement(id);
    this.factories.delete(id);
    this.shown.delete(id);
    if (id in this.h._model.views) this.h.commit(ops.forget(this.h._model, id), "forget");
    this.stash.delete(id);
    if (el && !options.keepElement) el.remove();
    return el;
  }

  /** Fire `dockorama-viewshow` / `dockorama-viewhide` for slots that appeared or went away, and build lazy views on first show. */
  syncVisible(): void {
    const now = new Set<string>();
    for (const slot of Array.from(this.h.renderRoot.querySelectorAll<HTMLSlotElement>("slot[name]"))) {
      const id = slot.name.slice(2);
      now.add(id);
      if (this.visible.has(id)) continue;
      const first = !this.shown.has(id);
      if (first) {
        this.shown.add(id);
        const make = this.factories.get(id);
        if (make) {
          this.factories.delete(id);
          this.mount(id, make());
        }
      }
      this.h.emit("dockorama-viewshow", { id, first });
    }
    for (const id of this.visible) if (!now.has(id)) this.h.emit("dockorama-viewhide", { id });
    this.visible = now;
  }

  /** Detach hidden contents / re-attach shown ones according to `retain`. */
  applyRetain(): void {
    const visible = new Set(Array.from(this.h.renderRoot.querySelectorAll<HTMLSlotElement>("slot[name]")).map((s) => s.name.slice(2)));
    const active = this.h.retain === "active";
    for (const [id, el] of Array.from(this.stash)) {
      if (!active || visible.has(id) || !(id in this.h._model.views) || this.h._model.views[id]?.keepAlive) {
        this.stash.delete(id);
        this.h.append(el);
      }
    }
    if (!active) return;
    for (const el of Array.from(this.h.querySelectorAll(":scope > [data-view]"))) {
      const id = el.getAttribute("data-view")!;
      if (visible.has(id) || this.h._model.views[id]?.keepAlive || !(id in this.h._model.views)) continue;
      this.stash.set(id, el);
      el.remove();
    }
  }
}
