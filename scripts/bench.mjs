// Records the Performance-guide benchmark in headless Chromium.
/* global window */
// Usage: npm run build:harness && npx vite preview --config harness/vite.config.ts --port 4173 & node scripts/bench.mjs
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import os from "node:os";

const base = process.env.FLEXDOCK_URL ?? "http://localhost:4173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(`${base}/#/guide/performance`);
const rows = [];
for (const key of ["100-all", "500-all", "500-active"]) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { window.benchResults = []; });
    await page.click(`[data-bench="${key}"]`);
    await page.waitForFunction(() => window.benchResults?.length === 1, null, { timeout: 120000 });
    runs.push(await page.evaluate(() => window.benchResults[0]));
  }
  // Median run by drag work.
  runs.sort((a, b) => a.dragAvgMs - b.dragAvgMs);
  rows.push(runs[1]);
}
const env = `Chromium ${browser.version()} headless, ${os.cpus()[0]?.model ?? "cpu"} ×${os.cpus().length}`;
const when = new Date().toISOString().slice(0, 10);
await browser.close();

writeFileSync("harness/bench-results.ts", `import type { BenchResult } from "./bench.js";

/** Recorded by \`npm run bench\` (scripts/bench.mjs); headless Chromium. */
export const RECORDED: { when: string; env: string; rows: BenchResult[] } = ${JSON.stringify({ when, env, rows }, null, 2)};
`);
const md = [
  "# Benchmarks",
  "",
  `Recorded ${when} with \`npm run bench\` (median of 3 runs) — ${env}.`,
  "",
  "A dock with 4 groups (one a document area) and N views, each with a short list as content.",
  "",
  "| Views | retain | Model op (mean) | First render | Layout change (mean) | Drag move avg / p95 | Frame avg / p95 |",
  "| ---: | --- | ---: | ---: | ---: | ---: | ---: |",
  ...rows.map((r) => `| ${r.views} | \`${r.retain}\` | ${r.opMs} ms | ${r.renderMs} ms | ${r.commitMs} ms | ${r.dragAvgMs} / ${r.dragP95Ms} ms | ${r.frameAvgMs} / ${r.frameP95Ms} ms |`),
  "",
  "- **Model op**: one pure `place()` on the model.",
  "- **First render**: assigning the model until every part has updated.",
  "- **Layout change**: one undoable `dock.place()` including re-render.",
  "- **Drag move**: one pointer move during a tab drag, including hit-testing and the drop-guide update.",
  "- **Frame**: animation-frame interval during the drag (16.7 ms = 60 fps).",
  "",
  "Run it live on the Performance guide page of the docs site.",
  ""
].join("\n");
writeFileSync("docs/BENCHMARKS.md", md);
console.log(md);
