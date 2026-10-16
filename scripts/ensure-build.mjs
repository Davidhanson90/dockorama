// Runs `npm run build` when dist/ is missing or older than src/, so tests that use the compiled
// package (src/angular.spec.ts) work on a fresh clone. Cross-platform; no-op when dist/ is current.
import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const marker = join(root, "dist", "angular.js");

function newest(dir) {
  let t = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    t = Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
  }
  return t;
}

const inputs = [join(root, "src"), join(root, "tsconfig.build.json"), join(root, "tsconfig.angular.json")];
const srcTime = Math.max(newest(inputs[0]), ...inputs.slice(1).map((f) => statSync(f).mtimeMs));
if (existsSync(marker) && statSync(marker).mtimeMs >= srcTime) process.exit(0);

console.log("ensure-build: dist/ is missing or stale; running npm run build");
const r = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
