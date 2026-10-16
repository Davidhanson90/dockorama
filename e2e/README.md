# End-to-end tests

`e2e/own/` holds Playwright tests of dockorama's docs site and examples (`npm run test:e2e`).
They run against the built harness (`npm run build:harness` + `vite preview`), or against the live site
when `DOCKORAMA_SITE` is set.
