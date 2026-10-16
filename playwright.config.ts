import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  outputDir: "e2e-results",
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], trace: "off" },
  projects: [
    {
      name: "own",
      testDir: "e2e/own",
      use: { baseURL: "http://localhost:4173", viewport: { width: 1400, height: 1000 } }
    }
  ],
  workers: 1,
  webServer: process.env.DOCKORAMA_SKIP_SERVER
    ? undefined
    : {
        command: "npm run build:harness && npx vite preview --config harness/vite.config.ts --port 4173",
        port: 4173,
        reuseExistingServer: true
      }
});
