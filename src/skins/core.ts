// The skin registry: every visual part of every UI component renders through a named, typed template
// looked up here, so a skin (or a single override) can replace any of them without touching the components.
import type { CSSResult, TemplateResult, nothing } from "lit";
import type { icons as iconSet } from "../icons.js";
import type { ViewInfo } from "../model.js";

/** What a template may return. */
export type SkinOutput = TemplateResult | typeof nothing | string;

/** Passed to every template: render another (overridable) template, and the built-in icon set. */
export interface SkinKit {
  paint<K extends SkinKey>(key: K, ctx: SkinContexts[K]): SkinOutput;
  readonly icons: typeof iconSet;
}

/**
 * Template keys and the context each one receives. Callbacks (`close`, `choose`, …) perform the part's action;
 * keep the documented class names on interactive elements (`.btn`, `.tabs`, `.grip`) so keyboard and drag code finds them.
 */
export interface SkinContexts {
  /** Inside `<pazuru-tab>` (the element itself is the `role="tab"` host). */
  tab: { view: string; title: string; info?: ViewInfo; selected: boolean; pinned: boolean; preview: boolean; dirty: boolean; closable: boolean; compact: boolean; closeLabel: string; dirtyLabel: string; close(): void };
  "tab-glyph": { icon: string };
  "tab-label": { title: string; selected: boolean; preview: boolean };
  "tab-dirty-dot": { label: string };
  "tab-pin-mark": { title: string };
  "tab-close-button": { title: string; label: string; close(): void };
  /** Inside `<pazuru-tabstrip>`; `tabs` are the tab elements, which must stay inside an element with class `tabs`. */
  tabstrip: { tabs: TemplateResult[]; label: string; back: SkinOutput; forward: SkinOutput; wheel(e: WheelEvent): void; scrolled(): void };
  "tab-scroll-button": { dir: -1 | 1; scroll(): void };
  /** Inside `<pazuru-stack>` / `<pazuru-docs>`: the title bar plus the content area. */
  group: { bar: SkinOutput; body: TemplateResult; docs: boolean };
  "group-bar": { title: SkinOutput; toolbar: SkinOutput; tabbed: boolean; grab(e: PointerEvent): void; zoom(): void };
  "group-title": { id: string; title: string; icon?: string; dirty: boolean; dirtyLabel: string };
  /** Inside `<pazuru-toolbar>`. */
  toolbar: { buttons: SkinOutput[] };
  "toolbar-button": { action: "stow" | "zoom" | "unzoom" | "menu" | "dismiss"; label: string; part: string; press(): void };
  /** Inside `<pazuru-view>`. */
  "view-content": { slot: string };
  "view-empty": { label: string };
  "view-away": { message: string; label: string; bringBack(): void };
  /** Inside `<pazuru-gutter>` (the splitter itself is the host; default renders nothing). */
  splitter: { axis: "row" | "column"; folded: "before" | "after" | ""; drop: boolean; value: number };
  /** Inside `<pazuru-window>`: `content` must stay inside an element with class `content`. */
  "floating-window": { key: string; title: string; content: TemplateResult; grip: SkinOutput };
  "floating-header": { key: string; title: string };
  "floating-grip": { startResize(e: PointerEvent): void };
  /** Inside `<pazuru-drop-guide>`. */
  "drop-preview": { left: number; top: number; width: number; height: number };
  "drop-target": { zone: string; hot: boolean; x: number; y: number; direction: string };
  "drag-ghost": { label: string; x: number; y: number };
  /** Inside `<pazuru-flyout>`. */
  flyout: { id: string; title: string; unstowLabel: string; closeLabel?: string; unstow(): void; close?(): void; body: TemplateResult };
  /** One button in `<pazuru-rail>`. */
  "rail-item": { id: string; title: string; open: boolean; toggle(): void; hover(e: PointerEvent): void };
  /** One entry of `<pazuru-menu>`. */
  "menu-item": { label: string; role: "menuitem" | "menuitemradio"; checked?: boolean; index?: number; style?: string; choose(): void };
  "menu-separator": Record<string, never>;
  /** One entry of `<pazuru-tab-menu>`. */
  "tab-menu-item": { label: string; key: string; checked?: boolean; disabled: boolean; choose(): void };
  /** `<pazuru-palette>` rows. */
  "palette-item": { label: string; detail: string; selected: boolean; choose(): void };
  "palette-empty": { label: string };
  /** Inside `<pazuru-notice>`. */
  notice: { message: string; actions: Array<{ label: string; primary: boolean; run(): void }> };
  /** Inside `<pazuru-confirm>`; keep `data-cancel` / `data-primary` on the buttons. */
  confirm: { message: string; okLabel: string; cancelLabel: string; ok(): void; cancel(): void };
}

