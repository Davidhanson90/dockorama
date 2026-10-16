import { slotOf } from "../components/context.js";
import { managers } from "./drag.js";
import type { DockHost } from "./host.js";

/** What a manager wires up while it is in the document: content slotting, listeners, direction and skin watching. */
export class Lifecycle {
  private slots?: MutationObserver;
  private dirWatch?: MutationObserver;
  private lastDir = "ltr";

  constructor(private readonly h: DockHost) {}

  connect(): void {
    const { h } = this;
    this.assignSlots();
    this.slots = new MutationObserver(() => this.assignSlots());
    this.slots.observe(h, { childList: true, attributes: true, attributeFilter: ["data-view"] });
    h.addEventListener("keydown", h.keys.onKey);
    h.addEventListener("input", h.router.onInput);
    h.renderRoot.addEventListener("dockorama-request", h.router.onRequest);
    document.addEventListener("pointerdown", h.router.onOutside, true);
    window.addEventListener("pagehide", h.outside.onUnload);
    managers.add(h);
    h.skinning.watch();
    // Direction comes from CSS (usually a `dir` attribute on this element or an ancestor): re-render when it changes.
    this.lastDir = getComputedStyle(h).direction;
    this.dirWatch = new MutationObserver(() => {
      const now = getComputedStyle(h).direction;
      if (now === this.lastDir) return;
      this.lastDir = now;
      h.requestUpdate();
    });
    this.dirWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["dir", "lang"], subtree: true });
    h.outside.reconcile(true);
  }

  disconnect(): void {
    const { h } = this;
    this.slots?.disconnect();
    this.dirWatch?.disconnect();
    h.removeEventListener("keydown", h.keys.onKey);
    h.removeEventListener("input", h.router.onInput);
    h.renderRoot.removeEventListener("dockorama-request", h.router.onRequest);
    document.removeEventListener("pointerdown", h.router.onOutside, true);
    window.removeEventListener("pagehide", h.outside.onUnload);
    managers.delete(h);
    h.skinning.unwatch();
  }

  /** Give every `data-view` child the slot its view renders into. */
  assignSlots(): void {
    for (const child of Array.from(this.h.children)) {
      const id = child.getAttribute("data-view");
      if (id && child.getAttribute("slot") !== slotOf(id)) child.setAttribute("slot", slotOf(id));
    }
  }
}
