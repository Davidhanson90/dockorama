// Benchmark used by the "Performance" guide page and scripts/bench.mjs.
import type * as Lib from "flexdock";

export interface BenchResult {
  views: number;
  retain: "all" | "active";
  /** Pure model ops (move a view to another group), mean ms per op. */
  opMs: number;
  /** First render: model assigned → parts updated, ms. */
  renderMs: number;
  /** One undoable layout change through the manager incl. re-render, mean ms. */
  commitMs: number;
  /** Drag: work per pointermove incl. drop-guide update, mean / p95 ms. */
  dragAvgMs: number;
  dragP95Ms: number;
  /** Drag: animation frame interval while dragging, mean / p95 ms (16.7 = 60 fps). */
  frameAvgMs: number;
  frameP95Ms: number;
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const p95 = (a: number[]) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * 0.95))] ?? 0;
const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
const round = (n: number) => Math.round(n * 100) / 100;

export async function runBench(lib: typeof Lib, host: HTMLElement, views: number, retain: "all" | "active" = "all"): Promise<BenchResult> {
  const { createModel, docs, row, stack, place } = lib;
  host.replaceChildren();
  const dock = document.createElement("flexdock-manager") as Lib.FlexdockManager;
  dock.style.cssText = "display:block;height:420px";
  dock.retain = retain;
  const info: Record<string, Lib.ViewInfo> = {};
  const groups: string[][] = [[], [], [], []];
  for (let i = 0; i < views; i++) {
    const id = `v${i}`;
    info[id] = { title: `View ${i}` };
    groups[i % 4]!.push(id);
    const el = document.createElement("div");
    el.dataset["view"] = id;
    el.innerHTML = `<p>View ${i}</p><ul>${"<li>row</li>".repeat(20)}</ul>`;
    dock.append(el);
  }
  host.append(dock);
  const model = createModel(info, row([stack(groups[0]!), docs(groups[1]!), stack(groups[2]!), stack(groups[3]!)]));

  let t = performance.now();
  dock.model = model;
  await dock.updateComplete;
  for (const el of Array.from(dock.shadowRoot!.querySelectorAll("*"))) if ("updateComplete" in el) await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  const renderMs = performance.now() - t;
  await frame();

  const N = 200;
  let m = model;
  t = performance.now();
  for (let i = 0; i < N; i++) m = place(m, `v${(i * 7) % views}`, `v${(i * 7 + 1) % views}`, "into");
  const opMs = (performance.now() - t) / N;

  const commits: number[] = [];
  for (let i = 0; i < 20; i++) {
    t = performance.now();
    dock.place(`v${(i * 4) % views}`, `v${(i * 4 + 2) % views}`, "into");
    await dock.updateComplete;
    commits.push(performance.now() - t);
  }

  dock.model = model;
  await dock.updateComplete;
  await frame();
  const tab = dock.shadowRoot!.querySelector<HTMLElement>(".tab")!;
  const r = tab.getBoundingClientRect();
  const hr = dock.getBoundingClientRect();
  const opts = (x: number, y: number) => ({ bubbles: true, composed: true, clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true });
  tab.dispatchEvent(new PointerEvent("pointerdown", opts(r.left + 10, r.top + 10)));
  const work: number[] = [];
  const frames: number[] = [];
  let last = await frame();
  for (let i = 0; i < 60; i++) {
    const x = hr.left + 20 + ((hr.width - 40) * i) / 59;
    const y = hr.top + hr.height / 2 + Math.sin(i / 5) * 80;
    t = performance.now();
    window.dispatchEvent(new PointerEvent("pointermove", opts(x, y)));
    await dock.updateComplete;
    work.push(performance.now() - t);
    const now = await frame();
    frames.push(now - last);
    last = now;
  }
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  window.dispatchEvent(new PointerEvent("pointerup", opts(0, 0)));
  await dock.updateComplete;
  const result: BenchResult = {
    views, retain, opMs: round(opMs), renderMs: round(renderMs), commitMs: round(mean(commits)),
    dragAvgMs: round(mean(work)), dragP95Ms: round(p95(work)), frameAvgMs: round(mean(frames.slice(1))), frameP95Ms: round(p95(frames.slice(1)))
  };
  return result;
}

export function benchTable(rows: BenchResult[]): string {
  const head = "<tr><th>Views</th><th>retain</th><th>Model op</th><th>First render</th><th>Layout change</th><th>Drag move avg / p95</th><th>Frame avg / p95</th></tr>";
  return `<table>${head}${rows.map((r) => `<tr><td>${r.views}</td><td><code>${r.retain}</code></td><td>${r.opMs} ms</td><td>${r.renderMs} ms</td><td>${r.commitMs} ms</td><td>${r.dragAvgMs} / ${r.dragP95Ms} ms</td><td>${r.frameAvgMs} / ${r.frameP95Ms} ms</td></tr>`).join("")}</table>`;
}
