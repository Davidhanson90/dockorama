import { css } from "lit";

/** Nimbus: soft and airy. Pill tabs, floating cards, wide gaps, a violet-to-teal accent. */
export const nimbusCss = css`
  :host {
    --fd-accent: #7c4dff; --fd-accent-ink: #ffffff; --fd-canvas: linear-gradient(135deg, #eef2ff, #e6fbf7);
    --fd-surface: #ffffff; --fd-surface-2: #ffffff; --fd-ink: #2a2550; --fd-ink-soft: #7a76a0; --fd-line: #e7e4f7;
    --fd-gutter: 12px; --fd-radius: 18px; --fd-bar-height: 44px; --fd-target: rgb(124 77 255 / 0.14);
    --fd-shadow: 0 18px 40px rgb(60 40 140 / 0.18);
    background: var(--fd-canvas);
  }
  :host([theme="dark"]) {
    --fd-canvas: linear-gradient(135deg, #17142b, #0f2421); --fd-surface: #221d3d; --fd-surface-2: #221d3d;
    --fd-ink: #ece9ff; --fd-ink-soft: #a19cc8; --fd-line: #342d5c; --fd-accent: #a58bff; --fd-accent-ink: #160f33;
  }
  .main { padding: 10px; }
  .stack { border: 0; box-shadow: 0 6px 24px rgb(60 40 140 / 0.10); }
  .stack[data-active] { box-shadow: 0 0 0 2px var(--fd-accent), 0 10px 30px rgb(124 77 255 / 0.2); }
  .bar { border-bottom: 0; padding: 0 8px; }
  .tabs { padding-top: 0; align-items: center; gap: 6px; }
  .tab { border-radius: 999px; border: 0; height: 30px; padding: 0 8px 0 14px; margin: 0; }
  .tab[aria-selected="true"], .tab[data-pinned][aria-selected="true"] { background: var(--fd-accent); color: var(--fd-accent-ink); margin: 0; }
  .stack[data-active] .tab[aria-selected="true"] { box-shadow: 0 4px 12px rgb(124 77 255 / 0.35); }
  .tab[aria-selected="true"] .btn { color: inherit; }
  .btn { border-radius: 999px; }
  .gutter::after { border-radius: 999px; }
  .nimbus-dots { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; color: var(--fd-ink-soft); font-size: 10px; letter-spacing: 1px; }
  .split[data-axis="row"] > .gutter .nimbus-dots { writing-mode: vertical-rl; }
  .target { border-radius: 50%; border: 0; box-shadow: 0 6px 16px rgb(60 40 140 / 0.25); }
  .preview { border-radius: 18px; border-style: dashed; }
  .ghost { border-radius: 999px; }
  .window { border-radius: 22px; }
  .rail-item { border-radius: 999px; border: 0; box-shadow: 0 2px 8px rgb(60 40 140 / 0.12); }
  .menu, .palette, .confirm-box, .notice { border-radius: 16px; border: 0; }
`;
