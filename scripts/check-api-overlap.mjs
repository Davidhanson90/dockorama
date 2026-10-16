// Compares dockorama's public API identifiers with an avoid-list of identifiers kept in the private records
// folder (DOCKORAMA_RECORDS, default ../dockorama-records). Generic platform / English identifiers
// are ignored. Fails on any remaining overlap. Skips (with a notice) where the list is absent (CI).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const listPath = join(process.env.DOCKORAMA_RECORDS ?? join(root, "..", "dockorama-records"), "avoid-identifiers.txt");
if (!existsSync(listPath)) {
  console.log("check-api-overlap: no avoid-list found; skipped");
  process.exit(0);
}
const ref = new Set(readFileSync(listPath, "utf8").split("\n").map((s) => s.trim()).filter(Boolean));

// Platform, framework and plain-English identifiers that are not product-specific.
const generic = new Set([
  "addEventListener", "removeEventListener", "preventDefault", "getElementById", "querySelector", "customElements",
  "dispatchEvent", "innerHTML", "textContent", "defineComponents", "aria-label", "font-family", "box-shadow", "z-index",
  "border-radius", "background-color", "margin-right", "margin-top", "margin-left", "border-right", "border-top",
  "ease-in-out", "data-view", "touch-action", "user-select", "max-width", "min-width", "text-align", "line-height",
  "top-level", "right-to-left", "real-time", "built-in", "drag-and-drop", "read-only", "and-drop", "light-theme",
  "JSON", "localStorage", "getItem", "setItem", "updateComplete", "connectedCallback", "requestUpdate", "shadowRoot",
  "slotchange", "pointerdown", "pointermove", "pointerup", "keydown", "stopPropagation", "toggleAttribute"
]);

const ids = new Set();
function walk(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p);
    else if (p.endsWith(".ts") && !p.endsWith(".spec.ts")) {
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/\b[a-zA-Z_$][\w$]*(?:-[a-z0-9]+)*\b/g)) ids.add(m[0]);
    }
  }
}
walk(join(root, "src"));
const overlap = [...ids].filter((id) => ref.has(id) && !generic.has(id) && /[A-Z-]/.test(id.slice(1))).sort();
// Layout-model keys and enum values are checked even when they are single words.
const modelSrc = readFileSync(join(root, "src/core/model.ts"), "utf8");
const modelKeys = new Set([
  ...[...modelSrc.matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1]),
  ...[...modelSrc.matchAll(/"([a-z-]+)"/g)].map((m) => m[1])
]);
const genericKeys = new Set(["x", "y", "w", "h", "left", "right", "top", "bottom"]);
const keyOverlap = [...modelKeys].filter((k) => ref.has(k) && !genericKeys.has(k));
if (keyOverlap.length) overlap.push(...keyOverlap.map((k) => `model key/value: ${k}`));
console.log(`  layout-model keys/values checked: ${modelKeys.size}`);
const plainWords = [...ids].filter((id) => ref.has(id) && !/[A-Z-]/.test(id.slice(1)));
console.log(`check-api-overlap: ${ids.size} identifiers in src, ${ref.size} avoid-list identifiers.`);
console.log(`  single plain words shared (ignored as generic English): ${plainWords.length}`);
if (overlap.length) {
  console.error("  non-generic overlaps — rename these:\n  " + overlap.join("\n  "));
  process.exit(1);
}
console.log("  non-generic overlaps: none");
