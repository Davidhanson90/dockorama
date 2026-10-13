# flexdock API design

Designed from first principles for flexdock. It intentionally shares no element, property, event,
enum or layout-key names with any other dock manager (checked by `scripts/check-api-overlap.mjs`
against a private avoid-list kept outside the repo).

## Principles
1. **Views are registered once, placed by id.** The model has a flat `views` registry (title, icon,
   capabilities) and a placement tree that only references view ids. Moving a view never copies its
   definition, and serialised models stay small and diff-friendly.
2. **Two node kinds only.** `split` (an `axis` of `"row"` or `"column"`, `children`, `weights`) and
   `stack` (an ordered `views` list with one `current`). A stack with one view renders as a titled
   panel; with more it renders tabs. A stack marked `docs: true` is an editor-style document area.
3. **Off-layout places are top-level lists**, not flags on nodes: `windows` (floating windows, each
   with its own tree and a `box`), `drawers` (auto-hidden views per side: `start`, `end`, `top`,
   `bottom` — logical sides so RTL just works) and `parked` (closed-but-kept views).
4. **The model is immutable data.** Every operation in `ops.ts` is a pure function `model -> model`.
   The element keeps an undo/redo history of models for free.
5. **Content is light DOM.** Children declare `data-view="id"`; the element assigns slots itself, so
   app content stays styleable and framework-owned.
6. **One change event.** `flexdock-change` (detail: `{ model, reason }`) fires after every change,
   plus intent events that can be cancelled before they happen: `flexdock-beforeclose`,
   `flexdock-beforemove`; and `flexdock-focus`, `flexdock-viewshow` (first reveal, for lazy loading).
7. **Theming through `--fd-*` custom properties** and `::part()` names describing *what* the element
   is in flexdock's own vocabulary: `bar`, `tab`, `gutter`, `compass`, `ghost`, `rail`, `drawer`,
   `window`, `palette`. String `addView` bodies use `.flexdock-text` and `--fd-text-padding`.

## Model (v1)
```ts
interface FlexdockModel {
  v: 1;
  views: Record<string, ViewInfo>;   // { title, icon?, caps?: Caps, lazy?, hint? }
  root: DockNode | null;
  windows: FloatWindow[];             // { key, box: {x,y,w,h}, tree }
  drawers: Record<Side, string[]>;    // Side = "start" | "end" | "top" | "bottom"
  parked: string[];
  focus?: string; zoom?: string;
}
type DockNode = SplitNode | StackNode;
interface SplitNode { kind: "split"; axis: "row" | "column"; children: DockNode[]; weights: number[]; }
interface StackNode { kind: "stack"; views: string[]; current: string; docs?: boolean; }
interface Caps { dismiss?, hide?, float?, move?, zoom?, popout?: boolean; docsOnly?: boolean }
```

## Element `<flexdock-manager>`
Properties: `model`, `theme` (`light|dark|auto`), `snap` (px grid for windows), `storageKey`
(auto-persist), `labels` (i18n), `keepEmpty`.
Methods: `place(viewId, target, where)`, `detach(viewId, box?)`, `stow(viewId, side?)`, `unstow`,
`dismiss(viewId)`, `reveal(viewId)`, `toggleZoom`, `activate`, `addView(id, content, options?)`,
`removeView(id, { keepElement? })`, `getViewElement(id)`, `hasView(id)`, `addView(id, info, near?)` (info-only form),
`undo/redo/canUndo/canRedo`, `snapshot()`, `restore(model)`, `popOut(viewId)`, `openPalette()`.
Drop zones are named `"left" | "right" | "above" | "below" | "into"` plus `edge-*` for the outer edge.

## Adding views from code
`addView(id, content, { title?, icon?, hint?, caps?, at? })` sets `data-view`, appends the content and places
the view as one undoable change (`reason: "add"`). `content` is an `Element`, a text `string` (wrapped in
`<div class="flexdock-text">`, padded with `--fd-text-padding`, default `12px 14px`), or a factory
`() => Element` run on first show. `at` is a `ViewSpot`, named for *where the view ends up*:
`"auto"` (default) · `"docs"` · `"parked"` · `{ near, zone?, index? }` · `{ edge, weight? }` · `{ float }` · `{ stow }`.
Errors are thrown before anything changes (duplicate id, target not in the layout, no document area).
The pure counterpart is `enlist(model, id, info, spot)`.

## Keyboard (flexdock's own scheme)
`Ctrl+.` palette · `Alt+ArrowKeys` focus neighbouring view · `Alt+Shift+ArrowKeys` move focused view
to that side of its group · `Alt+PageUp/PageDown` cycle tabs · `Alt+Z` zoom · `Alt+H` stow ·
`Alt+F` float · `Alt+Backspace` dismiss · `Ctrl+Alt+Z/Y` undo/redo. Splitters: arrow keys, Home/End.

## Extras
Undo/redo, presets & workspaces, localStorage persistence, pop-out to a browser window, command
palette, snap-to-grid windows, pointer/touch input, lazy view reveal events, `<flexdock-minimap>`.
