// Invented market data for the trading desk demo. Nothing here is a real instrument or a real price.

export interface Instrument {
  sym: string;
  name: string;
  sector: string;
  last: number;
  open: number;
  high: number;
  low: number;
  vol: number;
  prev: number;
  bias: number;
}
export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }
export interface Print { t: number; sym: string; px: number; qty: number; side: "B" | "S" }
export interface Order { id: number; t: number; sym: string; side: "BUY" | "SELL"; qty: number; px: number; type: "LMT" | "MKT"; status: "WORKING" | "FILLED" | "CANCELLED"; filled: number }
export interface Position { sym: string; qty: number; avg: number; realised: number }
export interface Alert { id: number; t: number; sym: string; text: string; level: "info" | "warn" | "hot" }
export interface Headline { t: number; sym?: string; text: string; tone: number }

const SECTORS = ["Compute", "Energy", "Health", "Finance", "Retail", "Transport"];
const DEFS: Array<[string, string, number, number]> = [
  ["AURX", "Aurex Systems", 182.4, 0], ["BLNT", "Bolent Power", 61.07, 1], ["CRVO", "Corvo Bio", 12.33, 2], ["DELM", "Delmar Capital", 940.1, 3],
  ["EKKO", "Ekko Retail", 77.5, 4], ["FYNE", "Fyne Freight", 33.9, 5], ["GLYD", "Glyde Labs", 248.6, 0], ["HALO", "Halo Grid", 19.42, 1],
  ["IRIS", "Iris Therapeutics", 54.1, 2], ["JOLT", "Jolt Payments", 121.8, 3], ["KAPA", "Kapa Outfitters", 8.76, 4], ["LUMN", "Lumen Rail", 66.3, 5],
  ["MORA", "Mora Quantum", 410.2, 0], ["NIVO", "Nivo Solar", 27.15, 1], ["OPAL", "Opal Insure", 88.4, 3], ["PYRA", "Pyra Foods", 43.6, 4]
];
export const RATES: Array<[string, number, number]> = [["ZEN/ORB", 1.0842, 4], ["ORB/KAL", 151.37, 2], ["VLT/ZEN", 0.8571, 4], ["BRIX-10Y", 4.212, 3], ["SOLX", 2391.5, 1], ["CRUDE-X", 78.44, 2]];

let seed = 20261014;
/** Small deterministic PRNG so first paint is the same every time. */
export const rnd = (): number => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const gauss = (): number => (rnd() + rnd() + rnd() - 1.5) / 1.5;
const round = (n: number, p: number): number => Math.round(n * 10 ** p) / 10 ** p;
export const tick = (px: number): number => (px >= 100 ? 0.05 : px >= 10 ? 0.01 : 0.005);

const HEADLINES = [
  "{n} wins multi-year supply contract", "{n} guides above consensus", "Analyst desk lifts {s} target", "{n} shares halted briefly on volatility band",
  "Regulator opens review of {n} unit", "{n} announces buyback programme", "{s} options volume spikes ahead of results", "{n} CEO to present at sector summit",
  "Block trade in {s} crosses at discount", "{n} cuts outlook on input costs"
];
const MACRO = ["Central bank of Zenland holds rates", "Orbital PMI beats expectations", "Kalari bond auction tails", "Freight index rises for third week", "Crude-X inventories draw sharply", "Volatility index eases from highs"];

export class Market {
  readonly list: Instrument[];
  readonly candles = new Map<string, Candle[]>();
  readonly tape: Print[] = [];
  readonly orders: Order[] = [];
  readonly positions = new Map<string, Position>();
  readonly alerts: Alert[] = [];
  readonly news: Headline[] = [];
  rates = RATES.map(([n, p, d]) => ({ name: n, px: p, prev: p, dp: d }));
  now = Date.UTC(2026, 9, 14, 13, 30, 0);
  private nextId = 1000;
  private listeners = new Set<() => void>();

  constructor() {
    this.list = DEFS.map(([sym, name, px, sec]) => ({ sym, name, sector: SECTORS[sec]!, last: px, open: px, high: px, low: px, vol: 0, prev: round(px * (1 + gauss() * 0.02), 2), bias: gauss() * 0.0004 }));
    for (const ins of this.list) {
      const cs: Candle[] = [];
      let p = ins.prev;
      for (let i = 0; i < 90; i++) {
        const o = p;
        const c = Math.max(0.5, o * (1 + gauss() * 0.006 + ins.bias * 3));
        const h = Math.max(o, c) * (1 + rnd() * 0.004);
        const l = Math.min(o, c) * (1 - rnd() * 0.004);
        cs.push({ t: this.now - (90 - i) * 60000, o, h, l, c, v: Math.round(2000 + rnd() * 9000) });
        p = c;
      }
      ins.last = ins.open = round(p, 2);
      ins.high = Math.max(...cs.slice(-30).map((c) => c.h));
      ins.low = Math.min(...cs.slice(-30).map((c) => c.l));
      this.candles.set(ins.sym, cs);
    }
    this.positions.set("AURX", { sym: "AURX", qty: 1500, avg: 176.2, realised: 0 });
    this.positions.set("EKKO", { sym: "EKKO", qty: -800, avg: 79.9, realised: 0 });
    this.positions.set("JOLT", { sym: "JOLT", qty: 600, avg: 118.4, realised: 0 });
    this.positions.set("MORA", { sym: "MORA", qty: 120, avg: 402.0, realised: 1250 });
    for (let i = 0; i < 6; i++) this.headline();
    for (let i = 0; i < 40; i++) this.step(true);
  }

