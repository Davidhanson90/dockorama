import { css } from "lit";

/** Ledger: bold and graphic. Thick ink borders, square corners, uppercase labels, a signal-yellow accent. */
export const ledgerCss = css`
  :host {
    --dk-accent: #111111; --dk-accent-ink: #ffe14d; --dk-canvas: #ffe14d; --dk-surface: #fffdf2; --dk-surface-2: #ffffff;
    --dk-ink: #111111; --dk-ink-soft: #3b3b3b; --dk-line: #111111; --dk-gutter: 8px; --dk-radius: 0px; --dk-bar-height: 36px;
    --dk-target: rgb(17 17 17 / 0.12); --dk-shadow: 6px 6px 0 #111111;
    --dk-font: "Helvetica Neue", Arial, sans-serif;
  }
  :host([theme="dark"]) {
    --dk-accent: #ffe14d; --dk-accent-ink: #111111; --dk-canvas: #111111; --dk-surface: #1c1c1c; --dk-surface-2: #262626;
    --dk-ink: #fffdf2; --dk-ink-soft: #d6d3c4; --dk-line: #ffe14d; --dk-shadow: 6px 6px 0 #ffe14d;
  }
  .stack { border-width: 3px; box-shadow: 4px 4px 0 var(--dk-line); }
  .stack[data-active] { border-color: var(--dk-line); box-shadow: 6px 6px 0 var(--dk-line); }
  .bar { border-bottom: 3px solid var(--dk-line); }
  .title, .tab, .rail-item, .ghost { text-transform: uppercase; letter-spacing: 0.06em; font-weight: 800; font-size: 11px; }
  .tabs { padding-top: 0; gap: 0; }
  .tab { border-radius: 0; border: 0; border-inline-end: 3px solid var(--dk-line); height: 100%; }
  .tab[data-selected], .tab[data-pinned][data-selected] { background: var(--dk-accent); color: var(--dk-accent-ink); border-color: var(--dk-line); margin: 0; }
  .stack[data-active] .tab[data-selected] { box-shadow: none; }
  .tab[data-selected] .btn { color: inherit; }
  .btn { border-radius: 0; }
  .btn:hover { background: var(--dk-accent); color: var(--dk-accent-ink); }
  .ledger-mark { font-weight: 900; margin-inline-start: 4px; }
  .gutter::after { border-radius: 0; background: var(--dk-line); opacity: 0.25; }
  .target { border-radius: 0; border: 3px solid var(--dk-line); box-shadow: 3px 3px 0 var(--dk-line); }
  .preview { border-radius: 0; border-width: 3px; }
  .window, .menu, .palette, .confirm-box, .notice, .drawer { border-radius: 0; border: 3px solid var(--dk-line); }
  .rail-item { border-radius: 0; border-width: 3px; }
`;
