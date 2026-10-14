# Gallery architecture notes

Things that are not obvious from reading the code. Written at the end of the
2026-10 gallery overhaul.

## URL is the source of truth
- `router.js` owns `popstate`. List state (facets, search, order) lives in the
  query string and is applied **in place**: `updateRoute()` does
  `replaceState` and asks the active view to `refresh()` rather than re-render,
  so toggling a facet keeps focus and the filter sheet open.
- The viewer owns `/art/<id>` history entries. A card click pushes one;
  closing pops it (`history.back()`). A direct visit has nothing to pop, so
  closing does `replaceState('/')`. The router only reacts to `/art/<id>` by
  calling `openArtworkById` / `closeArtworkSilently`.
- The list underneath a direct `/art/<id>` visit is "all work, latest first".
- `history.scrollRestoration` is `manual`; scroll is stored in `history.state`
  before each in-app navigation and restored on back/forward.

## Viewer
- Fullscreen goes on `#viewer-root`, **not** the `<dialog>` (Chrome throws
  "Dialog elements are invalid" for `requestFullscreen()` on a dialog). Toasts
  render into `fullscreenElement` or the open dialog, because the modal dialog
  is in the top layer and would cover a toast appended to `<body>`.
- Escape is handled in `keydown` with `preventDefault()`. Relying on the
  dialog's `cancel` event alone is not enough: a second Escape without
  intervening user activation makes the browser close the dialog outright.
- Chrome auto-hide ignores `:focus` and only respects `:focus-visible`, so a
  mouse click on a button does not pin the controls on screen.
- Loads are guarded by a generation counter; every async callback compares it
  before touching the DOM.

## Grid
- Items carry `width`/`height` (since the 2026-10 data contract), so cards
  reserve their exact ratio and nothing reflows. Older JSON without them still
  works: `grid.js` then reserves 3:4, learns ratios from `naturalWidth/Height`
  on load and caches them in `localStorage` (`artshow_ratios`).
- The viewer shows `displayUrl` (2000px) and swaps in `imageUrl` only when the
  visitor zooms; originals are multi-MB scans up to ~7000px.
- Row layout is computed in JS (flex rows, width = rowHeight x ratio). It is
  re-run on container width change and whenever a new ratio is learnt.

## Storage keys (all via `storageService`, prefix `artshow_`)
`wall`, `ratios`. Legacy keys `artshow-theme`, `artshow-background`,
`artshow_hide_ads`, `view_mode`, `group_by_mode`, `items_per_page` are no
longer read; `wall.js` migrates `artshow-background` once and deletes the
rest it knows about.

## Testing locally
- `netlify dev` or any static server **with a `/* -> /index.html` fallback**;
  `python -m http.server` 404s on `/collections` and `/art/<id>`.
- `scripts/verify.mjs` brings its own server.
