import { css } from "lit";

/** Ledger: bold and graphic. Thick ink borders, square corners, uppercase labels, a signal-yellow accent. */
export const ledgerCss = css`
  :host {
    --fd-accent: #111111; --fd-accent-ink: #ffe14d; --fd-canvas: #ffe14d; --fd-surface: #fffdf2; --fd-surface-2: #ffffff;
    --fd-ink: #111111; --fd-ink-soft: #3b3b3b; --fd-line: #111111; --fd-gutter: 8px; --fd-radius: 0px; --fd-bar-height: 36px;
    --fd-target: rgb(17 17 17 / 0.12); --fd-shadow: 6px 6px 0 #111111;
    --fd-font: "Helvetica Neue", Arial, sans-serif;
  }
  :host([theme="dark"]) {
    --fd-accent: #ffe14d; --fd-accent-ink: #111111; --fd-canvas: #111111; --fd-surface: #1c1c1c; --fd-surface-2: #262626;
    --fd-ink: #fffdf2; --fd-ink-soft: #d6d3c4; --fd-line: #ffe14d; --fd-shadow: 6px 6px 0 #ffe14d;
  }
  .stack { border-width: 3px; box-shadow: 4px 4px 0 var(--fd-line); }
  .stack[data-active] { border-color: var(--fd-line); box-shadow: 6px 6px 0 var(--fd-line); }
  .bar { border-bottom: 3px solid var(--fd-line); }
  .title, .tab, .rail-item, .ghost { text-transform: uppercase; letter-spacing: 0.06em; font-weight: 800; font-size: 11px; }
  .tabs { padding-top: 0; gap: 0; }
  .tab { border-radius: 0; border: 0; border-inline-end: 3px solid var(--fd-line); height: 100%; }
  .tab[aria-selected="true"], .tab[data-pinned][aria-selected="true"] { background: var(--fd-accent); color: var(--fd-accent-ink); border-color: var(--fd-line); margin: 0; }
  .stack[data-active] .tab[aria-selected="true"] { box-shadow: none; }
  .tab[aria-selected="true"] .btn { color: inherit; }
  .btn { border-radius: 0; }
  .btn:hover { background: var(--fd-accent); color: var(--fd-accent-ink); }
  .ledger-mark { font-weight: 900; margin-inline-start: 4px; }
  .gutter::after { border-radius: 0; background: var(--fd-line); opacity: 0.25; }
  .target { border-radius: 0; border: 3px solid var(--fd-line); box-shadow: 3px 3px 0 var(--fd-line); }
  .preview { border-radius: 0; border-width: 3px; }
  .window, .menu, .palette, .confirm-box, .notice, .drawer { border-radius: 0; border: 3px solid var(--fd-line); }
  .rail-item { border-radius: 0; border-width: 3px; }
`;
