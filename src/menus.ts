import { html, nothing, type TemplateResult } from "lit";
import type { MenuEntry, TabMenuItem } from "./components/index.js";
import { attr, stackEls } from "./dom.js";
import type { CommandDetail, CommandSource } from "./events.js";
import type { DockHost } from "./host.js";
import type { TabCommand } from "./manager.js";
import * as ops from "./ops.js";

/** The tab context menu, the "more actions" menu and the command palette: their items, opening and rendering. */
export class MenuController {
  constructor(private readonly h: DockHost) {}

  renderTabMenu(): TemplateResult | typeof nothing {
    const m = this.h._tabMenu;
    if (!m) return nothing;
    return html`<dockorama-tab-menu .view=${m.id} .items=${m.items} .x=${m.x} .y=${m.y} .label=${this.h.t.tabMenu}></dockorama-tab-menu>`;
  }

  /** What both menus build their items from: the view's caps, labels, group and whether it floats. */
  private facts(id: string) {
    const where = ops.locate(this.h._model, id);
    return {
      c: this.h.caps(id), t: this.h.t,
      s: where.place === "tree" ? where.stack : undefined,
      floating: where.place === "tree" && Boolean(where.window)
    };
  }

  /** The built-in tab context menu items for a view (before the `tabMenu` hook). */
  tabMenuItems(id: string): TabMenuItem[] {
    const { c, t, s, floating } = this.facts(id);
    const views = s?.views ?? [];
    const pinned = this.h.hasPin(id);
    const others = ops.closeSet(this.h._model, id, "others");
    const right = ops.closeSet(this.h._model, id, "right");
    const out: TabMenuItem[] = [
      { key: "close", label: t.dismiss, disabled: c.dismiss === false },
      { key: "close-others", label: t.closeOthers, disabled: !others.length },
      { key: "close-right", label: t.closeRight, disabled: !right.length },
      { key: "close-all", label: t.closeAll, disabled: !ops.closeSet(this.h._model, id, "all").length },
      "separator",
      { key: "pin", label: pinned ? t.unpin : t.pin, checked: pinned },
      { key: "float", label: floating ? t.dock : t.float, disabled: c.float === false && !floating },
      { key: "popout", label: t.popout, disabled: c.popout === false || Boolean(ops.outsideOf(this.h._model, id)) },
      { key: "split-right", label: t.splitRight, disabled: views.length < 2 || c.move === false },
      { key: "split-down", label: t.splitDown, disabled: views.length < 2 || c.move === false }
    ];
    if (s && !s.docs && !floating) out.push({ key: "stow", label: t.stow, disabled: c.hide === false });
    return out;
  }

  /** Open the tab context menu of a view (at a client point, default: under its tab). */
  openTabMenu(id: string, at?: { x: number; y: number }): void {
    if (ops.locate(this.h._model, id).place !== "tree") return;
    const host = this.h.getBoundingClientRect();
    let x = at?.x;
    let y = at?.y;
    if (x === undefined || y === undefined) {
      const r = this.h.renderRoot.querySelector(`[id=${attr(`tab-${id}`)}], [id=${attr(`t-${id}`)}]`)?.getBoundingClientRect();
      x = r?.left ?? host.left + 20;
      y = r?.bottom ?? host.top + 20;
    }
    const base = this.tabMenuItems(id);
    const items = this.h.tabMenu ? this.h.tabMenu(id, base) : base;
    this.h._menu = undefined;
    this.h._tabMenu = { id, items, x: Math.max(0, Math.min(x - host.left, host.width - 220)), y: Math.max(0, y - host.top) };
    void this.h.updateComplete.then(() => this.h.renderRoot.querySelector<HTMLElement & { focusFirst(): void }>("dockorama-tab-menu")?.focusFirst());
  }

