// The trading desk demo: a dense, dark, live-updating workspace built from plain DOM, canvas and SVG.
import type { FlexdockManager } from "flexdock";
import { column, createModel, docs, row, stack } from "flexdock";
import { Market, tick, type Instrument } from "./sim.js";
import { deskCss } from "./style.js";

const fmt = (n: number, d = 2): string => n.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const big = (n: number): string => (Math.abs(n) >= 1e6 ? fmt(n / 1e6, 2) + "M" : Math.abs(n) >= 1e3 ? fmt(n / 1e3, 1) + "k" : fmt(n, 0));
const time = (t: number): string => new Date(t).toISOString().slice(11, 19);
const cls = (n: number): string => (n > 0 ? "up" : n < 0 ? "down" : "");
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Keep a canvas sized to its box (device-pixel aware) and redraw on resize. */
function canvasIn(el: HTMLElement, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): { redraw(): void; stop(): void } {
  const cv = document.createElement("canvas");
  el.append(cv);
  const redraw = (): void => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    }
    const g = cv.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    draw(g, w, h);
  };
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(redraw) : undefined;
  ro?.observe(el);
  return { redraw, stop: () => ro?.disconnect() };
}

const VIEWS = {
  watch: { title: "Watchlist", icon: "★" },
  rates: { title: "Rates & macro", icon: "◇" },
  heat: { title: "Sector heatmap", icon: "▦" },
  chart: { title: "Chart", icon: "📈" },
  depth: { title: "Depth", icon: "≋" },
  orders: { title: "Orders", icon: "☰" },
  positions: { title: "Positions & P&L", icon: "Σ" },
  fills: { title: "Fills", icon: "✓" },
  tape: { title: "Time & sales", icon: "⇅" },
  book: { title: "Order book", icon: "⇵" },
  news: { title: "News", icon: "✎" },
  alerts: { title: "Alerts", icon: "!" },
  risk: { title: "Risk & exposure", icon: "◔" },
  ticket: { title: "Order ticket", icon: "⚡", caps: { hide: false, dismiss: false } },
  clock: { title: "Market clock", icon: "◷" }
};

