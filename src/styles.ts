import { css } from "lit";

export const styles = css`
  :host {
    --fd-accent: #5b5bd6;
    --fd-accent-ink: #ffffff;
    --fd-canvas: #eef0f4;
    --fd-surface: #ffffff;
    --fd-surface-2: #f6f7f9;
    --fd-ink: #1d2230;
    --fd-ink-soft: #626a7d;
    --fd-line: #dfe2e9;
    --fd-gutter: 6px;
    --fd-radius: 8px;
    --fd-bar-height: 34px;
    --fd-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --fd-font-size: 13px;
    --fd-shadow: 0 10px 30px rgb(15 20 40 / 0.18), 0 2px 6px rgb(15 20 40 / 0.08);
    --fd-target: rgb(91 91 214 / 0.18);
    --fd-text-padding: 12px 14px;
    display: block;
    position: relative;
    box-sizing: border-box;
    min-height: 200px;
    height: 100%;
    font: var(--fd-font-size) / 1.4 var(--fd-font);
    color: var(--fd-ink);
    background: var(--fd-canvas);
    overflow: hidden;
    contain: layout paint;
  }
  :host([theme="dark"]) {
    --fd-accent: #8b8bff;
    --fd-accent-ink: #11131a;
    --fd-canvas: #0e1016;
    --fd-surface: #171a23;
    --fd-surface-2: #1e2230;
    --fd-ink: #e8eaf2;
    --fd-ink-soft: #9aa1b5;
    --fd-line: #2b3040;
    --fd-target: rgb(139 139 255 / 0.22);
    color-scheme: dark;
  }
  @media (prefers-color-scheme: dark) {
    :host([theme="auto"]) {
      --fd-accent: #8b8bff;
      --fd-accent-ink: #11131a;
      --fd-canvas: #0e1016;
      --fd-surface: #171a23;
      --fd-surface-2: #1e2230;
      --fd-ink: #e8eaf2;
      --fd-ink-soft: #9aa1b5;
      --fd-line: #2b3040;
      color-scheme: dark;
    }
  }
  *, *::before, *::after { box-sizing: border-box; }
  /* UI parts render in this shadow root; class rules below give each its layout. */
  flexdock-split, flexdock-gutter, flexdock-stack, flexdock-docs, flexdock-view, flexdock-window, flexdock-drop-guide,
  flexdock-rail, flexdock-flyout, flexdock-menu, flexdock-palette, flexdock-tab, flexdock-tab-menu { display: block; }
  flexdock-tabstrip, flexdock-toolbar { display: contents; }
  .frame { position: absolute; inset: 0; display: flex; flex-direction: column; }
  .middle { flex: 1 1 auto; display: flex; min-height: 0; position: relative; }
  .main { flex: 1 1 auto; position: relative; min-width: 0; min-height: 0; padding: 4px; display: flex; }
  .main > .cell, .main > .stack, .main > .split { flex: 1 1 auto; }
  .split { display: flex; flex: 1 1 auto; min-width: 0; min-height: 0; }
  .split[data-axis="column"] { flex-direction: column; }
  .cell { display: flex; min-width: 0; min-height: 0; overflow: hidden; }
  .gutter { flex: 0 0 var(--fd-gutter); position: relative; touch-action: none; outline: none; }
  .split[data-axis="row"] > .gutter { cursor: col-resize; }
  .split[data-axis="column"] > .gutter { cursor: row-resize; }
  .gutter::after {
    content: ""; position: absolute; border-radius: 2px; background: transparent; transition: background 120ms;
  }
  .split[data-axis="row"] > .gutter::after { inset: 30% 2px; }
  .split[data-axis="column"] > .gutter::after { inset: 2px 30%; }
  .gutter:hover::after, .gutter:focus-visible::after, .gutter[data-live]::after { background: var(--fd-accent); }
  .stack {
    flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0;
    background: var(--fd-surface); border: 1px solid var(--fd-line); border-radius: var(--fd-radius); overflow: hidden;
  }
  .stack:focus { outline: none; }
  .stack[data-active] { border-color: color-mix(in srgb, var(--fd-accent) 55%, var(--fd-line)); }
  .bar {
    flex: 0 0 var(--fd-bar-height); display: flex; align-items: center; gap: 2px; padding: 0 4px 0 10px;
    background: var(--fd-surface-2); border-bottom: 1px solid var(--fd-line); user-select: none; touch-action: none; min-width: 0;
  }
  .stack[data-active] > .bar .title { color: var(--fd-accent); }
  .title { flex: 1 1 auto; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: grab; }
  .glyph { margin-inline-end: 6px; }
  .tabs { display: flex; flex: 1 1 auto; min-width: 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; scroll-behavior: smooth; align-self: stretch; padding-top: 4px; gap: 2px; }
  .stack[data-tabs] > .bar { padding-inline-start: 4px; }
  .tab {
    display: inline-flex; align-items: center; gap: 4px; padding: 0 6px 0 10px; max-width: 200px; flex: 0 0 auto;
    border-radius: 6px 6px 0 0; color: var(--fd-ink-soft); cursor: pointer; touch-action: none; white-space: nowrap; outline: none;
    border: 1px solid transparent; border-bottom: none;
  }
  .tabs::-webkit-scrollbar { display: none; }
  .tab { flex: 0 0 auto; }
  flexdock-tabstrip > .scroll { display: none; flex: 0 0 auto; width: 20px; }
  flexdock-tabstrip[data-overflow] > .scroll { display: inline-grid; }
  flexdock-tabstrip[data-overflow]:not([data-can-back]) > .scroll[data-dir="-1"],
  flexdock-tabstrip[data-overflow]:not([data-can-fwd]) > .scroll[data-dir="1"] { opacity: 0.3; pointer-events: none; }
  .gutter[data-drop]::after { background: var(--fd-accent); inset: 0; }
  .tab > .label { overflow: hidden; text-overflow: ellipsis; }
  .tab:hover { color: var(--fd-ink); background: color-mix(in srgb, var(--fd-surface) 60%, transparent); }
  .tab[aria-selected="true"] { color: var(--fd-ink); background: var(--fd-surface); border-color: var(--fd-line); margin-bottom: -1px; }
  .stack[data-active] .tab[aria-selected="true"] { box-shadow: inset 0 2px 0 var(--fd-accent); }
  .tab:focus-visible, .btn:focus-visible, .rail-item:focus-visible { outline: 2px solid var(--fd-accent); outline-offset: -2px; }
  .tab .btn { width: 20px; height: 20px; opacity: 0.55; }
  .tab:hover .btn, .tab[aria-selected="true"] .btn { opacity: 1; }
  .btn {
    display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 6px;
    background: transparent; color: var(--fd-ink-soft); cursor: pointer; flex: 0 0 auto;
  }
  .btn:hover { background: var(--fd-line); color: var(--fd-ink); }
  .body { position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; }
  .body > slot { display: contents; }
  .body ::slotted(*) { flex: 1 1 auto; min-width: 0; }
  .body ::slotted(.flexdock-text) {
    box-sizing: border-box; padding: var(--fd-text-padding); line-height: 1.5;
    overflow: auto; user-select: text; white-space: pre-wrap; min-height: 0;
  }
  .body[data-inert] { pointer-events: none; opacity: 0.55; }
  .empty, .away { margin: auto; color: var(--fd-ink-soft); padding: 16px; text-align: center; }
  .rail { display: flex; gap: 4px; padding: 4px; background: var(--fd-canvas); }
  .rail[data-side="start"], .rail[data-side="end"] { flex-direction: column; padding-top: 8px; }
  .rail-item {
    border: 1px solid var(--fd-line); background: var(--fd-surface); color: var(--fd-ink-soft); border-radius: 6px; cursor: pointer;
    padding: 6px 8px; font: inherit; white-space: nowrap;
  }
  .rail[data-side="start"] .rail-item, .rail[data-side="end"] .rail-item { writing-mode: vertical-rl; padding: 8px 4px; }
  .rail[data-side="start"] .rail-item { transform: rotate(180deg); }
  .rail-item[aria-expanded="true"] { color: var(--fd-accent); border-color: var(--fd-accent); }
  .drawer {
    position: absolute; z-index: 20; display: flex; box-shadow: var(--fd-shadow); border-radius: var(--fd-radius);
    animation: fd-slide 140ms ease-out;
  }
  .drawer[data-side="start"] { inset-block: 4px; inset-inline-start: 4px; width: min(360px, 40%); }
  .drawer[data-side="end"] { inset-block: 4px; inset-inline-end: 4px; width: min(360px, 40%); }
  .drawer[data-side="top"] { inset-inline: 4px; top: 4px; height: min(280px, 45%); }
  .drawer[data-side="bottom"] { inset-inline: 4px; bottom: 4px; height: min(280px, 45%); }
  @keyframes fd-slide { from { opacity: 0; transform: scale(0.98); } }
  .window {
    position: absolute; z-index: 30; display: flex; flex-direction: column; min-width: 160px; min-height: 90px;
    border-radius: var(--fd-radius); box-shadow: var(--fd-shadow); background: var(--fd-surface);
  }
  .window > .content { flex: 1 1 auto; display: flex; min-height: 0; }
  .window .stack { border-radius: var(--fd-radius); }
  .grip { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; touch-action: none; }
  .grip::after { content: ""; position: absolute; right: 3px; bottom: 3px; width: 6px; height: 6px; border-right: 2px solid var(--fd-ink-soft); border-bottom: 2px solid var(--fd-ink-soft); }
  .overlay { position: absolute; inset: 0; z-index: 50; pointer-events: none; }
  .preview { position: absolute; background: var(--fd-target); border: 2px solid var(--fd-accent); border-radius: var(--fd-radius); transition: all 90ms ease-out; }
  .ghost {
    position: absolute; padding: 6px 12px; border-radius: 6px; background: var(--fd-accent); color: var(--fd-accent-ink);
    font-weight: 600; box-shadow: var(--fd-shadow); white-space: nowrap; transform: translate(10px, 10px);
  }
  .target {
    position: absolute; width: 32px; height: 32px; margin: -16px 0 0 -16px; display: grid; place-items: center;
    border-radius: 8px; background: var(--fd-surface); color: var(--fd-ink-soft); border: 1px solid var(--fd-line); box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
  }
  .target[data-hot] { background: var(--fd-accent); color: var(--fd-accent-ink); border-color: var(--fd-accent); }
  .menu, .palette {
    position: absolute; z-index: 60; background: var(--fd-surface); color: var(--fd-ink); border: 1px solid var(--fd-line);
    border-radius: var(--fd-radius); box-shadow: var(--fd-shadow); padding: 4px; min-width: 180px;
  }
  .menu button, .palette li {
    display: flex; gap: 8px; align-items: center; width: 100%; border: 0; background: none; color: inherit; font: inherit;
    text-align: start; padding: 6px 10px; border-radius: 6px; cursor: pointer;
  }
  .menu button:hover, .menu button:focus-visible, .palette li[aria-selected="true"] { background: var(--fd-target); outline: none; }
  .menu hr { border: 0; border-top: 1px solid var(--fd-line); margin: 4px; }
  .palette { left: 50%; top: 12%; transform: translateX(-50%); width: min(460px, 90%); padding: 8px; }
  .palette input {
    width: 100%; font: inherit; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--fd-line);
    background: var(--fd-surface-2); color: inherit; outline-color: var(--fd-accent);
  }
  .palette ul { list-style: none; margin: 6px 0 0; padding: 0; max-height: 300px; overflow: auto; }
  .palette small { color: var(--fd-ink-soft); margin-inline-start: auto; }
  .menu button[disabled] { opacity: 0.45; cursor: default; background: none; }
  .menu button[aria-checked="true"]::after { content: "\\2713"; margin-inline-start: auto; color: var(--fd-accent); }
  .tab[data-pinned] { padding-inline: 8px; gap: 4px; }
  .tab .pin { display: inline-flex; color: var(--fd-ink-soft); }
  .tab .pin svg { width: 11px; height: 11px; }
  .notice {
    position: absolute; z-index: 70; top: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center;
    max-width: min(640px, 94%); padding: 8px 10px 8px 14px; border-radius: var(--fd-radius); background: var(--fd-surface);
    color: var(--fd-ink); border: 1px solid var(--fd-accent); box-shadow: var(--fd-shadow);
  }
  .notice-btn { width: auto; padding: 0 10px; height: 28px; white-space: nowrap; border: 1px solid var(--fd-line); }
  .notice-btn[data-primary] { background: var(--fd-accent); color: var(--fd-accent-ink); border-color: var(--fd-accent); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  @media (prefers-reduced-motion: reduce) { .drawer, .preview { animation: none; transition: none; } }
`;
