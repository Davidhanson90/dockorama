# flexdock

A Lit-based web component **dock manager**: dockable, splittable, tabbed and floating panes for
IDE-style application layouts. Framework-agnostic custom elements; `lit` is the only runtime dependency.

> Status: early scaffold. Not yet published to npm.

## Usage

```html
<script type="module">
  import "flexdock";
</script>

<flexdock-manager>
  <div>Your content</div>
</flexdock-manager>
```

## Development

```sh
npm install
npm start              # build + harness dev server (harness/)
npm test               # vitest unit tests (colocated *.spec.ts)
npm run lint           # eslint
npm run lint:naming    # clean-room naming guard
npm run build          # tsc -> dist/
npm run build:verify   # everything CI runs
npm run test:e2e       # Playwright tests of our own harness
```

## Clean room

flexdock is a clean-room build. The reference product is third-party third-party UI Dock Manager, which
we only observe through its public docs and live demos. Read [docs/CLEAN-ROOM.md](docs/CLEAN-ROOM.md)
before contributing, and see [e2e/README.md](e2e/README.md) for reference-exploration tests,
[docs/specs/](docs/specs/) for behavioural specs and [docs/IP-AUDIT.md](docs/IP-AUDIT.md) for the
release audit.

## Trademarks

third-party and third-party UI are trademarks of third-party, Inc. flexdock is not affiliated with,
endorsed by or sponsored by third-party, Inc.

## License

MIT
