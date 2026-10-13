import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { icons } from "../icons.js";
import type { Rect } from "../geometry.js";
import { FlexdockPart } from "./part.js";

/** One drop target shown during a drag (coordinates relative to the manager). */
export interface GuideSpot {
  zone: string;
  x: number;
  y: number;
  hot: boolean;
}

const ARROW: Record<string, number> = { left: -90, right: 90, above: 0, below: 180 };

/** `<flexdock-drop-guide>`: drag feedback: drop targets, the landing preview and the dragged-view ghost. */
export class FlexdockDropGuide extends FlexdockPart {
  static override properties = {
    spots: { attribute: false },
    preview: { attribute: false },
    ghost: { attribute: false }
  };
  spots: GuideSpot[] = [];
  preview?: Rect;
  ghost?: { x: number; y: number; label: string };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.classList.add("overlay");
    this.mark("part", "overlay");
  }

  override render(): TemplateResult {
    const p = this.preview;
    return html`${p ? html`<div class="preview" part="preview" style="left:${p.left}px;top:${p.top}px;width:${p.width}px;height:${p.height}px"></div>` : nothing}
      ${this.spots.map((s) => {
        const dir = s.zone.replace("edge-", "");
        return html`<div class="target" part="target" data-zone=${s.zone} ?data-hot=${s.hot} style="left:${s.x}px;top:${s.y}px">
          ${dir === "into" || dir === "between" ? icons.join : icons.arrow(ARROW[dir] ?? 0)}</div>`;
      })}
      ${this.ghost ? html`<div class="ghost" part="ghost" style="left:${this.ghost.x}px;top:${this.ghost.y}px">${this.ghost.label}</div>` : nothing}`;
  }
}
