import { css } from "lit";

/** Ledger: bold and graphic. Thick ink borders, square corners, uppercase labels, a signal-yellow accent. */
export const ledgerCss = css`
  :host {
    --pz-accent: #111111; --pz-accent-ink: #ffe14d; --pz-canvas: #ffe14d; --pz-surface: #fffdf2; --pz-surface-2: #ffffff;
    --pz-ink: #111111; --pz-ink-soft: #3b3b3b; --pz-line: #111111; --pz-gutter: 8px; --pz-radius: 0px; --pz-bar-height: 36px;
    --pz-target: rgb(17 17 17 / 0.12); --pz-shadow: 6px 6px 0 #111111;
    --pz-font: "Helvetica Neue", Arial, sans-serif;
  }
  :host([theme="dark"]) {
    --pz-accent: #ffe14d; --pz-accent-ink: #111111; --pz-canvas: #111111; --pz-surface: #1c1c1c; --pz-surface-2: #262626;
    --pz-ink: #fffdf2; --pz-ink-soft: #d6d3c4; --pz-line: #ffe14d; --pz-shadow: 6px 6px 0 #ffe14d;
  }
  .stack { border-width: 3px; box-shadow: 4px 4px 0 var(--pz-line); }
  .stack[data-active] { border-color: var(--pz-line); box-shadow: 6px 6px 0 var(--pz-line); }
  .bar { border-bottom: 3px solid var(--pz-line); }
  .title, .tab, .rail-item, .ghost { text-transform: uppercase; letter-spacing: 0.06em; font-weight: 800; font-size: 11px; }
  .tabs { padding-top: 0; gap: 0; }
  .tab { border-radius: 0; border: 0; border-inline-end: 3px solid var(--pz-line); height: 100%; }
  .tab[aria-selected="true"], .tab[data-pinned][aria-selected="true"] { background: var(--pz-accent); color: var(--pz-accent-ink); border-color: var(--pz-line); margin: 0; }
  .stack[data-active] .tab[aria-selected="true"] { box-shadow: none; }
  .tab[aria-selected="true"] .btn { color: inherit; }
  .btn { border-radius: 0; }
  .btn:hover { background: var(--pz-accent); color: var(--pz-accent-ink); }
  .ledger-mark { font-weight: 900; margin-inline-start: 4px; }
  .gutter::after { border-radius: 0; background: var(--pz-line); opacity: 0.25; }
  .target { border-radius: 0; border: 3px solid var(--pz-line); box-shadow: 3px 3px 0 var(--pz-line); }
  .preview { border-radius: 0; border-width: 3px; }
  .window, .menu, .palette, .confirm-box, .notice, .drawer { border-radius: 0; border: 3px solid var(--pz-line); }
  .rail-item { border-radius: 0; border-width: 3px; }
`;