  get(sym: string): Instrument {
    return this.list.find((i) => i.sym === sym)!;
  }
  on(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Advance the simulation by one tick (~400 ms of market time). */
  step(quiet = false): void {
    this.now += 400;
    for (const ins of this.list) {
      if (rnd() < 0.55) continue;
      const t = tick(ins.last);
      const move = Math.round((gauss() * 2.2 + ins.bias * 400) ) * t;
      ins.last = Math.max(t, round(ins.last + move, 3));
      ins.high = Math.max(ins.high, ins.last);
      ins.low = Math.min(ins.low, ins.last);
      const qty = Math.round(1 + rnd() * 40) * 100;
      ins.vol += qty;
      this.tape.unshift({ t: this.now, sym: ins.sym, px: ins.last, qty, side: move >= 0 ? "B" : "S" });
      const cs = this.candles.get(ins.sym)!;
      let c = cs[cs.length - 1]!;
      if (this.now - c.t >= 60000) {
        c = { t: c.t + 60000, o: c.c, h: c.c, l: c.c, c: c.c, v: 0 };
        cs.push(c);
        if (cs.length > 160) cs.shift();
      }
      c.c = ins.last;
      c.h = Math.max(c.h, ins.last);
      c.l = Math.min(c.l, ins.last);
      c.v += qty;
      if (!quiet && Math.abs(ins.last / ins.prev - 1) > 0.035 && rnd() < 0.02) {
        this.alert(ins.sym, `${ins.sym} ${ins.last > ins.prev ? "up" : "down"} ${(Math.abs(ins.last / ins.prev - 1) * 100).toFixed(1)}% on day`, "hot");
      }
    }
    if (this.tape.length > 200) this.tape.length = 200;
    for (const r of this.rates) {
      r.prev = r.px;
      r.px = round(r.px * (1 + gauss() * 0.0003), r.dp);
    }
    for (const o of this.orders) {
      if (o.status !== "WORKING") continue;
      const ins = this.get(o.sym);
      const crosses = o.type === "MKT" || (o.side === "BUY" ? ins.last <= o.px : ins.last >= o.px);
      if (crosses && rnd() < 0.5) {
        const part = Math.min(o.qty - o.filled, Math.max(100, Math.round((o.qty * (0.3 + rnd() * 0.7)) / 100) * 100));
        this.fill(o, part, o.type === "MKT" ? ins.last : o.px);
      }
    }
    if (!quiet && rnd() < 0.012) this.headline();
    if (!quiet) for (const fn of this.listeners) fn();
  }

  private fill(o: Order, qty: number, px: number): void {
    o.filled += qty;
    if (o.filled >= o.qty) o.status = "FILLED";
    const signed = o.side === "BUY" ? qty : -qty;
    const p = this.positions.get(o.sym) ?? { sym: o.sym, qty: 0, avg: px, realised: 0 };
    if (p.qty === 0 || Math.sign(p.qty) === Math.sign(signed)) {
      p.avg = (p.avg * Math.abs(p.qty) + px * qty) / (Math.abs(p.qty) + qty);
      p.qty += signed;
    } else {
      const closing = Math.min(Math.abs(p.qty), qty);
      p.realised += closing * (px - p.avg) * Math.sign(p.qty);
      p.qty += signed;
      if (Math.sign(p.qty) === Math.sign(signed) && p.qty !== 0) p.avg = px;
    }
    this.positions.set(o.sym, p);
    this.tape.unshift({ t: this.now, sym: o.sym, px, qty, side: o.side === "BUY" ? "B" : "S" });
    this.alert(o.sym, `Filled ${o.side} ${qty.toLocaleString()} ${o.sym} @ ${px.toFixed(2)}`, "info");
  }

  place(sym: string, side: "BUY" | "SELL", qty: number, px: number, type: "LMT" | "MKT"): Order {
    const o: Order = { id: this.nextId++, t: this.now, sym, side, qty, px, type, status: "WORKING", filled: 0 };
    this.orders.unshift(o);
    const pos = this.positions.get(sym);
    const after = (pos?.qty ?? 0) + (side === "BUY" ? qty : -qty);
    if (Math.abs(after * px) > 400000) this.alert(sym, `Exposure on ${sym} would exceed 400k limit`, "warn");
    return o;
  }
  cancel(id: number): void {
    const o = this.orders.find((x) => x.id === id);
    if (o && o.status === "WORKING") o.status = "CANCELLED";
  }

  private alert(sym: string, text: string, level: Alert["level"]): void {
    this.alerts.unshift({ id: this.nextId++, t: this.now, sym, text, level });
    if (this.alerts.length > 60) this.alerts.length = 60;
  }
  private headline(): void {
    if (rnd() < 0.3) {
      this.news.unshift({ t: this.now, text: MACRO[Math.floor(rnd() * MACRO.length)]!, tone: gauss() });
    } else {
      const ins = this.list[Math.floor(rnd() * this.list.length)]!;
      const h = HEADLINES[Math.floor(rnd() * HEADLINES.length)]!;
      const tone = gauss();
      this.news.unshift({ t: this.now, sym: ins.sym, text: h.replace("{n}", ins.name).replace("{s}", ins.sym), tone });
      ins.bias += tone * 0.0003;
    }
    if (this.news.length > 40) this.news.length = 40;
  }

  /** Synthetic depth around the last price. */
  book(sym: string, levels = 14): { bids: Array<[number, number]>; asks: Array<[number, number]> } {
    const ins = this.get(sym);
    const t = tick(ins.last);
    const bids: Array<[number, number]> = [];
    const asks: Array<[number, number]> = [];
    for (let i = 0; i < levels; i++) {
      bids.push([round(ins.last - t * (i + 1), 3), Math.round((2 + rnd() * 30 + i * 3) * 100)]);
      asks.push([round(ins.last + t * (i + 1), 3), Math.round((2 + rnd() * 30 + i * 3) * 100)]);
    }
    return { bids, asks };
  }
}
