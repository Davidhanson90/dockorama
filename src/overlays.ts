import { html, nothing, type TemplateResult } from "lit";
import type { DockContext, GuideSpot } from "./components/index.js";
import { compassSpots, edgeSpots, type Spot } from "./geometry.js";
import type { DockHost } from "./host.js";
import * as ops from "./ops.js";

/** Render functions for the manager's overlays: flyout, close confirmation, notice and drop guide. */

export function renderFlyout(h: DockHost, ctx: DockContext): TemplateResult | typeof nothing {
  const id = h._peek;
  if (!id) return nothing;
  const where = ops.locate(h._model, id);
  if (where.place !== "drawer") return nothing;
  return html`<dockorama-flyout .view=${id} .side=${where.side} .ctx=${ctx}></dockorama-flyout>`;
}

export function renderConfirm(h: DockHost): TemplateResult | typeof nothing {
  const c = h._confirm;
  if (!c) return nothing;
  const t = h.t;
  const title = h._model.views[c.id]?.title ?? c.id;
  return html`<dockorama-confirm .view=${c.id} .message=${t.confirmClose.replace("{title}", title)} .okLabel=${t.closeAnyway} .cancelLabel=${t.cancel}></dockorama-confirm>`;
}

export function renderNotice(h: DockHost): TemplateResult | typeof nothing {
  if (!h._blocked.length) return nothing;
  const t = h.t;
  return html`<dockorama-notice .message=${t.reopenBlocked}
    .actions=${[{ label: t.reopen, action: "outside-reopen", primary: true }, { label: t.keepDocked, action: "outside-dismiss" }]}></dockorama-notice>`;
}

export function renderGuide(h: DockHost): TemplateResult | typeof nothing {
  const d = h._drag?.peer || h._drag?.beyond ? undefined : (h._drag ?? h._guest ?? h.keys.guide());
  if (!d || d.mode === "pending" || d.mode === "tab") return nothing;
  const host = h.getBoundingClientRect();
  const main = h.mainRect();
  const rel = (s: Spot<string>, hot: boolean): GuideSpot => ({ zone: s.zone, x: s.x - host.left, y: s.y - host.top, hot });
  const compass = d.target ? compassSpots(d.target.rect).filter((c) => !d.fill || c.zone === "into") : [];
  const spots = [
    ...compass.map((s) => rel(s, s.zone === d.target?.zone)),
    ...(main ? edgeSpots(main) : []).map((s) => rel(s, s.zone === d.edge))
  ];
  if (d.gap) {
    const r = d.gap.rect;
    spots.push(rel({ zone: "between", x: r.left + r.width / 2, y: r.top + r.height / 2 }, true));
  }
  const p = d.preview;
  const preview = p ? { left: p.left - host.left, top: p.top - host.top, width: p.width, height: p.height } : undefined;
  const ghost = d.mode === "loose" ? { x: d.x - host.left, y: d.y - host.top, label: h._model.views[d.id]?.title ?? d.id } : undefined;
  return html`<dockorama-drop-guide .spots=${spots} .preview=${preview} .ghost=${ghost}></dockorama-drop-guide>`;
}
