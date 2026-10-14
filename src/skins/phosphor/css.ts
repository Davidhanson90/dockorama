import { css } from "lit";

/** Phosphor: a retro terminal. Monospace, green on black, scanlines, ASCII controls. */
export const phosphorCss = css`
  :host, :host([theme="dark"]), :host([theme="light"]) {
    --fd-accent: #39ff88; --fd-accent-ink: #001a0b; --fd-canvas: #020805; --fd-surface: #04110a; --fd-surface-2: #071a10;
    --fd-ink: #a8ffcb; --fd-ink-soft: #4fae78; --fd-line: #12452a; --fd-radius: 2px; --fd-bar-height: 30px;
    --fd-target: rgb(57 255 136 / 0.12); --fd-shadow: 0 0 18px rgb(57 255 136 / 0.25);
    --fd-font: "IBM Plex Mono", "Cascadia Mono", ui-monospace, monospace; --fd-font-size: 12px;
    color-scheme: dark;
  }
  .frame { background-image: repeating-linear-gradient(0deg, rgb(57 255 136 / 0.035) 0 1px, transparent 1px 3px); }
  .stack { border-radius: 2px; }
  .stack[data-active] { border-color: var(--fd-accent); box-shadow: 0 0 12px rgb(57 255 136 / 0.25); }
  .title, .tab, .rail-item { text-shadow: 0 0 6px rgb(57 255 136 / 0.6); }
  .tab { border-radius: 0; }
  .tab[aria-selected="true"] { background: var(--fd-surface); border-color: var(--fd-line); }
  .stack[data-active] .tab[aria-selected="true"] { box-shadow: inset 0 -2px 0 var(--fd-accent); }
  .phos { font: inherit; color: inherit; }
  .btn { border-radius: 0; color: var(--fd-ink-soft); }
  .btn:hover { background: var(--fd-accent); color: var(--fd-accent-ink); }
  .gutter::after { border-radius: 0; }
  .target { border-radius: 0; background: var(--fd-canvas); color: var(--fd-accent); border-color: var(--fd-accent); font: 700 13px/1 var(--fd-font); }
  .target[data-hot] { background: var(--fd-accent); color: var(--fd-accent-ink); }
  .preview { border-radius: 0; border-style: dashed; }
  .window, .menu, .palette, .confirm-box, .notice, .drawer, .rail-item { border-radius: 0; }
  .ghost { border-radius: 0; font-family: var(--fd-font); }
`;
