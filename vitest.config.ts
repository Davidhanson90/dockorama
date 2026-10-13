import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      // angular.ts is exercised through its compiled output in dist/ (see angular.spec.ts).
      exclude: ["src/**/*.spec.ts", "src/angular.ts"],
      thresholds: { statements: 90, branches: 85, functions: 88, lines: 90 }
    }
  }
});
