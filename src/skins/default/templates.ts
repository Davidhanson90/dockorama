import { html, nothing } from "lit";
import type { SkinTemplates } from "../core.js";

const ARROW: Record<string, number> = { left: -90, right: 90, above: 0, below: 180 };
const stop = (e: Event): void => e.stopPropagation();

/** The built-in templates: one per visual part. */
export const templates: SkinTemplates = {
  tab: (c, k) => html`${c.info?.icon ? k.paint("tab-glyph", { icon: c.info.icon }) : nothing}${c.compact ? nothing : k.paint("tab-label", { title: c.title, selected: c.selected, preview: c.preview })}
    ${c.dirty ? k.paint("tab-dirty-dot", { label: c.dirtyLabel }) : nothing}
    ${c.pinned ? k.paint("tab-pin-mark", { title: c.title }) : nothing}
    ${c.closable && !c.pinned ? k.paint("tab-close-button", { title: c.title, label: c.closeLabel, close: c.close }) : nothing}`,
  "tab-glyph": (c) => html`<span class="glyph">${c.icon}</span>`,
  "tab-label": (c) => html`<span class="label">${c.title}</span>`,
  "tab-dirty-dot": (c) => html`<span class="dirty" part="tab-dirty" role="img" aria-label=${c.label}></span>`,
  "tab-pin-mark": (_c, k) => html`<span class="pin" part="tab-pin" aria-hidden="true">${k.icons.pin}</span>`,
  "tab-close-button": (c, k) => html`<button class="btn" part="tab-close" tabindex="-1" aria-label="${c.label} ${c.title}"
    @pointerdown=${stop} @click=${(e: Event) => { stop(e); c.close(); }}>${k.icons.close}</button>`,
  tabstrip: (c) => html`${c.back}<div class="tabs" role="tablist" aria-label=${c.label}
    @wheel=${c.wheel} @scroll=${c.scrolled}>${c.tabs}</div>${c.forward}`,
  "tab-scroll-button": (c, k) => html`<button class="btn scroll" part="tab-scroll" data-dir=${c.dir} tabindex="-1" aria-hidden="true"
    @pointerdown=${stop} @click=${(e: Event) => { stop(e); c.scroll(); }}>${k.icons.arrow(c.dir * 90)}</button>`,
  group: (c) => html`${c.bar}${c.body}`,
  "group-bar": (c) => html`<div class="bar" part="bar" @pointerdown=${c.grab} @dblclick=${c.zoom}>${c.title}${c.toolbar}</div>`,
  "group-title": (c) => html`<span class="title" id="t-${c.id}">${c.icon ? html`<span class="glyph">${c.icon}</span>` : nothing}${c.title}${c.dirty
    ? html`<span class="dirty" part="tab-dirty" role="img" aria-label=${c.dirtyLabel}></span>` : nothing}</span>`,
  toolbar: (c) => html`${c.buttons}`,
  "toolbar-button": (c, k) => {
    const icon = { stow: k.icons.stow, zoom: k.icons.zoom, unzoom: k.icons.unzoom, menu: k.icons.more, dismiss: k.icons.close }[c.action];
    return html`<button class="btn" part="action ${c.part}" title=${c.label} aria-label=${c.label} @pointerdown=${stop}
      @click=${(e: Event) => { stop(e); c.press(); }}>${icon}</button>`;
  },
  "view-content": (c) => html`<slot name=${c.slot}></slot>`,
  "view-empty": (c) => html`<div class="empty">${c.label}</div>`,
  "view-away": (c) => html`<div class="away"><p>${c.message}</p><button class="btn" style="width:auto;padding:0 10px" @click=${c.bringBack}>${c.label}</button></div>`,
  splitter: () => nothing,
  "floating-window": (c) => html`${c.content}${c.grip}`,
  "floating-header": () => nothing,
  "floating-grip": (c) => html`<div class="grip" part="grip" @pointerdown=${c.startResize}></div>`,
  "drop-preview": (c) => html`<div class="preview" part="preview" style="left:${c.left}px;top:${c.top}px;width:${c.width}px;height:${c.height}px"></div>`,
  "drop-target": (c, k) => html`<div class="target" part="target" data-zone=${c.zone} ?data-hot=${c.hot} style="left:${c.x}px;top:${c.y}px">
    ${c.direction === "into" || c.direction === "between" ? k.icons.join : k.icons.arrow(ARROW[c.direction] ?? 0)}</div>`,
  "drag-ghost": (c) => html`<div class="ghost" part="ghost" style="left:${c.x}px;top:${c.y}px">${c.label}</div>`,
  flyout: (c, k) => html`<section class="stack" data-active data-stack=${c.id}>
    <div class="bar" part="bar"><span class="title">${c.title}</span>
      <button class="btn" part="action unstow" aria-label=${c.unstowLabel} title=${c.unstowLabel} @click=${c.unstow}>${k.icons.unstow}</button>
      ${c.close ? html`<button class="btn" part="action close" aria-label=${c.closeLabel ?? ""} @click=${c.close}>${k.icons.close}</button>` : nothing}
    </div>${c.body}</section>`,
  "rail-item": (c) => html`<button class="rail-item" part="rail-item" aria-expanded=${c.open ? "true" : "false"} @click=${c.toggle} @pointerenter=${c.hover}>${c.title}</button>`,
  "menu-item": (c) => html`<button role=${c.role} aria-checked=${c.checked === undefined ? nothing : String(c.checked)}
    data-index=${c.index ?? nothing} style=${c.style ?? nothing} @click=${c.choose}>${c.label}</button>`,
  "menu-separator": () => html`<hr>`,
  "tab-menu-item": (c) => html`<button role=${c.checked === undefined ? "menuitem" : "menuitemcheckbox"} data-key=${c.key}
    aria-checked=${c.checked === undefined ? nothing : String(c.checked)} ?disabled=${c.disabled} @click=${c.choose}>${c.label}</button>`,
  "palette-item": (c) => html`<li role="option" aria-selected=${c.selected ? "true" : "false"}
    @pointerdown=${(e: Event) => { e.preventDefault(); c.choose(); }}>${c.label}<small>${c.detail}</small></li>`,
  "palette-empty": (c) => html`<li aria-disabled="true">${c.label}</li>`,
  notice: (c) => html`<span class="notice-text">${c.message}</span>${c.actions.map((a) =>
    html`<button class="btn notice-btn" ?data-primary=${a.primary} @click=${a.run}>${a.label}</button>`)}`,
  confirm: (c) => html`<div class="confirm-box"><p>${c.message}</p><div class="confirm-actions">
    <button class="btn" data-cancel @click=${c.cancel}>${c.cancelLabel}</button>
    <button class="btn" data-primary @click=${c.ok}>${c.okLabel}</button>
  </div></div>`
};
