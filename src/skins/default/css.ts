import { css } from "lit";

/** CSS of the built-in skin (also the base every other skin is layered on). */
export const styles = css`
  :host {
    --pz-accent: #5b5bd6;
    --pz-accent-ink: #ffffff;
    --pz-canvas: #eef0f4;
    --pz-surface: #ffffff;
    --pz-surface-2: #f6f7f9;
    --pz-ink: #1d2230;
    --pz-ink-soft: #626a7d;
    --pz-line: #dfe2e9;
    --pz-gutter: 6px;
    --pz-radius: 8px;
    --pz-bar-height: 34px;
    --pz-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --pz-font-size: 13px;
    --pz-shadow: 0 10px 30px rgb(15 20 40 / 0.18), 0 2px 6px rgb(15 20 40 / 0.08);
    --pz-target: rgb(91 91 214 / 0.18);
    --pz-text-padding: 12px 14px;
    display: block;
    position: relative;
    box-sizing: border-box;
    min-height: 200px;
    height: 100%;
    font: var(--pz-font-size) / 1.4 var(--pz-font);
    color: var(--pz-ink);
    background: var(--pz-canvas);
    overflow: hidden;
    contain: layout paint;
  }
  :host([theme="dark"]) {
    --pz-accent: #8b8bff;
    --pz-accent-ink: #11131a;
    --pz-canvas: #0e1016;
    --pz-surface: #171a23;
    --pz-surface-2: #1e2230;
    --pz-ink: #e8eaf2;
    --pz-ink-soft: #9aa1b5;
    --pz-line: #2b3040;
    --pz-target: rgb(139 139 255 / 0.22);
    color-scheme: dark;
  }
  @media (prefers-color-scheme: dark) {
    :host([theme="auto"]) {
      --pz-accent: #8b8bff;
      --pz-accent-ink: #11131a;
      --pz-canvas: #0e1016;
      --pz-surface: #171a23;
      --pz-surface-2: #1e2230;
      --pz-ink: #e8eaf2;
      --pz-ink-soft: #9aa1b5;
      --pz-line: #2b3040;
      color-scheme: dark;
    }
  }
  *, *::before, *::after { box-sizing: border-box; }
  /* UI parts render in this shadow root; class rules below give each its layout. */
  pazuru-split, pazuru-gutter, pazuru-stack, pazuru-docs, pazuru-view, pazuru-window, pazuru-drop-guide,
  pazuru-rail, pazuru-flyout, pazuru-menu, pazuru-palette, pazuru-tab, pazuru-tab-menu, pazuru-confirm { display: block; }
  pazuru-tabstrip, pazuru-toolbar { display: contents; }
  .frame { position: absolute; inset: 0; display: flex; flex-direction: column; }
  .middle { flex: 1 1 auto; display: flex; min-height: 0; position: relative; }
  .main { flex: 1 1 auto; position: relative; min-width: 0; min-height: 0; padding: 4px; display: flex; }
  .main > .cell, .main > .stack, .main > .split { flex: 1 1 auto; }
  .split { display: flex; flex: 1 1 auto; min-width: 0; min-height: 0; }
  .split[data-axis="column"] { flex-direction: column; }
  .cell { display: flex; min-width: 0; min-height: 0; overflow: hidden; }
  .gutter { flex: 0 0 var(--pz-gutter); position: relative; touch-action: none; outline: none; }
  .split[data-axis="row"] > .gutter { cursor: col-resize; }
  .split[data-axis="column"] > .gutter { cursor: row-resize; }
  .gutter::after {
    content: ""; position: absolute; border-radius: 2px; background: transparent; transition: background 120ms;
  }
  .split[data-axis="row"] > .gutter::after { inset: 30% 2px; }
  .split[data-axis="column"] > .gutter::after { inset: 2px 30%; }
  .gutter:hover::after, .gutter:focus-visible::after, .gutter[data-live]::after { background: var(--pz-accent); }
  .stack {
    flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0;
    background: var(--pz-surface); border: 1px solid var(--pz-line); border-radius: var(--pz-radius); overflow: hidden;
  }
  .stack:focus { outline: none; }
  .stack[data-active] { border-color: color-mix(in srgb, var(--pz-accent) 55%, var(--pz-line)); }
  .bar {
    flex: 0 0 var(--pz-bar-height); display: flex; align-items: center; gap: 2px; padding: 0 4px 0 10px;
    background: var(--pz-surface-2); border-bottom: 1px solid var(--pz-line); user-select: none; touch-action: none; min-width: 0;
  }
  .stack[data-active] > .bar .title { color: var(--pz-accent); }
  .title { flex: 1 1 auto; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: grab; }
  .glyph { margin-inline-end: 6px; }
  .tabs { display: flex; flex: 1 1 auto; min-width: 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; scroll-behavior: smooth; align-self: stretch; padding-top: 4px; gap: 2px; }
  .stack[data-tabs] > .bar { padding-inline-start: 4px; }
  .tab {
    display: inline-flex; align-items: center; gap: 4px; padding: 0 6px 0 10px; max-width: 200px; flex: 0 0 auto;
    border-radius: 6px 6px 0 0; color: var(--pz-ink-soft); cursor: pointer; touch-action: none; white-space: nowrap; outline: none;
    border: 1px solid transparent; border-bottom: none;
  }
  .tabs::-webkit-scrollbar { display: none; }
  .tab { flex: 0 0 auto; }
  pazuru-tabstrip > .scroll { display: none; flex: 0 0 auto; width: 20px; }
  pazuru-tabstrip[data-overflow] > .scroll { display: inline-grid; }
  pazuru-tabstrip[data-overflow]:not([data-can-back]) > .scroll[data-dir="-1"],
  pazuru-tabstrip[data-overflow]:not([data-can-fwd]) > .scroll[data-dir="1"] { opacity: 0.3; pointer-events: none; }
  .gutter[data-drop]::after { background: var(--pz-accent); inset: 0; }
  .tab > .label { overflow: hidden; text-overflow: ellipsis; }
  .tab:hover { color: var(--pz-ink); background: color-mix(in srgb, var(--pz-surface) 60%, transparent); }
  .tab[aria-selected="true"] { color: var(--pz-ink); background: var(--pz-surface); border-color: var(--pz-line); margin-bottom: -1px; }
  .stack[data-active] .tab[aria-selected="true"] { box-shadow: inset 0 2px 0 var(--pz-accent); }
  .tab:focus-visible, .btn:focus-visible, .rail-item:focus-visible { outline: 2px solid var(--pz-accent); outline-offset: -2px; }
  .tab .btn { width: 20px; height: 20px; opacity: 0.55; }
  .tab:hover .btn, .tab[aria-selected="true"] .btn { opacity: 1; }
  .btn {
    display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 6px;
    background: transparent; color: var(--pz-ink-soft); cursor: pointer; flex: 0 0 auto;
  }
  .btn:hover { background: var(--pz-line); color: var(--pz-ink); }
  .body { position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; }
  .body > slot { display: contents; }
  .body ::slotted(*) { flex: 1 1 auto; min-width: 0; }
  .body ::slotted(.pazuru-text) {
    box-sizing: border-box; padding: var(--pz-text-padding); line-height: 1.5;
    overflow: auto; user-select: text; white-space: pre-wrap; min-height: 0;
  }
  .body[data-inert] { pointer-events: none; opacity: 0.55; }
  .empty, .away { margin: auto; color: var(--pz-ink-soft); padding: 16px; text-align: center; }
  .rail { display: flex; gap: 4px; padding: 4px; background: var(--pz-canvas); }
  .rail[data-side="start"], .rail[data-side="end"] { flex-direction: column; padding-top: 8px; }
  .rail-item {
    border: 1px solid var(--pz-line); background: var(--pz-surface); color: var(--pz-ink-soft); border-radius: 6px; cursor: pointer;
    padding: 6px 8px; font: inherit; white-space: nowrap;
  }
  .rail[data-side="start"] .rail-item, .rail[data-side="end"] .rail-item { writing-mode: vertical-rl; padding: 8px 4px; }
  .rail[data-side="start"] .rail-item { transform: rotate(180deg); }
  .rail-item[aria-expanded="true"] { color: var(--pz-accent); border-color: var(--pz-accent); }
  .drawer {
    position: absolute; z-index: 20; display: flex; box-shadow: var(--pz-shadow); border-radius: var(--pz-radius);
    animation: pz-slide 140ms ease-out;
  }
  .drawer[data-side="start"] { inset-block: 4px; inset-inline-start: 4px; width: min(360px, 40%); }
  .drawer[data-side="end"] { inset-block: 4px; inset-inline-end: 4px; width: min(360px, 40%); }
  .drawer[data-side="top"] { inset-inline: 4px; top: 4px; height: min(280px, 45%); }
  .drawer[data-side="bottom"] { inset-inline: 4px; bottom: 4px; height: min(280px, 45%); }
  @keyframes pz-slide { from { opacity: 0; transform: scale(0.98); } }
  .window {
    position: absolute; z-index: 30; display: flex; flex-direction: column; min-width: 160px; min-height: 90px;
    border-radius: var(--pz-radius); box-shadow: var(--pz-shadow); background: var(--pz-surface);
  }
  .window > .content { flex: 1 1 auto; display: flex; min-height: 0; }
  .window .stack { border-radius: var(--pz-radius); }
  .grip { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; touch-action: none; }
  .grip::after { content: ""; position: absolute; right: 3px; bottom: 3px; width: 6px; height: 6px; border-right: 2px solid var(--pz-ink-soft); border-bottom: 2px solid var(--pz-ink-soft); }
  .overlay { position: absolute; inset: 0; z-index: 50; pointer-events: none; }
  .preview { position: absolute; background: var(--pz-target); border: 2px solid var(--pz-accent); border-radius: var(--pz-radius); transition: all 90ms ease-out; }
  .ghost {
    position: absolute; padding: 6px 12px; border-radius: 6px; background: var(--pz-accent); color: var(--pz-accent-ink);
    font-weight: 600; box-shadow: var(--pz-shadow); white-space: nowrap; transform: translate(10px, 10px);
  }
  .target {
    position: absolute; width: 32px; height: 32px; margin: -16px 0 0 -16px; display: grid; place-items: center;
    border-radius: 8px; background: var(--pz-surface); color: var(--pz-ink-soft); border: 1px solid var(--pz-line); box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
  }
  .target[data-hot] { background: var(--pz-accent); color: var(--pz-accent-ink); border-color: var(--pz-accent); }
  .menu, .palette {
    position: absolute; z-index: 60; background: var(--pz-surface); color: var(--pz-ink); border: 1px solid var(--pz-line);
    border-radius: var(--pz-radius); box-shadow: var(--pz-shadow); padding: 4px; min-width: 180px;
  }
  .menu button, .palette li {
    display: flex; gap: 8px; align-items: center; width: 100%; border: 0; background: none; color: inherit; font: inherit;
    text-align: start; padding: 6px 10px; border-radius: 6px; cursor: pointer;
  }
  .menu button:hover, .menu button:focus-visible, .palette li[aria-selected="true"] { background: var(--pz-target); outline: none; }
  .menu hr { border: 0; border-top: 1px solid var(--pz-line); margin: 4px; }
  .palette { left: 50%; top: 12%; transform: translateX(-50%); width: min(460px, 90%); padding: 8px; }
  .palette input {
    width: 100%; font: inherit; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--pz-line);
    background: var(--pz-surface-2); color: inherit; outline-color: var(--pz-accent);
  }
  .palette ul { list-style: none; margin: 6px 0 0; padding: 0; max-height: 300px; overflow: auto; }
  .palette small { color: var(--pz-ink-soft); margin-inline-start: auto; }
  .menu button[disabled] { opacity: 0.45; cursor: default; background: none; }
  .menu button[aria-checked="true"]::after { content: "\\2713"; margin-inline-start: auto; color: var(--pz-accent); }
  .tab[data-pinned] { padding-inline: 8px; gap: 4px; }
  .tab .pin { display: inline-flex; color: var(--pz-ink-soft); }
  .tab .pin svg { width: 11px; height: 11px; }
  .tab[data-pinned] { position: sticky; z-index: 2; background: var(--pz-surface-2); }
  .tab[data-pinned][aria-selected="true"] { background: var(--pz-surface); }
  .tab[data-preview] > .label { font-style: italic; }
  .dirty { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--pz-ink-soft); flex: 0 0 auto; margin-inline-start: 6px; }
  .tab[data-dirty][data-closable] .dirty { margin-inline-start: 6px; }
  .tab[data-dirty] [part~="tab-close"] { display: none; }
  .tab[data-dirty]:hover [part~="tab-close"], .tab[data-dirty]:focus-within [part~="tab-close"] { display: inline-grid; }
  .tab[data-dirty]:hover .dirty, .tab[data-dirty]:focus-within .dirty { display: none; }
  .confirm { position: absolute; inset: 0; z-index: 80; display: grid; place-items: center; background: rgb(0 0 0 / 0.25); }
  .confirm-box {
    max-width: min(420px, 90%); padding: 16px 18px 12px; border-radius: var(--pz-radius); background: var(--pz-surface);
    color: var(--pz-ink); border: 1px solid var(--pz-line); box-shadow: var(--pz-shadow);
  }
  .confirm-box p { margin: 0 0 14px; }
  .confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .confirm-actions .btn { width: auto; height: 30px; padding: 0 14px; border: 1px solid var(--pz-line); }
  .confirm-actions .btn[data-primary] { background: var(--pz-accent); color: var(--pz-accent-ink); border-color: var(--pz-accent); }
  .menu-scroll { overflow: auto; position: relative; min-width: 220px; }
  .menu-rows { position: relative; }
  .menu-rows > button { left: 0; right: 0; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cell[data-folded] { overflow: hidden; }
  .cell[data-folded] > * { visibility: hidden; }
  .gutter[data-folded]::after { background: var(--pz-accent); opacity: 0.6; }
  .notice {
    position: absolute; z-index: 70; top: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center;
    max-width: min(640px, 94%); padding: 8px 10px 8px 14px; border-radius: var(--pz-radius); background: var(--pz-surface);
    color: var(--pz-ink); border: 1px solid var(--pz-accent); box-shadow: var(--pz-shadow);
  }
  .notice-btn { width: auto; padding: 0 10px; height: 28px; white-space: nowrap; border: 1px solid var(--pz-line); }
  .notice-btn[data-primary] { background: var(--pz-accent); color: var(--pz-accent-ink); border-color: var(--pz-accent); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  @media (prefers-reduced-motion: reduce) { .drawer, .preview { animation: none; transition: none; } }
`;
