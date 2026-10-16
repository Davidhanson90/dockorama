import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

export default defineConfig({
  outputDir: "e2e-results",
  // Retries only on CI; a retry records a trace so flakes can be diagnosed from the artifact.
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  workers: CI ? 2 : undefined,
  reporter: CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }], ["blob"]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { ...devices["Desktop Chrome"], trace: "on-first-retry", screenshot: "only-on-failure" },
  // Visual baselines are Linux-generated and carry no platform suffix.
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  expect: { timeout: 7_000 },
  projects: [
    {
      name: "own",
      testDir: "e2e/own",
      use: { baseURL: "http://localhost:4173", viewport: { width: 1400, height: 1000 } }
    },
    {
      name: "visual",
      testDir: "e2e/visual",
      use: { baseURL: "http://localhost:4173", viewport: { width: 1200, height: 700 }, deviceScaleFactor: 1 }
    }
  ],
  webServer: process.env.DOCKORAMA_SKIP_SERVER
    ? undefined
    : {
        command: "npm run build:harness && npx vite preview --config harness/vite.config.ts --port 4173",
        url: "http://localhost:4173",
        reuseExistingServer: !CI,
        timeout: 180_000
      }
});
