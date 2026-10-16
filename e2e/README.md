# End-to-end tests

- `e2e/own/`: behaviour specs, one file per area (`npm run test:e2e`, `npm run test:e2e:smoke`).
- `e2e/own/helpers/`: the `Dock` page object and fixtures.
- `e2e/visual/`: screenshot baselines per skin (`npm run test:visual`, update with `npm run test:e2e:update`).

They run against the built harness (`npm run build:harness` + `vite preview`), or against the live site when
`DOCKORAMA_SITE` is set. See [docs/testing.md](../docs/testing.md) for the strategy, the platform caveat for visual
baselines, and how to add tests.
