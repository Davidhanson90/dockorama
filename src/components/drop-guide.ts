import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import type { Rect } from "../geometry.js";
import { FlexdockPart } from "./part.js";

/** One drop target shown during a drag (coordinates relative to the manager). */
export interface GuideSpot {
  zone: string;
  x: number;
  y: number;
  hot: boolean;
}

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
    return html`${p ? this.paint("drop-preview", { left: p.left, top: p.top, width: p.width, height: p.height }) : nothing}
      ${this.spots.map((s) => this.paint("drop-target", { zone: s.zone, hot: Boolean(s.hot), x: s.x, y: s.y, direction: s.zone.replace("edge-", "") }))}
      ${this.ghost ? this.paint("drag-ghost", { label: this.ghost.label, x: this.ghost.x, y: this.ghost.y }) : nothing}`;
  }
}