/** Mount the full trading desk into `host`. Returns a cleanup function. */
export function mountTradingDesk(host: HTMLElement, options: { standalone?: boolean } = {}): () => void {
  const mkt = new Market();
  let sel = "AURX";
  const style = document.createElement("style");
  style.textContent = deskCss;
  host.append(style);
  const dock = document.createElement("flexdock-manager") as FlexdockManager;
  dock.theme = "dark";
  dock.setAttribute("data-fixed-theme", "");
  dock.classList.add("td");
  dock.skinPatch = {
    css: `:host { --fd-accent: #f5b041; --fd-accent-ink: #14110a; --fd-canvas: #07090d; --fd-surface: #0d1118; --fd-surface-2: #121823;
      --fd-ink: #d8dee9; --fd-ink-soft: #7b8696; --fd-line: #1e2633; --fd-radius: 4px; --fd-bar-height: 28px; --fd-gutter: 4px;
      --fd-font: "Inter", system-ui, sans-serif; --fd-font-size: 12px; --fd-target: rgb(245 176 65 / 0.16); }
      .stack[data-active] { border-color: #f5b04188; }
      .main { padding: 3px; }`
  };
  host.append(dock);
  const el: Record<string, HTMLElement> = {};
  for (const id of Object.keys(VIEWS)) {
    const v = document.createElement("div");
    v.dataset["view"] = id;
    v.className = `td-view td-v-${id}`;
    dock.append(v);
    el[id] = v;
  }
  dock.model = createModel(
    VIEWS,
    row([
      column([stack(["watch", "rates"]), stack(["heat"])], [1.6, 1]),
      column([docs(["chart", "depth"]), row([docs(["orders", "positions", "fills"]), stack(["tape"])], [2.4, 1])], [1.7, 1]),
      column([stack(["book"]), stack(["news", "alerts"])], [1.3, 1])
    ], [1.25, 3.4, 1.25]),
    {
      windows: [
        { key: "ticket", box: { x: options.standalone ? 560 : 360, y: 60, w: 270, h: 300 }, tree: stack(["ticket"]) },
        { key: "clock", box: { x: options.standalone ? 860 : 650, y: 60, w: 320, h: 170 }, tree: stack(["clock"]) }
      ],
      drawers: { start: [], end: ["risk"], top: [], bottom: [] }
    }
  );

  // ---------------------------------------------------------------- watchlist
  el["watch"]!.innerHTML = `<table class="td-grid"><thead><tr><th>Sym</th><th>Last</th><th>Chg%</th><th>Vol</th><th class="td-spark-h">5m</th></tr></thead><tbody></tbody></table>`;
  el["watch"]!.addEventListener("click", (e) => {
    const tr = (e.target as HTMLElement).closest<HTMLElement>("[data-sym]");
    if (tr) select(tr.dataset["sym"]!);
  });
  const last = new Map<string, number>();
  const spark = (sym: string): string => {
    const cs = mkt.candles.get(sym)!.slice(-30);
    const lo = Math.min(...cs.map((c) => c.l));
    const hi = Math.max(...cs.map((c) => c.h));
    const pts = cs.map((c, i) => `${(i / 29) * 60},${18 - ((c.c - lo) / (hi - lo || 1)) * 16}`).join(" ");
    const up = cs[cs.length - 1]!.c >= cs[0]!.o;
    return `<svg viewBox="0 0 60 20" width="60" height="20"><polyline fill="none" stroke="${up ? "#2ecc71" : "#ff5b5b"}" stroke-width="1.2" points="${pts}"/></svg>`;
  };
  const drawWatch = (): void => {
    const body = el["watch"]!.querySelector("tbody")!;
    body.innerHTML = mkt.list.map((i) => {
      const chg = (i.last / i.prev - 1) * 100;
      const prev = last.get(i.sym);
      const flash = prev === undefined || prev === i.last ? "" : i.last > prev ? " flash-up" : " flash-down";
      last.set(i.sym, i.last);
      return `<tr data-sym="${i.sym}" class="${i.sym === sel ? "sel" : ""}"><td><b>${i.sym}</b><small>${esc(i.name)}</small></td>
        <td class="num${flash}">${fmt(i.last)}</td><td class="num ${cls(chg)}">${chg >= 0 ? "+" : ""}${fmt(chg)}</td><td class="num dim">${big(i.vol)}</td><td>${spark(i.sym)}</td></tr>`;
    }).join("");
  };

  // ---------------------------------------------------------------- rates
  const drawRates = (): void => {
    el["rates"]!.innerHTML = `<div class="td-tiles">${mkt.rates.map((r) => `<div class="td-tile"><span>${r.name}</span>
      <b class="${cls(r.px - r.prev)}">${r.px.toFixed(r.dp)}</b><small class="${cls(r.px - r.prev)}">${r.px >= r.prev ? "▲" : "▼"} ${Math.abs(r.px - r.prev).toFixed(r.dp)}</small></div>`).join("")}</div>`;
  };

  // ---------------------------------------------------------------- heatmap
  const drawHeat = (): void => {
    el["heat"]!.innerHTML = `<div class="td-heat">${mkt.list.map((i) => {
      const chg = (i.last / i.prev - 1) * 100;
      const a = Math.min(1, Math.abs(chg) / 4);
      const bg = chg >= 0 ? `rgb(46 204 113 / ${0.12 + a * 0.7})` : `rgb(255 91 91 / ${0.12 + a * 0.7})`;
            return `<div data-sym="${i.sym}" style="background:${bg}"><b>${i.sym}</b><span>${chg >= 0 ? "+" : ""}${fmt(chg)}%</span><small>${i.sector}</small></div>`;
    }).join("")}</div>`;
  };
  el["heat"]!.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-sym]");
    if (t) select(t.dataset["sym"]!);
  });

  // ---------------------------------------------------------------- candlestick chart
  el["chart"]!.innerHTML = `<div class="td-chart-head"><b class="td-chart-sym"></b><span class="td-chart-q"></span>
    <span class="td-legend"><i style="background:#f5b041"></i>MA 9 <i style="background:#5dade2"></i>MA 21</span></div><div class="td-canvas"></div>`;
  const chart = canvasIn(el["chart"]!.querySelector(".td-canvas")!, (g, w, h) => {
    const cs = mkt.candles.get(sel)!;
    const n = Math.max(20, Math.min(cs.length, Math.floor((w - 60) / 7)));
    const vis = cs.slice(-n);
    const volH = h * 0.18;
    const top = 10;
    const ph = h - volH - top - 18;
    const lo = Math.min(...vis.map((c) => c.l));
    const hi = Math.max(...vis.map((c) => c.h));
    const y = (p: number): number => top + (1 - (p - lo) / (hi - lo || 1)) * ph;
    const cw = (w - 60) / n;
    g.font = "10px ui-monospace, monospace";
    g.strokeStyle = "#1a2230";
    g.fillStyle = "#6b7685";
    for (let k = 0; k <= 5; k++) {
      const p = lo + ((hi - lo) * k) / 5;
      const yy = y(p);
      g.beginPath(); g.moveTo(0, yy); g.lineTo(w - 58, yy); g.stroke();
      g.fillText(fmt(p), w - 54, yy + 3);
    }
    const vmax = Math.max(...vis.map((c) => c.v));
    vis.forEach((c, i) => {
      const x = i * cw + cw / 2;
      const up = c.c >= c.o;
      g.strokeStyle = g.fillStyle = up ? "#2ecc71" : "#ff5b5b";
      g.beginPath(); g.moveTo(x, y(c.h)); g.lineTo(x, y(c.l)); g.stroke();
      const bt = y(Math.max(c.o, c.c));
      g.fillRect(x - cw * 0.35, bt, cw * 0.7, Math.max(1, y(Math.min(c.o, c.c)) - bt));
      g.globalAlpha = 0.35;
      const vh = (c.v / vmax) * volH;
      g.fillRect(x - cw * 0.35, h - 16 - vh, cw * 0.7, vh);
      g.globalAlpha = 1;
      if (i % 15 === 0) { g.fillStyle = "#6b7685"; g.fillText(time(c.t).slice(0, 5), x - 12, h - 4); }
    });
    for (const [len, col] of [[9, "#f5b041"], [21, "#5dade2"]] as const) {
      g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath();
      vis.forEach((_, i) => {
        const idx = cs.length - n + i;
        if (idx < len) return;
        const avg = cs.slice(idx - len + 1, idx + 1).reduce((a, c) => a + c.c, 0) / len;
        const x = i * cw + cw / 2;
        if (i === 0 || idx === len) g.moveTo(x, y(avg)); else g.lineTo(x, y(avg));
      });
      g.stroke(); g.lineWidth = 1;
    }
    const lp = mkt.get(sel).last;
    g.setLineDash([3, 3]); g.strokeStyle = "#f5b041"; g.beginPath(); g.moveTo(0, y(lp)); g.lineTo(w - 58, y(lp)); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#f5b041"; g.fillRect(w - 58, y(lp) - 8, 58, 16); g.fillStyle = "#14110a"; g.fillText(fmt(lp), w - 54, y(lp) + 3);
  });

  // ---------------------------------------------------------------- depth chart
  el["depth"]!.innerHTML = `<div class="td-canvas"></div>`;
  let book = mkt.book(sel);
  const depth = canvasIn(el["depth"]!.querySelector(".td-canvas")!, (g, w, h) => {
    const cum = (side: Array<[number, number]>): Array<[number, number]> => { let s = 0; return side.map(([p, q]) => [p, (s += q)]); };
    const b = cum(book.bids);
    const a = cum(book.asks);
    const lo = b[b.length - 1]![0];
    const hi = a[a.length - 1]![0];
    const max = Math.max(b[b.length - 1]![1], a[a.length - 1]![1]);
    const x = (p: number): number => ((p - lo) / (hi - lo)) * w;
    const y = (q: number): number => h - 14 - (q / max) * (h - 30);
    for (const [pts, col] of [[b, "46 204 113"], [a, "255 91 91"]] as const) {
      g.beginPath(); g.moveTo(x(pts[0]![0]), h - 14);
      for (const [p, q] of pts) g.lineTo(x(p), y(q));
      g.lineTo(x(pts[pts.length - 1]![0]), h - 14); g.closePath();
      g.fillStyle = `rgb(${col} / 0.25)`; g.fill(); g.strokeStyle = `rgb(${col})`; g.stroke();
    }
    g.fillStyle = "#6b7685"; g.font = "10px ui-monospace, monospace";
    g.fillText(fmt(lo), 4, h - 2); g.fillText(fmt(hi), w - 50, h - 2); g.fillText(`mid ${fmt(mkt.get(sel).last)}`, w / 2 - 30, 12);
  });

  // ---------------------------------------------------------------- order book
  const drawBook = (): void => {
    book = mkt.book(sel);
    const max = Math.max(...book.bids.map((b) => b[1]), ...book.asks.map((a) => a[1]));
    const row = (p: number, q: number, side: string): string =>
      `<tr class="${side}"><td class="num">${fmt(q, 0)}</td><td class="num px">${fmt(p, p < 10 ? 3 : 2)}</td><td class="bar"><i style="width:${(q / max) * 100}%"></i></td></tr>`;
    const ins = mkt.get(sel);
    el["book"]!.innerHTML = `<div class="td-book-head"><b>${sel}</b> <span>spread ${fmt(tick(ins.last) * 2, 3)}</span></div><table class="td-book">
      ${[...book.asks].slice(0, 10).reverse().map(([p, q]) => row(p, q, "ask")).join("")}
      <tr class="mid"><td colspan="3">${fmt(ins.last)} <span class="${cls(ins.last - ins.prev)}">${ins.last >= ins.prev ? "▲" : "▼"}</span></td></tr>
      ${book.bids.slice(0, 10).map(([p, q]) => row(p, q, "bid")).join("")}</table>`;
  };

  // ---------------------------------------------------------------- tape
  const drawTape = (): void => {
    el["tape"]!.innerHTML = `<table class="td-grid td-tape"><thead><tr><th>Time</th><th>Sym</th><th>Px</th><th>Qty</th></tr></thead><tbody>${mkt.tape.slice(0, 60).map((p) =>
      `<tr class="${p.side === "B" ? "up" : "down"}${p.sym === sel ? " sel" : ""}"><td class="dim">${time(p.t)}</td><td>${p.sym}</td><td class="num">${fmt(p.px)}</td><td class="num">${fmt(p.qty, 0)}</td></tr>`).join("")}</tbody></table>`;
  };

  // ---------------------------------------------------------------- orders / fills / positions
  el["orders"]!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-cancel]");
    if (b) { mkt.cancel(Number(b.dataset["cancel"])); drawOrders(); }
  });
  const drawOrders = (): void => {
    const rows = mkt.orders.slice(0, 40);
    el["orders"]!.innerHTML = rows.length
      ? `<table class="td-grid"><thead><tr><th>ID</th><th>Time</th><th>Side</th><th>Sym</th><th>Type</th><th>Qty</th><th>Filled</th><th>Px</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((o) =>
        `<tr><td class="dim">${o.id}</td><td class="dim">${time(o.t)}</td><td class="${o.side === "BUY" ? "up" : "down"}">${o.side}</td><td>${o.sym}</td><td>${o.type}</td>
        <td class="num">${fmt(o.qty, 0)}</td><td class="num"><span class="td-prog"><i style="width:${(o.filled / o.qty) * 100}%"></i></span>${fmt(o.filled, 0)}</td><td class="num">${o.type === "MKT" ? "MKT" : fmt(o.px)}</td>
        <td><span class="td-pill ${o.status.toLowerCase()}">${o.status}</span></td><td>${o.status === "WORKING" ? `<button class="td-x" data-cancel="${o.id}" title="Cancel">✕</button>` : ""}</td></tr>`).join("")}</tbody></table>`
      : `<p class="td-empty">No orders yet — use the order ticket.</p>`;
  };
  const drawFills = (): void => {
    const fills = mkt.alerts.filter((a) => a.text.startsWith("Filled"));
    el["fills"]!.innerHTML = fills.length ? `<ul class="td-list">${fills.map((f) => `<li><span class="dim">${time(f.t)}</span> ${esc(f.text)}</li>`).join("")}</ul>` : `<p class="td-empty">No fills yet.</p>`;
  };
  const drawPositions = (): void => {
    let upl = 0;
    let rpl = 0;
    const rows = [...mkt.positions.values()].map((p) => {
      const ins = mkt.get(p.sym);
      const u = (ins.last - p.avg) * p.qty;
      upl += u;
      rpl += p.realised;
      return `<tr data-sym="${p.sym}"><td><b>${p.sym}</b></td><td class="num ${cls(p.qty)}">${fmt(p.qty, 0)}</td><td class="num">${fmt(p.avg)}</td><td class="num">${fmt(ins.last)}</td>
        <td class="num">${big(p.qty * ins.last)}</td><td class="num ${cls(u)}">${fmt(u, 0)}</td><td class="num ${cls(p.realised)}">${fmt(p.realised, 0)}</td></tr>`;
    });
    el["positions"]!.innerHTML = `<div class="td-kpis"><div><span>Unrealised</span><b class="${cls(upl)}">${fmt(upl, 0)}</b></div><div><span>Realised</span><b class="${cls(rpl)}">${fmt(rpl, 0)}</b></div>
      <div><span>Total P&amp;L</span><b class="${cls(upl + rpl)}">${fmt(upl + rpl, 0)}</b></div></div>
      <table class="td-grid"><thead><tr><th>Sym</th><th>Qty</th><th>Avg</th><th>Last</th><th>Notional</th><th>uP&amp;L</th><th>rP&amp;L</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
  };
  el["positions"]!.addEventListener("click", (e) => {
    const tr = (e.target as HTMLElement).closest<HTMLElement>("[data-sym]");
    if (tr) select(tr.dataset["sym"]!);
  });

  // ---------------------------------------------------------------- news & alerts
  const drawNews = (): void => {
    el["news"]!.innerHTML = `<ul class="td-news">${mkt.news.map((n) => `<li><span class="dim">${time(n.t)}</span>${n.sym ? `<b data-sym="${n.sym}">${n.sym}</b>` : `<b class="macro">MACRO</b>`}
      <span>${esc(n.text)}</span><i class="${n.tone > 0.2 ? "up" : n.tone < -0.2 ? "down" : "dim"}">${n.tone > 0.2 ? "▲" : n.tone < -0.2 ? "▼" : "•"}</i></li>`).join("")}</ul>`;
  };
  el["news"]!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-sym]");
    if (b) select(b.dataset["sym"]!);
  });
  const drawAlerts = (): void => {
    el["alerts"]!.innerHTML = mkt.alerts.length
      ? `<ul class="td-alerts">${mkt.alerts.map((a) => `<li class="${a.level}"><span class="dim">${time(a.t)}</span>${esc(a.text)}</li>`).join("")}</ul>`
      : `<p class="td-empty">Alerts appear here (fills, big moves, limit breaches).</p>`;
  };

  // ---------------------------------------------------------------- risk
  const gauge = (label: string, v: number, max: number, unit = ""): string => {
    const f = Math.max(0, Math.min(1, Math.abs(v) / max));
    const ang = Math.PI * (1 - f);
    const x = 50 + 38 * Math.cos(ang);
    const y = 50 - 38 * Math.sin(ang);
    const col = f > 0.8 ? "#ff5b5b" : f > 0.55 ? "#f5b041" : "#2ecc71";
    return `<figure><svg viewBox="0 0 100 60"><path d="M12 50 A38 38 0 0 1 88 50" stroke="#1e2633" stroke-width="8" fill="none"/>
      <path d="M12 50 A38 38 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" stroke="${col}" stroke-width="8" fill="none"/></svg><b>${big(v)}${unit}</b><figcaption>${label}</figcaption></figure>`;
  };
  const drawRisk = (): void => {
    let gross = 0;
    let net = 0;
    const bySector = new Map<string, number>();
    for (const p of mkt.positions.values()) {
      const ins = mkt.get(p.sym);
      const n = p.qty * ins.last;
      gross += Math.abs(n);
      net += n;
      bySector.set(ins.sector, (bySector.get(ins.sector) ?? 0) + n);
    }
    const max = Math.max(1, ...[...bySector.values()].map(Math.abs));
    el["risk"]!.innerHTML = `<div class="td-gauges">${gauge("Gross", gross, 1_200_000)}${gauge("Net", net, 800_000)}${gauge("VaR 95%", gross * 0.021, 40_000)}</div>
      <h4>Exposure by sector</h4><div class="td-bars">${[...bySector].map(([s, n]) => `<div><span>${s}</span><i class="${n >= 0 ? "long" : "short"}" style="width:${(Math.abs(n) / max) * 100}%"></i><b>${big(n)}</b></div>`).join("")}</div>`;
  };

  // ---------------------------------------------------------------- ticket
  el["ticket"]!.innerHTML = `<form class="td-ticket">
    <div class="td-ticket-sym"><b class="sym"></b><span class="q"></span></div>
    <div class="td-seg"><button type="button" data-side="BUY" class="on">Buy</button><button type="button" data-side="SELL">Sell</button></div>
    <label>Type <select name="type"><option value="LMT">Limit</option><option value="MKT">Market</option></select></label>
    <label>Qty <input name="qty" type="number" min="100" step="100" value="500"></label>
    <label>Limit <input name="px" type="number" step="0.01"></label>
    <div class="td-ticket-est">Est. notional <b class="est"></b></div>
    <button class="td-send" type="submit">Send order</button></form>`;
  const form = el["ticket"]!.querySelector("form")!;
  let side: "BUY" | "SELL" = "BUY";
  form.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-side]");
    if (!b) return;
    side = b.dataset["side"] as "BUY" | "SELL";
    form.querySelectorAll("[data-side]").forEach((x) => x.classList.toggle("on", x === b));
    form.classList.toggle("sell", side === "SELL");
    syncTicket(true);
  });
  form.addEventListener("input", () => syncTicket(false));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const qty = Math.max(100, Number(f.get("qty")) || 100);
    const type = f.get("type") as "LMT" | "MKT";
    mkt.place(sel, side, qty, Number(f.get("px")) || mkt.get(sel).last, type);
    drawOrders();
    drawAlerts();
    dock.reveal("orders");
  });
  const syncTicket = (resetPx: boolean): void => {
    const ins = mkt.get(sel);
    form.querySelector(".sym")!.textContent = sel;
    form.querySelector(".q")!.textContent = `${fmt(ins.last)}  ${ins.name}`;
    const px = form.querySelector<HTMLInputElement>("[name=px]")!;
    if (resetPx || !px.value) px.value = (side === "BUY" ? ins.last - tick(ins.last) : ins.last + tick(ins.last)).toFixed(2);
    const qty = Number(form.querySelector<HTMLInputElement>("[name=qty]")!.value) || 0;
    form.querySelector(".est")!.textContent = fmt(qty * Number(px.value), 0);
  };

  // ---------------------------------------------------------------- clock
  const VENUES: Array<[string, number, number, number]> = [["Zenland", 1, 8, 16.5], ["Orbital", -4, 9.5, 16], ["Kalari", 9, 9, 15], ["Vantis", 0, 8, 16.5]];
  const drawClock = (): void => {
    const d = new Date(mkt.now);
    const h = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    const hand = (deg: number, len: number, w: number, col: string): string => {
      const r = ((deg - 90) * Math.PI) / 180;
      return `<line x1="50" y1="50" x2="${(50 + len * Math.cos(r)).toFixed(1)}" y2="${(50 + len * Math.sin(r)).toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
    };
    const ticks = Array.from({ length: 12 }, (_, i) => { const r = (i * 30 * Math.PI) / 180; return `<line x1="${50 + 40 * Math.cos(r)}" y1="${50 + 40 * Math.sin(r)}" x2="${50 + 44 * Math.cos(r)}" y2="${50 + 44 * Math.sin(r)}" stroke="#3a4558"/>`; }).join("");
    el["clock"]!.innerHTML = `<div class="td-clock"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#0a0e14" stroke="#1e2633"/>${ticks}
      ${hand((h % 12) * 30, 24, 3, "#d8dee9")}${hand(d.getUTCMinutes() * 6, 34, 2, "#d8dee9")}${hand(d.getUTCSeconds() * 6, 38, 1, "#f5b041")}</svg>
      <ul>${VENUES.map(([n, off, o, c]) => {
        const lh = (h + off + 24) % 24;
        const open = lh >= o && lh < c;
        const left = open ? c - lh : (o - lh + 24) % 24;
        return `<li><span class="dot ${open ? "open" : ""}"></span><b>${n}</b><span>${String(Math.floor(lh)).padStart(2, "0")}:${String(Math.floor((lh % 1) * 60)).padStart(2, "0")}</span>
          <small>${open ? "closes" : "opens"} in ${Math.floor(left)}h${String(Math.floor((left % 1) * 60)).padStart(2, "0")}</small></li>`;
      }).join("")}</ul></div>`;
  };

  // ---------------------------------------------------------------- wiring
  const drawSel = (): void => {
    const ins: Instrument = mkt.get(sel);
    el["chart"]!.querySelector(".td-chart-sym")!.textContent = `${sel} · 1m`;
    const chg = (ins.last / ins.prev - 1) * 100;
    el["chart"]!.querySelector(".td-chart-q")!.innerHTML = `<b class="${cls(chg)}">${fmt(ins.last)}</b> <span class="${cls(chg)}">${chg >= 0 ? "+" : ""}${fmt(chg)}%</span>
      <span class="dim">O ${fmt(ins.open)} H ${fmt(ins.high)} L ${fmt(ins.low)} V ${big(ins.vol)}</span>`;
  };
  function select(sym: string): void {
    sel = sym;
    syncTicket(true);
    drawAll();
  }
  const visible = (id: string): boolean => el[id]!.isConnected && el[id]!.offsetParent !== null && el[id]!.clientWidth > 0;
  let frame = 0;
  function drawAll(): void {
    drawWatch(); drawRates(); drawHeat(); drawSel(); drawBook(); drawTape(); drawOrders(); drawPositions(); drawFills(); drawNews(); drawAlerts(); drawRisk(); drawClock();
    if (visible("chart")) chart.redraw();
    if (visible("depth")) depth.redraw();
  }
  syncTicket(true);
  drawAll();
  dock.addEventListener("flexdock-viewshow", (e) => {
    if (e.detail.id === "chart") requestAnimationFrame(() => chart.redraw());
    if (e.detail.id === "depth") requestAnimationFrame(() => depth.redraw());
  });
  const timer = window.setInterval(() => {
    if (!host.isConnected) return stop();
    mkt.step();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(drawAll);
  }, 450);
  function stop(): void {
    clearInterval(timer);
    cancelAnimationFrame(frame);
    chart.stop();
    depth.stop();
  }
  return stop;
}
