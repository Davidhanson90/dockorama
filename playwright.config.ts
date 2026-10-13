import { defineConfig, devices } from "@playwright/test";

// Two projects:
//  - "own":       tests against flexdock's own harness (run in CI once features exist).
//  - "reference": local-only black-box exploration of the reference product's PUBLIC demo pages.
export default defineConfig({
  outputDir: "e2e-results",
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], trace: "off" },
  projects: [
    {
      name: "own",
      testDir: "e2e/own",
      use: { baseURL: "http://localhost:4173" }
    },
    {
      name: "reference",
      testDir: "e2e/reference",
      // Polite: one worker, no retries, no parallel hammering of a third-party site.
      fullyParallel: false,
      retries: 0,
      timeout: 60_000
    }
  ],
  workers: 1,
  webServer: process.env.FLEXDOCK_SKIP_SERVER
    ? undefined
    : {
        command: "npm run build:harness && npx vite preview --config harness/vite.config.ts --port 4173",
        port: 4173,
        reuseExistingServer: true
      }
});