  /** Run a built-in tab command for a view. */
  runTabCommand(key: TabCommand, id: string): void {
    const where = ops.locate(this.h._model, id);
    switch (key) {
      case "close": void this.h.dismiss(id); return;
      case "close-others": void this.h.dismissMany(ops.closeSet(this.h._model, id, "others")); return;
      case "close-right": void this.h.dismissMany(ops.closeSet(this.h._model, id, "right")); return;
      case "close-all": void this.h.dismissMany(ops.closeSet(this.h._model, id, "all")); return;
      case "pin": return this.h.pin(id, !this.h.hasPin(id));
      case "float":
        if (where.place === "tree" && where.window) return this.h.dockToEdge(id, "edge-right");
        return this.h.detach(id);
      case "popout": void this.h.popOut(id); return;
      case "stow": return this.h.stow(id);
      case "split-right":
      case "split-down": {
        const other = where.place === "tree" ? where.stack.views.find((v) => v !== id) : undefined;
        if (other) this.h.place(id, other, key === "split-right" ? "right" : "below");
        return;
      }
    }
  }

  /** Fire the cancellable `dockorama-command` for a menu choice. */
  askCommand(id: string, command: string, source: CommandSource, custom: boolean): boolean {
    const detail: CommandDetail = { id, command, source, custom };
    return this.h.emit("dockorama-command", detail, true);
  }

  closeTabMenu(refocus: boolean): void {
    const id = this.h._tabMenu?.id;
    this.h._tabMenu = undefined;
    if (refocus && id) void this.h.updateComplete.then(() => this.h.renderRoot.querySelector<HTMLElement>(`[id=${attr(`tab-${id}`)}]`)?.focus());
  }

  openMenu(id: string): void {
    const host = this.h.getBoundingClientRect();
    const stackEl = stackEls(this.h.renderRoot).find((el) =>
      el.querySelector(`[id=${attr(`t-${id}`)}], [id=${attr(`tab-${id}`)}]`));
    const anchor = stackEl?.querySelector<HTMLElement>('[part~="more"]') ?? this.h.renderRoot.querySelector<HTMLElement>(`[data-stack] [part~="more"]`);
    const r = anchor?.getBoundingClientRect();
    this.h._menu = { id, x: r ? Math.min(r.left - host.left, host.width - 200) : 20, y: r ? r.bottom - host.top + 4 : 20 };
    void this.h.updateComplete.then(() => this.h.renderRoot.querySelector<HTMLButtonElement>(".menu button")?.focus());
  }

  /** Entries of the "more actions" menu for a view. */
  menuEntries(id: string): MenuEntry[] {
    const { c, t, s, floating } = this.facts(id);
    const out: MenuEntry[] = [];
    if (s && s.views.length > 1) {
      for (const v of s.views) out.push({ label: this.h._model.views[v]?.title ?? v, action: "reveal", id: v, checked: v === s.current });
      out.push("separator");
    }
    if (floating) out.push({ label: t.dock, action: "dock", id });
    else if (c.float !== false) out.push({ label: t.float, action: "float", id });
    if (c.popout !== false) out.push({ label: t.popout, action: "popout", id });
    if (s && !s.docs && !floating && c.hide !== false) out.push({ label: t.stow, action: "stow", id });
    if (c.dismiss !== false) out.push({ label: t.dismiss, action: "dismiss", id });
    return out;
  }

  renderMenu(): TemplateResult | typeof nothing {
    const menu = this.h._menu;
    if (!menu) return nothing;
    return html`<dockorama-menu .entries=${this.menuEntries(menu.id)} .x=${menu.x} .y=${menu.y}></dockorama-menu>`;
  }

  /** Palette entries: views + commands. */
  paletteItems(query = ""): Array<{ label: string; detail: string; run: () => void }> {
    const q = query.trim().toLowerCase();
    const views = ops.catalogue(this.h._model).map(({ id, info, where }) => ({
      label: info.title, detail: where === "tree" ? "" : where, run: () => this.h.reveal(id)
    }));
    const cmds = [
      { label: "Undo layout change", detail: "command", run: () => this.h.undo() },
      { label: "Redo layout change", detail: "command", run: () => this.h.redo() },
      { label: "Toggle fill layout", detail: "command", run: () => this.h.toggleZoom() }
    ];
    return [...views, ...cmds].filter((it) => !q || it.label.toLowerCase().includes(q));
  }

  renderPalette(): TemplateResult | typeof nothing {
    const p = this.h._palette;
    if (!p) return nothing;
    return html`<dockorama-palette .items=${this.paletteItems(p.query)} .query=${p.query} .index=${p.index}
      .label=${this.h.t.palette} .placeholder=${this.h.t.palettePlaceholder} .empty=${this.h.t.noMatches}></dockorama-palette>`;
  }
}
