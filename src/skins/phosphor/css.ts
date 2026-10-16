import { css } from "lit";

/** Phosphor: a retro terminal. Monospace, green on black, scanlines, ASCII controls. */
export const phosphorCss = css`
  :host, :host([theme="dark"]), :host([theme="light"]) {
    --dk-accent: #39ff88; --dk-accent-ink: #001a0b; --dk-canvas: #020805; --dk-surface: #04110a; --dk-surface-2: #071a10;
    --dk-ink: #a8ffcb; --dk-ink-soft: #4fae78; --dk-line: #12452a; --dk-radius: 2px; --dk-bar-height: 30px;
    --dk-target: rgb(57 255 136 / 0.12); --dk-shadow: 0 0 18px rgb(57 255 136 / 0.25);
    --dk-font: "IBM Plex Mono", "Cascadia Mono", ui-monospace, monospace; --dk-font-size: 12px;
    color-scheme: dark;
  }
  .frame { background-image: repeating-linear-gradient(0deg, rgb(57 255 136 / 0.035) 0 1px, transparent 1px 3px); }
  .stack { border-radius: 2px; }
  .stack[data-active] { border-color: var(--dk-accent); box-shadow: 0 0 12px rgb(57 255 136 / 0.25); }
  .title, .tab, .rail-item { text-shadow: 0 0 6px rgb(57 255 136 / 0.6); }
  .tab { border-radius: 0; }
  .tab[aria-selected="true"] { background: var(--dk-surface); border-color: var(--dk-line); }
  .stack[data-active] .tab[aria-selected="true"] { box-shadow: inset 0 -2px 0 var(--dk-accent); }
  .phos { font: inherit; color: inherit; }
  .btn { border-radius: 0; color: var(--dk-ink-soft); }
  .btn:hover { background: var(--dk-accent); color: var(--dk-accent-ink); }
  .gutter::after { border-radius: 0; }
  .target { border-radius: 0; background: var(--dk-canvas); color: var(--dk-accent); border-color: var(--dk-accent); font: 700 13px/1 var(--dk-font); }
  .target[data-hot] { background: var(--dk-accent); color: var(--dk-accent-ink); }
  .preview { border-radius: 0; border-style: dashed; }
  .window, .menu, .palette, .confirm-box, .notice, .drawer, .rail-item { border-radius: 0; }
  .ghost { border-radius: 0; font-family: var(--dk-font); }
`;
