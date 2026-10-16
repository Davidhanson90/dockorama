// Light-DOM styles for the trading desk views (the dock's own look comes from its skinPatch).
export const deskCss = `
.td-view { width: 100%; }
dockorama-manager.td { height: 100%; font-variant-numeric: tabular-nums; }
.td-view { color: #d8dee9; font: 12px/1.35 "Inter", system-ui, sans-serif; overflow: auto; background: #0d1118; display: flex; flex-direction: column; min-height: 0; }
.td-view .up { color: #2ecc71; } .td-view .down { color: #ff5b5b; } .td-view .dim { color: #6b7685; }
.td-view table { margin: 0; font-size: 12px; } .td-view th, .td-view td { vertical-align: middle; border-bottom: 1px solid #151c27; }
.td-grid { width: 100%; border-collapse: collapse; }
.td-view .td-grid th { position: sticky; top: 0; background: #121823; color: #7b8696; font-weight: 500; text-align: left; padding: 4px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; z-index: 1; }
.td-view .td-grid td { padding: 3px 6px; border-bottom: 1px solid #151c27; white-space: nowrap; }
.td-grid .num, .td-book .num { text-align: right; font-family: ui-monospace, "JetBrains Mono", monospace; }
.td-grid tbody tr:hover { background: #151d2a; cursor: pointer; }
.td-grid tr.sel { background: #1b2433; box-shadow: inset 2px 0 #f5b041; }
.td-v-watch small { display: block; color: #5b6676; font-size: 10px; }
.flash-up { animation: td-up .6s; } .flash-down { animation: td-down .6s; }
@keyframes td-up { from { background: rgb(46 204 113 / .45); } } @keyframes td-down { from { background: rgb(255 91 91 / .45); } }
.td-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px; padding: 8px; }
.td-tile { background: #121823; border: 1px solid #1e2633; border-radius: 4px; padding: 6px 8px; display: grid; }
.td-tile span { color: #7b8696; font-size: 11px; } .td-tile b { font: 600 16px ui-monospace, monospace; }
.td-heat { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(62px, 1fr)); grid-auto-rows: minmax(44px, 1fr); gap: 2px; padding: 3px; }
.td-heat > div { display: grid; place-content: center; text-align: center; border-radius: 3px; cursor: pointer; transition: background .4s; }
.td-heat b { font-size: 13px; } .td-heat span { font: 11px ui-monospace, monospace; } .td-heat small { font-size: 9px; color: #c7cfdb99; }
.td-v-chart, .td-v-depth { padding: 0; }
.td-chart-head { display: flex; gap: 12px; align-items: baseline; padding: 6px 10px; border-bottom: 1px solid #151c27; flex-wrap: wrap; }
.td-chart-head .td-chart-sym { font-size: 14px; color: #f5b041; }
.td-legend { margin-left: auto; color: #7b8696; } .td-legend i { display: inline-block; width: 10px; height: 2px; margin: 0 4px 3px 8px; }
.td-canvas { flex: 1; min-height: 0; position: relative; overflow: hidden; } .td-canvas canvas { position: absolute; inset: 0; }
.td-book-head { padding: 6px 10px; display: flex; justify-content: space-between; color: #7b8696; } .td-book-head b { color: #f5b041; }
.td-book { width: 100%; border-collapse: collapse; font-size: 12px; }
.td-view .td-book td { padding: 1px 8px; border: 0; } .td-book .px { width: 70px; }
.td-book .ask .px { color: #ff5b5b; } .td-book .bid .px { color: #2ecc71; }
.td-book .bar { width: 45%; } .td-book .bar i { display: block; height: 12px; border-radius: 2px; }
.td-book .ask .bar i { background: rgb(255 91 91 / .28); } .td-book .bid .bar i { background: rgb(46 204 113 / .28); }
.td-book .mid td { text-align: center; font: 600 15px ui-monospace, monospace; padding: 5px; border-block: 1px solid #1e2633; }
.td-view .td-tape td { padding: 1px 6px; font-family: ui-monospace, monospace; font-size: 11px; }
.td-pill { padding: 1px 6px; border-radius: 9px; font-size: 10px; background: #1e2633; }
.td-pill.working { background: rgb(245 176 65 / .2); color: #f5b041; } .td-pill.filled { background: rgb(46 204 113 / .18); color: #2ecc71; } .td-pill.cancelled { color: #6b7685; }
.td-prog { display: inline-block; width: 36px; height: 4px; background: #1e2633; border-radius: 2px; margin-right: 6px; vertical-align: middle; overflow: hidden; } .td-prog i { display: block; height: 100%; background: #f5b041; }
.td-x { background: none; border: 1px solid #2a3444; color: #ff5b5b; border-radius: 3px; cursor: pointer; font-size: 10px; }
.td-empty { color: #6b7685; padding: 16px; margin: 0; }
.td-kpis { display: flex; gap: 8px; padding: 8px; } .td-kpis div { flex: 1; background: #121823; border-radius: 4px; padding: 6px 10px; display: grid; }
.td-kpis span { color: #7b8696; font-size: 11px; } .td-kpis b { font: 600 18px ui-monospace, monospace; }
.td-list, .td-news, .td-alerts { list-style: none; margin: 0; padding: 0; }
.td-list li, .td-news li, .td-alerts li { padding: 5px 10px; border-bottom: 1px solid #151c27; display: flex; gap: 8px; align-items: baseline; }
.td-news b { color: #f5b041; cursor: pointer; font-size: 11px; } .td-news b.macro { color: #5dade2; } .td-news span:nth-of-type(2) { flex: 1; } .td-news i { font-style: normal; }
.td-alerts li.hot { box-shadow: inset 3px 0 #ff5b5b; } .td-alerts li.warn { box-shadow: inset 3px 0 #f5b041; } .td-alerts li.info { box-shadow: inset 3px 0 #2ecc71; }
.td-gauges { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 8px; }
.td-gauges figure { margin: 0; text-align: center; } .td-gauges b { display: block; font: 600 13px ui-monospace, monospace; margin-top: -8px; } .td-gauges figcaption { color: #7b8696; font-size: 11px; }
.td-v-risk h4 { margin: 8px 10px 4px; color: #7b8696; font-weight: 500; font-size: 11px; text-transform: uppercase; }
.td-bars > div { display: grid; grid-template-columns: 70px 1fr 60px; gap: 6px; align-items: center; padding: 3px 10px; }
.td-bars i { height: 8px; border-radius: 2px; } .td-bars i.long { background: #2ecc71; } .td-bars i.short { background: #ff5b5b; } .td-bars b { text-align: right; font: 11px ui-monospace, monospace; }
.td-ticket { display: grid; gap: 8px; padding: 10px; }
.td-ticket-sym { display: flex; gap: 8px; align-items: baseline; } .td-ticket-sym b { font-size: 16px; color: #f5b041; } .td-ticket-sym span { color: #7b8696; }
.td-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.td-seg button { padding: 6px; border: 1px solid #2a3444; background: #121823; color: #9aa4b2; border-radius: 4px; cursor: pointer; font-weight: 600; }
.td-seg button.on[data-side=BUY] { background: #1f8f50; color: #fff; border-color: #2ecc71; } .td-seg button.on[data-side=SELL] { background: #b03a3a; color: #fff; border-color: #ff5b5b; }
.td-ticket label { display: grid; grid-template-columns: 50px 1fr; align-items: center; color: #7b8696; }
.td-ticket input, .td-ticket select { background: #0a0e14; border: 1px solid #2a3444; color: #d8dee9; padding: 5px 6px; border-radius: 4px; font: 12px ui-monospace, monospace; }
.td-ticket-est { color: #7b8696; } .td-ticket-est b { color: #d8dee9; }
.td-send { padding: 8px; border: 0; border-radius: 4px; background: #2ecc71; color: #06150c; font-weight: 700; cursor: pointer; }
.td-ticket.sell .td-send { background: #ff5b5b; color: #1a0606; }
.td-clock { display: flex; gap: 10px; padding: 8px; align-items: center; } .td-clock svg { width: 96px; flex: 0 0 auto; }
.td-clock ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 11px; }
.td-clock li { white-space: nowrap; display: grid; grid-template-columns: 10px 56px 40px 1fr; gap: 4px; align-items: center; } .td-clock small { color: #6b7685; }
.td-clock .dot { width: 7px; height: 7px; border-radius: 50%; background: #ff5b5b; } .td-clock .dot.open { background: #2ecc71; box-shadow: 0 0 6px #2ecc71; }
`;
