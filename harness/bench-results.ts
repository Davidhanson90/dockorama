import type { BenchResult } from "./bench.js";

/** Recorded by `npm run bench` (scripts/bench.mjs); headless Chromium. */
export const RECORDED: { when: string; env: string; rows: BenchResult[] } = {
  "when": "2026-10-14",
  "env": "Chromium 156.0.8078.4 headless, Intel(R) Xeon(R) Processor ×8",
  "rows": [
    {
      "views": 100,
      "retain": "all",
      "opMs": 0.07,
      "renderMs": 14.5,
      "commitMs": 6.13,
      "dragAvgMs": 3.54,
      "dragP95Ms": 5.8,
      "frameAvgMs": 16.67,
      "frameP95Ms": 16.8
    },
    {
      "views": 500,
      "retain": "all",
      "opMs": 0.45,
      "renderMs": 54.6,
      "commitMs": 28.16,
      "dragAvgMs": 12.66,
      "dragP95Ms": 17.3,
      "frameAvgMs": 16.67,
      "frameP95Ms": 16.7
    },
    {
      "views": 500,
      "retain": "active",
      "opMs": 0.42,
      "renderMs": 70,
      "commitMs": 37.77,
      "dragAvgMs": 13.56,
      "dragP95Ms": 22.6,
      "frameAvgMs": 16.95,
      "frameP95Ms": 16.7
    }
  ]
};
