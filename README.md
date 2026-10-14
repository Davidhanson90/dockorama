# pazuru

A docking layout manager as a framework-agnostic web component, built with [Lit](https://lit.dev).
Split, tab, float, auto-hide, zoom and rearrange views by drag and drop or keyboard — with undo/redo,
workspaces, persistence, pop-out windows, a command palette and a layout minimap.

**Docs & live examples:** https://davidhanson90.github.io/pazuru/

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
