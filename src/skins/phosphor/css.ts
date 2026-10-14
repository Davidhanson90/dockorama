import { css } from "lit";

/** Phosphor: a retro terminal. Monospace, green on black, scanlines, ASCII controls. */
export const phosphorCss = css`
  :host, :host([theme="dark"]), :host([theme="light"]) {
    --pz-accent: #39ff88; --pz-accent-ink: #001a0b; --pz-canvas: #020805; --pz-surface: #04110a; --pz-surface-2: #071a10;
    --pz-ink: #a8ffcb; --pz-ink-soft: #4fae78; --pz-line: #12452a; --pz-radius: 2px; --pz-bar-height: 30px;
    --pz-target: rgb(57 255 136 / 0.12); --pz-shadow: 0 0 18px rgb(57 255 136 / 0.25);
    --pz-font: "IBM Plex Mono", "Cascadia Mono", ui-monospace, monospace; --pz-font-size: 12px;
    color-scheme: dark;
  }
  .frame { background-image: repeating-linear-gradient(0deg, rgb(57 255 136 / 0.035) 0 1px, transparent 1px 3px); }
  .stack { border-radius: 2px; }
  .stack[data-active] { border-color: var(--pz-accent); box-shadow: 0 0 12px rgb(57 255 136 / 0.25); }
  .title, .tab, .rail-item { text-shadow: 0 0 6px rgb(57 255 136 / 0.6); }
  .tab { border-radius: 0; }
  .tab[aria-selected="true"] { background: var(--pz-surface); border-color: var(--pz-line); }
  .stack[data-active] .tab[aria-selected="true"] { box-shadow: inset 0 -2px 0 var(--pz-accent); }
  .phos { font: inherit; color: inherit; }
  .btn { border-radius: 0; color: var(--pz-ink-soft); }
  .btn:hover { background: var(--pz-accent); color: var(--pz-accent-ink); }
  .gutter::after { border-radius: 0; }
  .target { border-radius: 0; background: var(--pz-canvas); color: var(--pz-accent); border-color: var(--pz-accent); font: 700 13px/1 var(--pz-font); }
  .target[data-hot] { background: var(--pz-accent); color: var(--pz-accent-ink); }
  .preview { border-radius: 0; border-style: dashed; }
  .window, .menu, .palette, .confirm-box, .notice, .drawer, .rail-item { border-radius: 0; }
  .ghost { border-radius: 0; font-family: var(--pz-font); }
`;
