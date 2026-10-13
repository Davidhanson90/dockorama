# End-to-end tests

There are two very different kinds of test here. Keep them apart.

## `e2e/own/` — tests of flexdock

Normal Playwright tests against our own harness (`npm run test:e2e`). They assert flexdock's
behaviour as written in `docs/specs/`. They must never reference the reference product.

## `e2e/reference/` — black-box exploration of the reference product

Local-only tests (`FLEXDOCK_REFERENCE=1 npm run test:e2e:reference`) that open the **public** docs
and live demo pages of the reference product (third-party third-party UI Dock Manager) and *play with
the examples like a user*: drag panes, dock/undock, resize splitters, pin/unpin, close, float,
maximize, keyboard navigation. The goal is to observe **what** it does, never **how**.

Rules (full detail in [../docs/CLEAN-ROOM.md](../docs/CLEAN-ROOM.md)):

- Interact only through the visible UI (mouse, keyboard, visible text, geometry, timing).
- Do **not** read, dump, save or evaluate page scripts, bundles, source maps, stylesheets or
  shadow-DOM internals; no `page.evaluate` that reads their code, no network capture of JS/CSS.
- Screenshots go to `e2e/reference/shots/` which is **gitignored** — never commit them.
- Be polite: one worker, no retries, no loops over many pages, no bulk scraping. Respect the
  site's terms of use and robots rules.
- Write findings as a behavioural spec in our own words in `docs/specs/<feature>.md`, then implement
  from the spec without going back to the reference while coding.
- This folder is the only place the reference product's names may appear;
  `npm run lint:naming` enforces it.
