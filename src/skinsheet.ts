import { DockoramaPart } from "./components/index.js";
import type { DockHost } from "./host.js";
import { activeSkin, cssFor, watchSkins } from "./skins/core.js";

/** Puts the active skin's CSS into a manager's shadow root (after the built-in styles) and keeps it current. */
export class SkinSheet {
  private unwatchFn?: () => void;
  private style?: HTMLStyleElement;
  private sheet?: CSSStyleSheet;

  constructor(private readonly h: DockHost) {}

  /** Whether the skin CSS has been applied at least once. */
  get applied(): boolean {
    return Boolean(this.style || this.sheet);
  }

  /** Re-apply whenever skins are registered or patched page-wide. */
  watch(): void {
    this.unwatchFn = watchSkins(() => this.apply());
  }

  unwatch(): void {
    this.unwatchFn?.();
  }

  /** Apply skin CSS and re-render every part. */
  apply(): void {
    const { h } = this;
    const root = h.shadowRoot;
    if (!root) return;
    const cssText = cssFor(h.skinScope());
    const canAdopt = "adoptedStyleSheets" in root && typeof CSSStyleSheet !== "undefined" && "replaceSync" in CSSStyleSheet.prototype;
    if (canAdopt) {
      if (!this.sheet) {
        this.sheet = new CSSStyleSheet();
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, this.sheet];
      }
      this.sheet.replaceSync(cssText);
    } else {
      if (!this.style) {
        this.style = document.createElement("style");
        this.style.dataset["skin"] = "";
        root.append(this.style);
      }
      this.style.textContent = cssText;
    }
    h.dataset["skinName"] = (h.skinScope().skin ?? activeSkin()).name;
    for (const el of Array.from(root.querySelectorAll("*"))) if (el instanceof DockoramaPart) el.requestUpdate();
    h.requestUpdate();
  }
}
