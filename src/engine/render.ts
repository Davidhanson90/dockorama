import { html, nothing, type TemplateResult } from "lit";
import { DockoramaPart, type DockContext } from "../components/index.js";
import { renderNode } from "../components/tree.js";
import type { DockHost } from "./host.js";
import type { Side } from "../core/model.js";
import * as ops from "../core/ops.js";
import { renderConfirm, renderFlyout, renderGuide, renderNotice } from "./overlays.js";

/** Work that needs the parts' DOM: focus restore and first-show events. */
export async function afterParts(h: DockHost): Promise<void> {
  for (const el of Array.from(h.renderRoot.querySelectorAll("*"))) {
    if (el instanceof DockoramaPart) await el.updateComplete;
  }
  if (h.keepFocus) {
    h.keepFocus = false;
    if (!h.hasFocus() && !h._palette && !h._menu) {
      const active = h.renderRoot.querySelector<HTMLElement>("[data-stack][data-active]");
      (active?.querySelector<HTMLElement>('.tab[data-selected]') ?? active)?.focus({ preventScroll: true });
    }
  }
  h.views.syncVisible();
  h.views.applyRetain();
}

function context(h: DockHost): DockContext {
  const g = h._drag?.gap;
  return {
    model: h._model,
    labels: h.t,
    popped: new Set((h._model.outside ?? []).flatMap((o) => o.views)),
    gap: g ? { path: g.path.join("."), after: g.after, win: g.win ?? "" } : undefined,
    dragging: Boolean(h._drag),
    dirty: new Set(h.closing.dirtySet)
  };
}

export function renderDock(h: DockHost): TemplateResult {
  const m = h._model;
  const ctx = context(h);
  const zoomed = m.zoom ? ops.locate(m, m.zoom) : undefined;
  const body = zoomed?.place === "tree"
    ? renderNode(zoomed.stack, [], zoomed.window, ctx)
    : m.root
      ? renderNode(m.root, [], undefined, ctx)
      : html`<div class="empty">${h.t.emptyDocs}</div>`;
  const rail = (side: Side) => m.drawers[side].length
    ? html`<dockorama-rail .side=${side} .views=${m.drawers[side]} .open=${h._peek} .ctx=${ctx}></dockorama-rail>`
    : nothing;
  return html`<div class="frame" part="frame" dir=${getComputedStyle(h).direction || "ltr"}>
    ${rail("top")}
    <div class="middle">
      ${rail("start")}
      <div class="main" part="main">${body}${renderFlyout(h, ctx)}</div>
      ${rail("end")}
    </div>
    ${rail("bottom")}
    ${m.windows.map((w, i) => html`<dockorama-window .key=${w.key} .box=${w.box} .tree=${w.tree} .layer=${i} .ctx=${ctx}></dockorama-window>`)}
    ${renderGuide(h)}
    ${h.menus.renderMenu()}
    ${h.menus.renderTabMenu()}
    ${h.menus.renderPalette()}
    ${renderNotice(h)}
    ${renderConfirm(h)}
    <div class="sr" role="status" aria-live="polite">${h._say}</div>
  </div>`;
}
