import { css } from "lit";

/** CSS of the built-in skin (also the base every other skin is layered on). */
export const styles = css`
  :host {
    --dk-accent: #5b5bd6;
    --dk-accent-ink: #ffffff;
    --dk-canvas: #eef0f4;
    --dk-surface: #ffffff;
    --dk-surface-2: #f6f7f9;
    --dk-ink: #1d2230;
    --dk-ink-soft: #626a7d;
    --dk-line: #dfe2e9;
    --dk-gutter: 6px;
    --dk-radius: 8px;
    --dk-bar-height: 34px;
    --dk-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --dk-font-size: 13px;
    --dk-shadow: 0 10px 30px rgb(15 20 40 / 0.18), 0 2px 6px rgb(15 20 40 / 0.08);
    --dk-target: rgb(91 91 214 / 0.18);
    --dk-text-padding: 12px 14px;
    display: block;
    position: relative;
    box-sizing: border-box;
    min-height: 200px;
    height: 100%;
    font: var(--dk-font-size) / 1.4 var(--dk-font);
    color: var(--dk-ink);
    background: var(--dk-canvas);
    overflow: hidden;
    contain: layout paint;
  }
  :host([theme="dark"]) {
    --dk-accent: #8b8bff;
    --dk-accent-ink: #11131a;
    --dk-canvas: #0e1016;
    --dk-surface: #171a23;
    --dk-surface-2: #1e2230;
    --dk-ink: #e8eaf2;
    --dk-ink-soft: #9aa1b5;
    --dk-line: #2b3040;
    --dk-target: rgb(139 139 255 / 0.22);
    color-scheme: dark;
  }
  @media (prefers-color-scheme: dark) {
    :host([theme="auto"]) {
      --dk-accent: #8b8bff;
      --dk-accent-ink: #11131a;
      --dk-canvas: #0e1016;
      --dk-surface: #171a23;
      --dk-surface-2: #1e2230;
      --dk-ink: #e8eaf2;
      --dk-ink-soft: #9aa1b5;
      --dk-line: #2b3040;
      color-scheme: dark;
    }
  }
  *, *::before, *::after { box-sizing: border-box; }
  /* UI parts render in this shadow root; class rules below give each its layout. */
  dockorama-split, dockorama-gutter, dockorama-stack, dockorama-docs, dockorama-view, dockorama-window, dockorama-drop-guide,
  dockorama-rail, dockorama-flyout, dockorama-menu, dockorama-palette, dockorama-tab, dockorama-tab-menu, dockorama-confirm { display: block; }
  dockorama-tabstrip, dockorama-toolbar { display: contents; }
  .frame { position: absolute; inset: 0; display: flex; flex-direction: column; }
  .middle { flex: 1 1 auto; display: flex; min-height: 0; position: relative; }
  .main { flex: 1 1 auto; position: relative; min-width: 0; min-height: 0; padding: 4px; display: flex; }
  .main > .cell, .main > .stack, .main > .split { flex: 1 1 auto; }
  .split { display: flex; flex: 1 1 auto; min-width: 0; min-height: 0; }
  .split[data-axis="column"] { flex-direction: column; }
  .cell { display: flex; min-width: 0; min-height: 0; overflow: hidden; }
  .gutter { flex: 0 0 var(--dk-gutter); position: relative; touch-action: none; outline: none; }
  .split[data-axis="row"] > .gutter { cursor: col-resize; }
  .split[data-axis="column"] > .gutter { cursor: row-resize; }
  .gutter::after {
    content: ""; position: absolute; border-radius: 2px; background: transparent; transition: background 120ms;
  }
  .split[data-axis="row"] > .gutter::after { inset: 30% 2px; }
  .split[data-axis="column"] > .gutter::after { inset: 2px 30%; }
  .gutter:hover::after, .gutter:focus-visible::after, .gutter[data-live]::after { background: var(--dk-accent); }
  .stack {
    flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0;
    background: var(--dk-surface); border: 1px solid var(--dk-line); border-radius: var(--dk-radius); overflow: hidden;
  }
  .stack:focus { outline: none; }
  .stack[data-active] { border-color: color-mix(in srgb, var(--dk-accent) 55%, var(--dk-line)); }
  .bar {
    flex: 0 0 var(--dk-bar-height); display: flex; align-items: center; gap: 2px; padding: 0 4px 0 10px;
    background: var(--dk-surface-2); border-bottom: 1px solid var(--dk-line); user-select: none; touch-action: none; min-width: 0;
  }
  .stack[data-active] > .bar .title { color: var(--dk-accent); }
  .title { flex: 1 1 auto; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: grab; }
  .glyph { margin-inline-end: 6px; }
  .tabs { display: flex; flex: 1 1 auto; min-width: 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; scroll-behavior: smooth; align-self: stretch; padding-top: 4px; gap: 2px; }
  .stack[data-tabs] > .bar { padding-inline-start: 4px; }
  .tab {
    display: inline-flex; align-items: center; gap: 4px; padding: 0 6px 0 10px; max-width: 200px; flex: 0 0 auto;
    border-radius: 6px 6px 0 0; color: var(--dk-ink-soft); cursor: pointer; touch-action: none; white-space: nowrap; outline: none;
    border: 1px solid transparent; border-bottom: none;
  }
  .tabs::-webkit-scrollbar { display: none; }
  .tab { flex: 0 0 auto; }
  dockorama-tabstrip > .scroll { display: none; flex: 0 0 auto; width: 20px; }
  dockorama-tabstrip[data-overflow] > .scroll { display: inline-grid; }
  dockorama-tabstrip[data-overflow]:not([data-can-back]) > .scroll[data-dir="-1"],
  dockorama-tabstrip[data-overflow]:not([data-can-fwd]) > .scroll[data-dir="1"] { opacity: 0.3; pointer-events: none; }
  .gutter[data-drop]::after { background: var(--dk-accent); inset: 0; }
  .tab > .label { overflow: hidden; text-overflow: ellipsis; }
  .tab:hover { color: var(--dk-ink); background: color-mix(in srgb, var(--dk-surface) 60%, transparent); }
  .tab[aria-selected="true"] { color: var(--dk-ink); background: var(--dk-surface); border-color: var(--dk-line); margin-bottom: -1px; }
  .stack[data-active] .tab[aria-selected="true"] { box-shadow: inset 0 2px 0 var(--dk-accent); }
  .tab:focus-visible, .btn:focus-visible, .rail-item:focus-visible { outline: 2px solid var(--dk-accent); outline-offset: -2px; }
  .tab .btn { width: 20px; height: 20px; opacity: 0.55; }
  .tab:hover .btn, .tab[aria-selected="true"] .btn { opacity: 1; }
  .btn {
    display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 6px;
    background: transparent; color: var(--dk-ink-soft); cursor: pointer; flex: 0 0 auto;
  }
  .btn:hover { background: var(--dk-line); color: var(--dk-ink); }
  .body { position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; }
  .body > slot { display: contents; }
  .body ::slotted(*) { flex: 1 1 auto; min-width: 0; }
  .body ::slotted(.dockorama-text) {
    box-sizing: border-box; padding: var(--dk-text-padding); line-height: 1.5;
    overflow: auto; user-select: text; white-space: pre-wrap; min-height: 0;
  }
  .body[data-inert] { pointer-events: none; opacity: 0.55; }
  .empty, .away { margin: auto; color: var(--dk-ink-soft); padding: 16px; text-align: center; }
  .rail { display: flex; gap: 4px; padding: 4px; background: var(--dk-canvas); }
  .rail[data-side="start"], .rail[data-side="end"] { flex-direction: column; padding-top: 8px; }
  .rail-item {
    border: 1px solid var(--dk-line); background: var(--dk-surface); color: var(--dk-ink-soft); border-radius: 6px; cursor: pointer;
    padding: 6px 8px; font: inherit; white-space: nowrap;
  }
  .rail[data-side="start"] .rail-item, .rail[data-side="end"] .rail-item { writing-mode: vertical-rl; padding: 8px 4px; }
  .rail[data-side="start"] .rail-item { transform: rotate(180deg); }
  .rail-item[aria-expanded="true"] { color: var(--dk-accent); border-color: var(--dk-accent); }
  .drawer {
    position: absolute; z-index: 20; display: flex; box-shadow: var(--dk-shadow); border-radius: var(--dk-radius);
    animation: dk-slide 140ms ease-out;
  }
  .drawer[data-side="start"] { inset-block: 4px; inset-inline-start: 4px; width: min(360px, 40%); }
  .drawer[data-side="end"] { inset-block: 4px; inset-inline-end: 4px; width: min(360px, 40%); }
  .drawer[data-side="top"] { inset-inline: 4px; top: 4px; height: min(280px, 45%); }
  .drawer[data-side="bottom"] { inset-inline: 4px; bottom: 4px; height: min(280px, 45%); }
  @keyframes dk-slide { from { opacity: 0; transform: scale(0.98); } }
  .window {
    position: absolute; z-index: 30; display: flex; flex-direction: column; min-width: 160px; min-height: 90px;
    border-radius: var(--dk-radius); box-shadow: var(--dk-shadow); background: var(--dk-surface);
  }
  .window > .content { flex: 1 1 auto; display: flex; min-height: 0; }
  .window .stack { border-radius: var(--dk-radius); }
  .grip { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; touch-action: none; }
  .grip::after { content: ""; position: absolute; right: 3px; bottom: 3px; width: 6px; height: 6px; border-right: 2px solid var(--dk-ink-soft); border-bottom: 2px solid var(--dk-ink-soft); }
  .overlay { position: absolute; inset: 0; z-index: 50; pointer-events: none; }
  .preview { position: absolute; background: var(--dk-target); border: 2px solid var(--dk-accent); border-radius: var(--dk-radius); transition: all 90ms ease-out; }
  .ghost {
    position: absolute; padding: 6px 12px; border-radius: 6px; background: var(--dk-accent); color: var(--dk-accent-ink);
    font-weight: 600; box-shadow: var(--dk-shadow); white-space: nowrap; transform: translate(10px, 10px);
  }
  .target {
    position: absolute; width: 32px; height: 32px; margin: -16px 0 0 -16px; display: grid; place-items: center;
    border-radius: 8px; background: var(--dk-surface); color: var(--dk-ink-soft); border: 1px solid var(--dk-line); box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
  }
  .target[data-hot] { background: var(--dk-accent); color: var(--dk-accent-ink); border-color: var(--dk-accent); }
  .menu, .palette {
    position: absolute; z-index: 60; background: var(--dk-surface); color: var(--dk-ink); border: 1px solid var(--dk-line);
    border-radius: var(--dk-radius); box-shadow: var(--dk-shadow); padding: 4px; min-width: 180px;
  }
  .menu button, .palette li {
    display: flex; gap: 8px; align-items: center; width: 100%; border: 0; background: none; color: inherit; font: inherit;
    text-align: start; padding: 6px 10px; border-radius: 6px; cursor: pointer;
  }
  .menu button:hover, .menu button:focus-visible, .palette li[aria-selected="true"] { background: var(--dk-target); outline: none; }
  .menu hr { border: 0; border-top: 1px solid var(--dk-line); margin: 4px; }
  .palette { left: 50%; top: 12%; transform: translateX(-50%); width: min(460px, 90%); padding: 8px; }
  .palette input {
    width: 100%; font: inherit; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--dk-line);
    background: var(--dk-surface-2); color: inherit; outline-color: var(--dk-accent);
  }
  .palette ul { list-style: none; margin: 6px 0 0; padding: 0; max-height: 300px; overflow: auto; }
  .palette small { color: var(--dk-ink-soft); margin-inline-start: auto; }
  .menu button[disabled] { opacity: 0.45; cursor: default; background: none; }
  .menu button[aria-checked="true"]::after { content: "\\2713"; margin-inline-start: auto; color: var(--dk-accent); }
  .tab[data-pinned] { padding-inline: 8px; gap: 4px; }
  .tab .pin { display: inline-flex; color: var(--dk-ink-soft); }
  .tab .pin svg { width: 11px; height: 11px; }
  .tab[data-pinned] { position: sticky; z-index: 2; background: var(--dk-surface-2); }
  .tab[data-pinned][aria-selected="true"] { background: var(--dk-surface); }
  .tab[data-preview] > .label { font-style: italic; }
  .dirty { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--dk-ink-soft); flex: 0 0 auto; margin-inline-start: 6px; }
  .tab[data-dirty][data-closable] .dirty { margin-inline-start: 6px; }
  .tab[data-dirty] [part~="tab-close"] { display: none; }
  .tab[data-dirty]:hover [part~="tab-close"], .tab[data-dirty]:focus-within [part~="tab-close"] { display: inline-grid; }
  .tab[data-dirty]:hover .dirty, .tab[data-dirty]:focus-within .dirty { display: none; }
  .confirm { position: absolute; inset: 0; z-index: 80; display: grid; place-items: center; background: rgb(0 0 0 / 0.25); }
  .confirm-box {
    max-width: min(420px, 90%); padding: 16px 18px 12px; border-radius: var(--dk-radius); background: var(--dk-surface);
    color: var(--dk-ink); border: 1px solid var(--dk-line); box-shadow: var(--dk-shadow);
  }
  .confirm-box p { margin: 0 0 14px; }
  .confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .confirm-actions .btn { width: auto; height: 30px; padding: 0 14px; border: 1px solid var(--dk-line); }
  .confirm-actions .btn[data-primary] { background: var(--dk-accent); color: var(--dk-accent-ink); border-color: var(--dk-accent); }
  .menu-scroll { overflow: auto; position: relative; min-width: 220px; }
  .menu-rows { position: relative; }
  .menu-rows > button { left: 0; right: 0; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cell[data-folded] { overflow: hidden; }
  .cell[data-folded] > * { visibility: hidden; }
  .gutter[data-folded]::after { background: var(--dk-accent); opacity: 0.6; }
  .notice {
    position: absolute; z-index: 70; top: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center;
    max-width: min(640px, 94%); padding: 8px 10px 8px 14px; border-radius: var(--dk-radius); background: var(--dk-surface);
    color: var(--dk-ink); border: 1px solid var(--dk-accent); box-shadow: var(--dk-shadow);
  }
  .notice-btn { width: auto; padding: 0 10px; height: 28px; white-space: nowrap; border: 1px solid var(--dk-line); }
  .notice-btn[data-primary] { background: var(--dk-accent); color: var(--dk-accent-ink); border-color: var(--dk-accent); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  @media (prefers-reduced-motion: reduce) { .drawer, .preview { animation: none; transition: none; } }
`;
