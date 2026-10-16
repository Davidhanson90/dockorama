# Testing

dockorama is covered by three layers.

| Layer | Tool | Where | Command |
| --- | --- | --- | --- |
| Unit | Vitest | `src/*.spec.ts` | `npm test` |
| Behaviour (end to end) | Playwright, project `own` | `e2e/own/` | `npm run test:e2e` |
| Visual regression | Playwright `toHaveScreenshot`, project `visual` | `e2e/visual/` | `npm run test:visual` |

`npm run build:verify` runs lint, naming and API checks, type checks, the build and unit coverage. The Playwright suites build
the harness themselves (`npm run build:harness`) and serve it with `vite preview` on `http://localhost:4173`.

## Running

```bash
npm ci
npx playwright install chromium        # once
npm run test:e2e                       # full behaviour suite
npm run test:e2e:smoke                 # only tests tagged @smoke (fast)
npm run test:visual                    # screenshot comparison (Linux only by default)
npx playwright test --project=own e2e/own/tabs.spec.ts -g "pinned"   # one spec or test
npx playwright show-report             # open the last HTML report
```

Set `DOCKORAMA_SKIP_SERVER=1` to reuse a server you already started, or `DOCKORAMA_SITE=https://...` to point the docs-site
specs at a deployed site. Locally Playwright reuses a server on port 4173. In CI it always starts a fresh one.

## How the behaviour suite is organised

One spec file per area, with descriptive test names:

`layout-splits`, `tabs`, `documents-area`, `floating-windows`, `auto-hide`, `drag-drop`, `multi-dock-transfer`, `pop-out`,
`keyboard-docking`, `command-palette`, `minimap`, `undo-redo`, `persistence`, `views-api`, `events-contract`, `skin-system`,
`theming`, `accessibility`, `docs-site`, `frameworks`, plus older site-level specs (`trading`, `docking`, `skins`, ...).

Most specs run on the **lab page** (`harness/lab.html`, built into `harness-dist`). It is a test page, not part of the docs. It
has a fixed 1200x700 stage, a pinned font, no clocks and no random data, and exposes `window.lab` with the public API, the
skins, a `mount()` helper, the standard layout and an event recorder. The docs-site, trading and framework specs run on the real
docs site.

Shared code lives in `e2e/own/helpers/`:

- `lab.ts`: the `Dock` page object (locators for stacks, tabs, gutters, windows, rail, drawer, drop targets, menus;
  model/snapshot access; event log; pointer helpers `drag`, `dragTabToZone`, `dragGutter`).
- `fixtures.ts`: `test` with a `dock` fixture (standard layout mounted) and an automatic `errors` fixture that fails a test on any
  console error or uncaught page error.

### Rules for stable tests

- **No fixed sleeps.** Use web-first assertions (`expect(locator)...`) or `expect.poll` for model and event state.
- Drive the UI with real pointer and keyboard input. Read the model (`dock.model()`) to assert the outcome.
- Use `localhost` and port 4173 only. No test depends on the host OS, a path separator or the clock.
- Use roles, `data-stack`/`data-view` attributes and visible text. No test-only ids were added to the product.
- Known product gaps are encoded as `test.fail(...)` (the test turns red when the behaviour is fixed, so remove the marker) or
  `test.fixme(...)` for behaviour that does not exist yet.
- Tag the handful of fast, high-signal tests with `@smoke` in the title.

### Adding a test

1. Pick (or create) the spec for the area. Import `test` and `expect` from `./helpers/index.js`.
2. Use the `dock` fixture, or `Dock.mount(page, { model, attrs })` for a custom layout.
3. Act through the page object, assert on locators or on `dock.model()` / `dock.events(name)`.
4. Run it a few times: `npx playwright test --project=own e2e/own/<spec> --repeat-each=5`.

## Visual regression

`e2e/visual/visual.spec.ts` captures the lab stage for key states (layout, dark theme, selected tab, tab menu, floating window,
flyout, drag preview, palette, dirty tab) in each of the four skins, plus a per-dock skin composition and a custom accent. Capture is
deterministic: fixed 1200x700 viewport, device scale factor 1, reduced motion, animations disabled, hidden caret, pinned font,
`document.fonts.ready` awaited. Thresholds: `threshold: 0.2` (per-pixel colour distance) and `maxDiffPixelRatio: 0.002`.

**Platform caveat.** Font rasterisation differs between operating systems, so baselines in
`e2e/visual/__screenshots__/` are generated on **Linux** (the CI image, with DejaVu fonts) and have no platform suffix. On macOS
and Windows the visual tests are **skipped**. Set `DOCKORAMA_VISUAL=1` to run them anyway (expect small diffs), or run them in
Docker:

```bash
docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.64.0-noble \
  bash -c "npm ci && npm run test:e2e:update"
```

**Updating baselines** after an intentional visual change: run `npm run test:e2e:update` on Linux (or in the container above),
review the image diffs in the PR, and commit them. On a CI failure, download the `visual-diffs` artifact to see the expected,
actual and diff images.

## Reliability and CI

- Retries only on CI (`retries: 1`), with a trace recorded on the first retry. Failures keep a screenshot.
- Reporters: list plus an HTML report (`playwright-report/`). CI also writes a blob report per shard and a final job merges them
  into one HTML report artifact (`playwright-html-report`).
- `.github/workflows/e2e.yml` runs the behaviour suite in 3 shards, the visual project in its own job, then merges the reports.
- Before merging a larger change, check for flakes: `npx playwright test --project=own --repeat-each=3`.
