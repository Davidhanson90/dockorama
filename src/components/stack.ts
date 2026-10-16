import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import type { DockContext, StackNode } from "../core/contracts.js";
import { DockoramaPart } from "./part.js";

/**
 * `<dockorama-stack>`: a group of views with a header bar (title or `<dockorama-tabstrip>`), a
 * `<dockorama-toolbar>` of actions and a `<dockorama-view>` content host.
 */
export class DockoramaStack extends DockoramaPart {
  static override properties = {
    group: { attribute: false },
    path: { attribute: false },
    win: { attribute: false },
    ctx: { attribute: false }
  };
  group!: StackNode;
  path: number[] = [];
  win?: string;
  ctx!: DockContext;

  protected override get listeners() {
    return { pointerdown: this.onDown };
  }
  private readonly onDown = (event: PointerEvent): void => this.request("activate", { id: this.group.current, event, source: this });

  private get tabbed(): boolean {
    return Boolean(this.group.docs) || this.group.views.length > 1;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const s = this.group;
    const m = this.ctx.model;
    this.classList.add("stack");
    this.mark("part", s.docs ? "group docs" : "group");
    this.mark("data-stack", s.views[0] ?? `docs-${this.path.join(".")}`);
    this.mark("data-win", this.win ?? "");
    this.mark("data-path", this.path.join("."));
    this.mark("data-empty", !s.views.length);
    this.mark("data-docs", Boolean(s.docs));
    this.mark("data-active", s.views.includes(m.focus ?? "\u0000"));
    this.mark("data-tabs", this.tabbed);
    this.mark("tabindex", "-1");
    this.mark("role", "group");
    this.mark("aria-label", m.views[s.current]?.title ?? this.ctx.labels.emptyDocs);
  }

  override render(): TemplateResult {
    const { group: s, ctx, win } = this;
    const cur = s.current;
    const info = ctx.model.views[cur];
    const tabbed = this.tabbed;
    const onBar = (event: PointerEvent) => {
      if (!tabbed && cur) this.request("grab", { id: cur, win, event, source: event.currentTarget });
    };
    const title = tabbed
      ? html`<dockorama-tabstrip .views=${s.views} .current=${cur} .pinned=${s.pinned ?? []} .preview=${s.preview} .docs=${Boolean(s.docs)} .win=${win} .ctx=${ctx}></dockorama-tabstrip>`
      : this.paint("group-title", { id: cur, title: info?.title ?? cur, ...(info?.icon ? { icon: info.icon } : {}), dirty: Boolean(ctx.dirty?.has(cur)), dirtyLabel: ctx.labels.unsaved });
    const toolbar = cur ? html`<dockorama-toolbar .view=${cur} .docs=${Boolean(s.docs)} .win=${win} .ctx=${ctx}></dockorama-toolbar>` : nothing;
    const bar = this.paint("group-bar", { title, toolbar, tabbed, grab: onBar, zoom: () => cur && this.request("zoom", { id: cur }) });
    const body = html`<dockorama-view .view=${cur} .kind=${tabbed ? "tabpanel" : "region"} .labelledBy=${cur ? `${tabbed ? "tab" : "t"}-${cur}` : ""}
        .ctx=${ctx}></dockorama-view>`;
    return html`${this.paint("group", { bar, body, docs: Boolean(s.docs) })}`;
  }
}
