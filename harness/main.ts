import * as flexdock from "flexdock";
import { pages, type Page, type Example } from "./content.js";

const side = document.getElementById("side")!;
const page = document.getElementById("page")!;
const root = document.documentElement;

// Theme toggle (site + all demos).
const stored = localStorage.getItem("fd-site-theme");
if (stored === "dark" || (!stored && matchMedia("(prefers-color-scheme: dark)").matches)) root.classList.add("dark");
const syncThemes = () => {
  for (const m of Array.from(document.querySelectorAll("flexdock-manager"))) {
    if (!m.hasAttribute("data-fixed-theme")) m.theme = root.classList.contains("dark") ? "dark" : "light";
  }
};
document.getElementById("theme")!.addEventListener("click", () => {
  root.classList.toggle("dark");
  localStorage.setItem("fd-site-theme", root.classList.contains("dark") ? "dark" : "light");
  syncThemes();
});
document.getElementById("menu")!.addEventListener("click", () => side.classList.toggle("open"));

// Sidebar.
const sections = [...new Set(pages.map((p) => p.section))];
side.innerHTML = sections
  .map((s) => `<h4>${s}</h4>` + pages.filter((p) => p.section === s).map((p) => `<a href="#/${p.slug}">${p.title}</a>`).join(""))
  .join("");

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const IMPORTS = ["createModel", "row", "column", "stack", "docs", "Workspaces"];

/** Show example code exactly as it runs. */
export function sourceOf(ex: Example): string {
  const used = IMPORTS.filter((n) => new RegExp(`\\b${n}\\b`).test(ex.code));
  return `import { ${used.join(", ")} } from "flexdock";\n\n${ex.code.trim()}\n`;
}

function mountExample(ex: Example, container: HTMLElement): void {
  const demo = document.createElement("div");
  demo.className = "demo";
  demo.dataset["example"] = ex.id;
  const bar = document.createElement("div");
  bar.className = "toolbar";
  const stage = document.createElement("div");
  stage.className = "stage";
  stage.style.height = `${ex.height ?? 420}px`;
  const events = document.createElement("div");
  events.className = "events";
  events.hidden = true;
  demo.append(bar, stage, events);
  container.append(demo);
  if (ex.code.includes("button(")) bar.hidden = false;
  else bar.remove();
  const button = (label: string, fn: () => void) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", fn);
    bar.append(b);
    return b;
  };
  const log = (text: string) => {
    events.hidden = false;
    const line = document.createElement("div");
    line.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
    events.prepend(line);
  };
  const run = new Function("host", "button", "log", ...IMPORTS, ex.code) as (...a: unknown[]) => void;
  run(stage, button, log, ...IMPORTS.map((n) => (flexdock as Record<string, unknown>)[n]));
  const details = document.createElement("details");
  details.className = "code";
  details.open = ex.openCode ?? false;
  details.innerHTML = `<summary>Code</summary><pre><code>${escapeHtml(sourceOf(ex))}</code></pre>`;
  container.append(details);
}

function render(): void {
  const slug = location.hash.replace(/^#\/?/, "") || "";
  const p: Page = pages.find((x) => x.slug === slug) ?? pages[0]!;
  for (const a of Array.from(side.querySelectorAll("a"))) {
    if (a.getAttribute("href") === `#/${p.slug}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  document.title = p.slug ? `${p.title} — flexdock` : "flexdock — docking layouts for the web";
  page.innerHTML = p.body;
  for (const holder of Array.from(page.querySelectorAll<HTMLElement>("[data-example]"))) {
    const ex = p.examples?.find((e) => e.id === holder.dataset["example"]);
    if (ex) {
      holder.removeAttribute("data-example");
      mountExample(ex, holder);
    }
  }
  p.after?.(page, flexdock);
  syncThemes();
  side.classList.remove("open");
  page.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

addEventListener("hashchange", render);
render();
