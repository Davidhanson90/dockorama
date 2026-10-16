import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import type { DockNode, DockoramaModel } from "./model.js";
import type { DockoramaManager } from "./manager.js";

/**
 * `<dockorama-minimap for="manager-id">`: a small live overview of a manager's layout.
 * Click a block to reveal that view.
 */
export class DockoramaMinimap extends LitElement {
  static override properties = { for: {}, _model: { state: true } };
  static override styles = css`
    :host { display: block; width: 160px; height: 100px; font: 10px/1.2 system-ui, sans-serif; }
    .map { display: flex; width: 100%; height: 100%; gap: 2px; padding: 2px; box-sizing: border-box;
      background: var(--dk-canvas, #eef0f4); border-radius: 6px; position: relative; }
    .split { display: flex; flex: 1; gap: 2px; min-width: 0; min-height: 0; }
    .split.column { flex-direction: column; }
    button { flex: 1; min-width: 0; min-height: 0; border: 1px solid var(--dk-line, #dfe2e9); border-radius: 3px;
      background: var(--dk-surface, #fff); color: var(--dk-ink, #222); font: inherit; padding: 1px 2px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
    button[data-active] { border-color: var(--dk-accent, #5b5bd6); color: var(--dk-accent, #5b5bd6); }
    .win { position: absolute; border: 1px dashed var(--dk-accent, #5b5bd6); background: rgb(91 91 214 / 0.12); }
  `;
  for = "";
  private _model?: DockoramaModel;
  private manager?: DockoramaManager | null;
  private readonly onChange = (e: Event) => {
    this._model = (e as CustomEvent<{ model: DockoramaModel }>).detail.model;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    queueMicrotask(() => this.attach());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.manager?.removeEventListener("dockorama-change", this.onChange);
    this.manager?.removeEventListener("dockorama-focus", this.onFocus);
  }
  private readonly onFocus = () => {
    this._model = this.manager?.model;
  };
  /** Connect to the manager named by `for` (or a manager passed in). */
  attach(manager?: DockoramaManager): void {
    this.manager?.removeEventListener("dockorama-change", this.onChange);
    this.manager?.removeEventListener("dockorama-focus", this.onFocus);
    this.manager = manager ?? (this.getRootNode() as Document | ShadowRoot).querySelector?.(`[id=${JSON.stringify(this.for)}]`) as DockoramaManager | null;
    this.manager?.addEventListener("dockorama-change", this.onChange);
    this.manager?.addEventListener("dockorama-focus", this.onFocus);
    this._model = this.manager?.model;
  }
  private node(n: DockNode): TemplateResult {
    if (n.kind === "split") {
      return html`<div class="split ${n.axis}">${n.children.map((c, i) => html`<div class="split" style="flex:${n.weights[i]}">${this.node(c)}</div>`)}</div>`;
    }
    const m = this._model!;
    const id = n.current;
    return html`<button ?data-active=${n.views.includes(m.focus ?? "\u0000")} title=${m.views[id]?.title ?? ""}
      @click=${() => id && this.manager?.reveal(id)}>${m.views[id]?.title ?? ""}${n.views.length > 1 ? ` +${n.views.length - 1}` : ""}</button>`;
  }
  override render() {
    const m = this._model;
    if (!m?.root) return html`<div class="map" part="map"></div>`;
    const r = this.manager?.getBoundingClientRect();
    return html`<div class="map" part="map" role="img" aria-label="Layout overview">${this.node(m.root)}
      ${r && r.width ? m.windows.map((w) => html`<div class="win" style="left:${(w.box.x / r.width) * 100}%;top:${(w.box.y / r.height) * 100}%;width:${(w.box.w / r.width) * 100}%;height:${(w.box.h / r.height) * 100}%"></div>`) : nothing}</div>`;
  }
}
