// Clean-room naming guard. Fails when core code or docs mention the reference product's vendor,
// product family or element/class prefixes. Allowed only in docs/CLEAN-ROOM.md, docs/PROVENANCE.md,
// docs/IP-AUDIT.md, docs/specs/ and e2e/reference/ — none of which are published to the docs site.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const scanRoots = ["src", "harness", "scripts", "e2e", "docs", "README.md", "CONTRIBUTING.md", "AGENTS.md", "package.json", "playwright.config.ts"];
const allowed = [
  `docs${sep}PROVENANCE.md`,
  `docs${sep}CLEAN-ROOM.md`,
  `docs${sep}IP-AUDIT.md`,
  `docs${sep}specs${sep}`,
  `e2e${sep}reference${sep}`,
  `e2e${sep}README.md`,
  `scripts${sep}check-naming.mjs`,
  `scripts${sep}check-api-overlap.mjs`
];
// Vendor, product family, and web-component / Angular prefixes (xx-, xx-, IgcFoo, xxFoo).
const pattern = /third-party|third-party[\s_-]?ui|\bthird-party\b|\big[cx]-|\bIg[cx][A-Z]/i;
const skipDirs = new Set(["node_modules", "dist", "harness-dist", "coverage", "e2e-results", "test-results", "playwright-report", ".git"]);
const problems = [];

function walk(path) {
  const stats = statSync(path, { throwIfNoEntry: false });
  if (!stats) return;
  if (stats.isDirectory()) {
    for (const name of readdirSync(path)) if (!skipDirs.has(name)) walk(join(path, name));
    return;
  }
  const rel = relative(root, path);
  if (allowed.some((prefix) => rel.startsWith(prefix))) return;
  if (!/\.(ts|js|mjs|css|html|md|json|svg)$/.test(rel)) return;
  readFileSync(path, "utf8").split("\n").forEach((line, index) => {
    if (pattern.test(line)) problems.push(`${rel}:${index + 1}: ${line.trim().slice(0, 120)}`);
  });
}

for (const entry of scanRoots) walk(join(root, entry));

const all = problems;

if (all.length) {
  console.error("Reference-product name found outside the allowed clean-room locations:\n" + all.join("\n"));
  process.exit(1);
}
console.log("check-naming: ok");
