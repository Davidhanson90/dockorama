# Benchmarks

Recorded 2026-10-14 with `npm run bench` (median of 3 runs) — Chromium 156.0.8078.4 headless, Intel(R) Xeon(R) Processor ×8.

A dock with 4 groups (one a document area) and N views, each with a short list as content.

| Views | retain | Model op (mean) | First render | Layout change (mean) | Drag move avg / p95 | Frame avg / p95 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 100 | `all` | 0.07 ms | 14.5 ms | 6.13 ms | 3.54 / 5.8 ms | 16.67 / 16.8 ms |
| 500 | `all` | 0.45 ms | 54.6 ms | 28.16 ms | 12.66 / 17.3 ms | 16.67 / 16.7 ms |
| 500 | `active` | 0.42 ms | 70 ms | 37.77 ms | 13.56 / 22.6 ms | 16.95 / 16.7 ms |

- **Model op**: one pure `place()` on the model.
- **First render**: assigning the model until every part has updated.
- **Layout change**: one undoable `dock.place()` including re-render.
- **Drag move**: one pointer move during a tab drag, including hit-testing and the drop-guide update.
- **Frame**: animation-frame interval during the drag (16.7 ms = 60 fps).

Run it live on the Performance guide page of the docs site.