export type SkinKey = keyof SkinContexts;
/** A template for one key. */
export type SkinTemplate<K extends SkinKey> = (ctx: SkinContexts[K], kit: SkinKit) => SkinOutput;
/** A full or partial map of templates. */
export type SkinTemplates = { [K in SkinKey]: SkinTemplate<K> };

/** CSS for a skin or an override: a string or a Lit `css` result. */
export type SkinCss = string | CSSResult;

/** A partial skin: some templates and/or extra CSS, layered on top of whatever is below. */
export interface SkinPatch {
  templates?: Partial<SkinTemplates>;
  css?: SkinCss;
}

/** A named skin. `base` is the skin it extends (the built-in default when omitted). */
export interface Skin {
  readonly name: string;
  readonly templates: Partial<SkinTemplates>;
  readonly css: string;
  readonly base?: Skin;
}

const text = (c?: SkinCss): string => (c === undefined ? "" : typeof c === "string" ? c : c.cssText);

const named = new Map<string, Skin>();
let fallback: Skin | undefined;
let current: Skin | undefined;
let globalPatches: SkinPatch[] = [];
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((fn) => fn());

/** Create a skin. It extends `base` (default: the built-in skin) and is registered under its name. */
export function defineSkin(name: string, patch: SkinPatch & { base?: Skin } = {}): Skin {
  const skin: Skin = { name, templates: { ...patch.templates }, css: text(patch.css), ...(patch.base ? { base: patch.base } : {}) };
  named.set(name, skin);
  return skin;
}

/** A new skin made of `base` plus a patch (templates and/or CSS). Does not change `base`. */
export function extendSkin(base: Skin, name: string, patch: SkinPatch): Skin {
  return defineSkin(name, { ...patch, base });
}

/** @internal The built-in skin every chain ends with. */
export function setFallbackSkin(skin: Skin): void {
  fallback = skin;
}

/** A registered skin by name. */
export function skinNamed(name: string): Skin | undefined {
  return named.get(name);
}

/** Names of every registered skin. */
export function skinNames(): string[] {
  return [...named.keys()];
}

/** Make a skin the page-wide default for every dock (one that sets its own `skin` keeps it). */
export function useSkin(skin: Skin | string): Skin {
  const s = typeof skin === "string" ? named.get(skin) : skin;
  if (!s) throw new Error(`pazuru: unknown skin "${String(skin)}"`);
  if (s !== current) {
    current = s;
    notify();
  }
  return s;
}

/** The page-wide skin. */
export function activeSkin(): Skin {
  return current ?? fallback!;
}

/** Override templates and/or CSS on top of any skin, for every dock. Returns a function that removes it again. */
export function overrideSkin(patch: SkinPatch): () => void {
  globalPatches = [...globalPatches, patch];
  notify();
  return () => {
    globalPatches = globalPatches.filter((p) => p !== patch);
    notify();
  };
}

/** Remove every page-wide override. */
export function clearSkinOverrides(): void {
  globalPatches = [];
  notify();
}

/** @internal Called whenever the page-wide skin or overrides change. */
export function watchSkins(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Skins from `skin` down to (not including) the built-in one, nearest first. */
function chain(skin: Skin): Skin[] {
  const out: Skin[] = [];
  for (let s: Skin | undefined = skin; s && s !== fallback; s = s.base ?? fallback) {
    if (out.includes(s)) break;
    out.push(s);
  }
  return out;
}

/** Where a part looks things up: an optional per-dock skin and per-dock patch. */
export interface SkinScope {
  skin?: Skin;
  patch?: SkinPatch;
}

/** The template for `key`: per-dock patch, page-wide patches (newest first), the skin chain, then the built-in skin. */
export function templateFor<K extends SkinKey>(key: K, scope: SkinScope = {}): SkinTemplate<K> {
  const local = scope.patch?.templates?.[key];
  if (local) return local as SkinTemplate<K>;
  for (let i = globalPatches.length - 1; i >= 0; i--) {
    const t = globalPatches[i]!.templates?.[key];
    if (t) return t as SkinTemplate<K>;
  }
  for (const s of chain(scope.skin ?? activeSkin())) {
    const t = s.templates[key];
    if (t) return t as SkinTemplate<K>;
  }
  const base = fallback?.templates[key];
  if (!base) throw new Error(`pazuru: no template for "${key}"`);
  return base as SkinTemplate<K>;
}

/** CSS added on top of the built-in styles for a scope: skin chain (base first), page-wide patches, per-dock patch. */
export function cssFor(scope: SkinScope = {}): string {
  const parts = chain(scope.skin ?? activeSkin()).reverse().map((s) => s.css);
  parts.push(...globalPatches.map((p) => text(p.css)), text(scope.patch?.css));
  return parts.filter(Boolean).join("\n");
}
