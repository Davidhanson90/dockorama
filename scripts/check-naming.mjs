// Naming guard. Fails when code or docs contain a third-party product's names (kept encoded so the
// names themselves never appear in this repo). Extra terms are read from the private records folder
// (PAZURU_RECORDS, default ../pazuru-records/naming-terms.txt) when it is present.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const scanRoots = ["src", "harness", "scripts", "e2e", "docs", ".github", "README.md", "CONTRIBUTING.md", "AGENTS.md", "package.json", "playwright.config.ts"];
const allowed = [`scripts${sep}check-naming.mjs`];
const decoded = Buffer.from("aW5mcmFnaXN0aWNzfGlnbml0ZVtcc18tXT91aXxcYmlnbml0ZVxifFxiaWdbY3hdLXxcYklnW2N4XVtBLVpd", "base64").toString("utf8");
const recordsDir = process.env.PAZURU_RECORDS ?? join(root, "..", "pazuru-records");
const extraPath = join(recordsDir, "naming-terms.txt");
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const extra = existsSync(extraPath)
  ? readFileSync(extraPath, "utf8").split("\n").map((t) => t.trim()).filter(Boolean).map(escape)
  : [];
const pattern = new RegExp([decoded, ...extra].join("|"), "i");
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
  console.error("Third-party product name found:\n" + all.join("\n"));
  process.exit(1);
}
console.log("check-naming: ok");
