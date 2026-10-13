# flexdock

A docking layout manager as a framework-agnostic web component, built with [Lit](https://lit.dev).
Split, tab, float, auto-hide, zoom and rearrange views by drag and drop or keyboard — with undo/redo,
workspaces, persistence, pop-out windows, a command palette and a layout minimap.

**Docs & live examples:** https://davidhanson90.github.io/flexdock/

```html
<flexdock-manager id="dock" style="height: 600px">
  <div data-view="files">File tree…</div>
  <div data-view="main">Editor…</div>
  <div data-view="log">Output…</div>
</flexdock-manager>
<script type="module">
  import { createModel, row, column, stack, docs } from "flexdock";
  document.getElementById("dock").model = createModel(
    { files: { title: "Files" }, main: { title: "main.ts" }, log: { title: "Output" } },
    row([stack(["files"]), column([docs(["main"]), stack(["log"])], [3, 1])], [1, 4])
  );
</script>
```

See [docs/API-DESIGN.md](docs/API-DESIGN.md) for the model and API.

## Development

```bash
npm install
npm start              # build + docs site dev server
npm run build:verify   # naming guard, lint, type checks, unit tests with coverage, build
npm run test:e2e       # Playwright tests of our own docs site
```

## License

MIT
