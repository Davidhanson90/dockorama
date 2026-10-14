# pazuru

A docking layout manager as a framework-agnostic web component, built with [Lit](https://lit.dev).
Split, tab, float, auto-hide, zoom and rearrange views by drag and drop or keyboard — with undo/redo,
workspaces, persistence, pop-out windows, a command palette and a layout minimap.

**Docs & live examples:** https://davidhanson90.github.io/pazuru/ ·
**Trading desk example:** [in the docs](https://davidhanson90.github.io/pazuru/#/examples/trading) or
[full page](https://davidhanson90.github.io/pazuru/trading.html)

| Default | Nimbus |
|---|---|
| ![Default skin](docs/images/skin-default.png) | ![Nimbus skin](docs/images/skin-nimbus.png) |
| **Ledger** | **Phosphor** |
| ![Ledger skin](docs/images/skin-ledger.png) | ![Phosphor skin](docs/images/skin-phosphor.png) |

## Getting started

```bash
npm install pazuru
```

```html
<pazuru-manager id="dock" style="display: block; height: 600px"></pazuru-manager>
<script type="module" src="./main.ts"></script>
```

```ts
import "pazuru";                      // registers <pazuru-manager> and its parts
import "pazuru/skins/nimbus";         // optional: switch every dock to the Nimbus skin
import type { PazuruManager, PazuruModel } from "pazuru";

const dock = document.querySelector<PazuruManager>("#dock")!;

// Views from an element, a string, or a lazy factory
const chart = document.createElement("canvas");
dock.addView("chart", chart, { title: "Chart", icon: "📈" });
dock.addView("notes", "Plain text is padded for you", { title: "Notes", at: { near: "chart", zone: "right" } });
dock.addView("log", () => document.createElement("pre"), { title: "Log", at: { near: "notes", zone: "into" } });

// Typed events (via HTMLElementEventMap)
dock.addEventListener("pazuru-change", (e) => console.log("layout changed:", e.detail.reason));
dock.addEventListener("pazuru-beforeclose", (e) => {
  if (e.detail.id === "chart" && !confirm("Close the chart?")) e.preventDefault();
});

// Save and restore the layout
const saved: PazuruModel = dock.snapshot();
localStorage.setItem("layout", JSON.stringify(saved));
dock.restore(JSON.parse(localStorage.getItem("layout")!) as PazuruModel);
```

Notes:

- Import `pazuru` for its side effect (it defines the custom elements). A type-only import is removed by
  bundlers, so keep the plain `import "pazuru";` line.
- The default skin is applied automatically. Skins and the skin API live under `pazuru/skins`
  (`import { defaultSkin, useSkin, overrideSkin } from "pazuru/skins"`); importing `pazuru/skins/<name>`
  (`default`, `nimbus`, `ledger`, `phosphor`) makes that skin the page-wide one.
- String content is rendered as text in a padded `.pazuru-text` box (`--pz-text-padding`); element content is
  used as-is. A function is called the first time the view is shown.
- Add `storage-key="my-app"` to the element to save and reload the layout automatically.

You can also declare views in markup with `data-view` children and set a full layout with `createModel`:

```html
<pazuru-manager id="dock" style="height: 600px">
  <div data-view="files">File tree…</div>
  <div data-view="main">Editor…</div>
  <div data-view="log">Output…</div>
</pazuru-manager>
<script type="module">
  import { createModel, row, column, stack, docs } from "pazuru";
  document.getElementById("dock").model = createModel(
    { files: { title: "Files" }, main: { title: "main.ts" }, log: { title: "Output" } },
    row([stack(["files"]), column([docs(["main"]), stack(["log"])], [3, 1])], [1, 4])
  );
</script>
```

See [docs/API-DESIGN.md](docs/API-DESIGN.md) for the model and API.

### Framework wrappers

React:

```tsx
import { useRef } from "react";
import { PazuruLayout } from "pazuru/react";
import type { PazuruManager } from "pazuru";

export function App() {
  const ref = useRef<PazuruManager>(null);
  return (
    <PazuruLayout ref={ref} storageKey="my-app" style={{ height: 600 }}
      onLayoutChange={({ reason }) => console.log(reason)}
      onBeforeClose={(e) => { if (e.detail.id === "files") e.preventDefault(); }}>
      <div data-view="files">Files</div>
    </PazuruLayout>
  );
}
```

Vue 3:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { PazuruLayout } from "pazuru/vue";
const layout = ref();
</script>
<template>
  <PazuruLayout v-model:model="layout" storage-key="my-app" @layout-change="(d) => console.log(d.reason)">
    <div data-view="files">Files</div>
  </PazuruLayout>
</template>
```

Angular (standalone):

```ts
import { Component } from "@angular/core";
import { PazuruLayoutComponent } from "pazuru/angular";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [PazuruLayoutComponent],
  template: `<pazuru-layout [model]="layout" (layoutChange)="layout = $event.model">
    <div data-view="files">Files</div>
  </pazuru-layout>`,
})
export class AppComponent { layout?: import("pazuru").PazuruModel; }
```

Svelte:

```svelte
<script lang="ts">
  import "pazuru";
  import { pazuru } from "pazuru/svelte";
</script>
<pazuru-manager use:pazuru={{ storageKey: "my-app", on: { change: (d) => console.log(d.reason) } }}>
  <div data-view="files">Files</div>
</pazuru-manager>
```

## Features

| Area | Feature | Description |
|---|---|---|
| Layout | Splits | Nested rows and columns with draggable splitters, snapping, size limits, fixed sizes and collapse |
| Layout | Document area | A central area for documents, kept apart from tool panes |
| Layout | Maximise | Zoom any pane to fill the dock and back |
| Layout | Multiple docks | Several managers on one page, each with its own state; views can move between them (`drag-group`) |
| Tabs | Tab groups | Tabs with icons, overflow scrolling and reordering |
| Tabs | Pinned and preview tabs | Sticky tabs that stay at the front, and a reusable preview tab |
| Tabs | Unsaved changes | Dirty dot on the tab and an async confirm before closing |
| Tabs | Tab menu | Right-click / Shift+F10 menu with close others, float, pin and more, customisable |
| Tabs | Large tab lists | Virtualised tab strip for very many tabs |
| Floating / pop-out | Floating windows | Detach views into movable, resizable floating windows |
| Floating / pop-out | Pop-out windows | Move views into real browser windows, several views per window, remembered in saved layouts |
| Auto-hide | Edge rails | Stow panes to an edge; they slide out as flyouts and can be pinned back |
| Drag & drop | Drop guides | Drop beside, above, below or into panes, onto dock edges, splitter gaps and empty document areas |
| Drag & drop | Cancel | Esc cancels a drag; touch dragging is supported |
| Keyboard / a11y | Keyboard docking | Alt+M moves a view step by step with screen-reader announcements |
| Keyboard / a11y | Shortcuts and ARIA | Tab cycling, neighbour focus, full roles and labels, right-to-left support, translatable labels |
| Persistence / workspaces | Snapshot and restore | `snapshot()` / `restore()` the whole layout as plain JSON |
| Persistence / workspaces | Auto-save | `storage-key` saves to and reloads from local storage |
| Persistence / workspaces | Workspaces | Named layouts with the `Workspaces` class |
| Persistence / workspaces | Versioning | Layout versions with migrations, validation and `pazuru-layoutissue` |
| Persistence / workspaces | Retained views | `retain="active"` keeps hidden views alive instead of re-creating them |
| Events | Typed events | Change, focus, show/hide, close, float, dock, stow, pin, pop-out, collapse, drag, resize and transfer events, typed through `HTMLElementEventMap` |
| Events | Vetoable events | Cancel `beforeadd`, `beforeclose`, `beforemove`, `dragstart` and menu commands with `preventDefault()` |
| Skins / theming | Skins | Default, Nimbus, Ledger and Phosphor skins from `pazuru/skins/<name>` |
| Skins / theming | Template overrides | Replace any of the typed part templates or add CSS page-wide (`overrideSkin`) or per dock (`skinPatch`) |
| Skins / theming | Themes | Light, dark and auto themes, styled through `--pz-*` CSS custom properties |
| Wrappers | Frameworks | React, Vue 3, Angular and Svelte wrappers as optional subpath exports |
| Extras | Minimap | `<pazuru-minimap for="id">`, a live overview of the layout you can click to navigate |
| Extras | Command palette | Find views and run commands from the keyboard (`openPalette()`) |
| Extras | Undo / redo | `undo()` / `redo()` for every layout change |
| Extras | One-call views | `addView` with an element, text or lazy factory |

## Components

`<pazuru-manager>` owns the layout model and renders one Lit custom element per UI piece:
`<pazuru-split>`, `<pazuru-gutter>`, `<pazuru-stack>`, `<pazuru-docs>`, `<pazuru-tabstrip>`, `<pazuru-tab>`,
`<pazuru-toolbar>`, `<pazuru-view>`, `<pazuru-window>`, `<pazuru-drop-guide>`, `<pazuru-rail>`, `<pazuru-flyout>`,
`<pazuru-menu>` and `<pazuru-palette>`, plus the standalone `<pazuru-minimap>`. Source lives in `src/components/`, one
file per element with a colocated `*.spec.ts`. Several managers can share a page; give each its own `storage-key`.

## Skins

Every visual part renders through a named, typed template from a skin. The built-in skin is applied automatically;
import another to change the look of every dock, or set one per dock:

```js
import "pazuru/skins/nimbus";            // or ledger, phosphor
import { useSkin, overrideSkin, extendSkin } from "pazuru/skins";
overrideSkin({ templates: { "tab-label": (c) => html`<b>${c.title}</b>` } });   // one part, page-wide
dock.skinPatch = { css: ".tab { font-style: italic }" };                       // one dock
```

See the Skins guide on the docs site for every template key and its context.

## Events

All events are typed `CustomEvent`s on `<pazuru-manager>` (bubbling, composed): layout, view lifecycle
(`pazuru-beforeadd`, `-viewshow`, `-viewhide`, `-close`, `-viewremove`), state (`-float`, `-dock`, `-stow`, `-pin`,
`-popout`, `-collapse` and their pairs), drag (`-dragstart`, `-dragover`, `-drop`), resize (`-resize`, `-resizing`)
and menu commands (`-command`). See the Events guide on the docs site.

## Framework wrappers

Optional subpath exports; each framework is an optional peer dependency.

| Import | Export |
|---|---|
| `pazuru/react` | `<PazuruLayout model onLayoutChange …>` (ref = element) |
| `pazuru/vue` | `<PazuruLayout v-model:model …>` |
| `pazuru/angular` | `PazuruLayoutComponent` (`<pazuru-layout [model] (layoutChange)>`), standalone |
| `pazuru/svelte` | `use:pazuru={{ model, on: { change } }}` action |

## Development

```bash
npm install
npm start              # build + docs site dev server
npm run build:verify   # naming guard, lint, type checks, unit tests with coverage, build
npm run test:e2e       # Playwright tests of our own docs site
```

## License

MIT
