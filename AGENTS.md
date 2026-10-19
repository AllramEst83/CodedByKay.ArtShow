# CodedByKay.ArtShow — Agent Guide

## App Overview
- **Type:** Vanilla HTML, CSS, and JS art portfolio website.
- **Hosting & Backend:** Deployed on Netlify as static hosting. No Netlify Functions remain (retired 2026-09-11 once media moved fully off Netlify); the only server code is the `/art/*` share-preview Edge Function (see Share links).
- **Data & Media Handling:**
  - Artwork metadata lives in `data/artwork.json`, committed to this repo and written by the sibling `CodedByKay.ArtShow.CLI` tool's `Publish` command (see `ArtShow.Workspace/AGENTS.md`). The frontend (`js/main.js`) fetches it directly as a static file — `netlify.toml`'s `publish = "."` already exposes it at that path, no serverless function involved. (It used to live under `netlify/functions/data/` from when a function read it off disk; moved to `data/` 2026-09-11 once that function was retired, so the path wouldn't keep implying one exists.)
  - Images are hosted on **Cloudflare R2** via the custom domain `https://kaysartshow.fyi` — `imageUrl`/`thumbnailUrl` in `artwork.json` are already-absolute URLs pointing there (never the bucket's `r2.dev` URL). This repo stores no raw image files; `assets/drawings/` was removed once every item was confirmed live on R2.
  - Video is hosted on **YouTube** (uploaded manually via YouTube Studio, not through this repo or the CLI's API). `artwork.json` items also carry `width`/`height` (oriented original), `displayUrl` (~2000px WebP the viewer shows; null when the original is already small, then `imageUrl` is used), `datePrecision` (`year`|`day`) and `media[]`; `data/collections.json` holds optional collection blurb/cover/order. The front end treats every one of those as optional (see `js/modules/data.js`). `artwork.json`'s `videoUrl` is a bare `https://www.youtube-nocookie.com/embed/<id>` URL; the viewer (`js/modules/viewer.js`) embeds it in an `<iframe>` only after the visitor presses play, with playback params appended at that time, instead of a raw `<video>` element. `thumbnailUrl` for video items is YouTube's own auto-generated thumbnail (`img.youtube.com/vi/<id>/hqdefault.jpg`).
  - No origin/hotlink gating remains on the app-code side (the old `media-gate.js` Edge Function and `/.netlify/functions/image` Lambda are both deleted) — if hotlink protection is ever wanted for the R2-hosted images, it's a Cloudflare dashboard setting on the custom domain, not app code.
- **Share links:** `/art/<id>?v=<hash>` opens that artwork in the viewer (`js/modules/share.js`, `viewer.js`; the viewer's share button builds the link, `v` is a hash of title/description/image so chat apps refetch the preview when an artwork changes). Because link-preview crawlers don't run JS, the one remaining Netlify **Edge Function**, `netlify/edge-functions/share-preview.js`, serves `index.html` for `/art/*` with that artwork's title, description and 600w thumbnail written into the Open Graph tags. It only reads the static `data/artwork.json`. A direct visit to `/art/<id>` renders "all work" underneath and opens the viewer over it; closing returns to `/`. When opened from a list, the viewer walks that list (a collection, a year, a filtered view) and closing leaves its card on screen. Asset paths in `index.html` are root-absolute (`/css/...`) so the page works under `/art/<id>`.
- **Routing & Deployment:** Single Page Application (SPA) using root fallback (`/*` -> `/index.html`). The root folder `.` is published directly with no build step (`npm run dev` starts `netlify dev`).

## Frontend structure
One look, built around the drawing: three **walls** (dark default, gray, paper) swap ~12 colour tokens; everything else is monochrome. No themes, no ads, no radius or shadows. All colours live in `css/tokens.css` — `node scripts/verify.mjs` fails if a hex colour appears elsewhere.

```
index.html            shell: skip link, header (brand, nav, search toggle, wall switch),
                      <main id="view">, <dialog id="viewer">
css/tokens.css        base tokens + dark/gray/paper wall blocks
css/styles.css        base, header, buttons, loading/empty, toast, reduced motion
css/browse.css        views, toolbar, filter sheet, justified grid, collections
css/viewer.css        the viewing room
js/main.js            boot: wall -> data -> router; renders routes, header search
js/modules/data.js    normalise artwork.json; derived fields + fallbacks; facets/sort
js/modules/router.js  URL <-> view state, link interception, scroll restore
js/modules/store.js   shared state: artwork, collections, years, current list
js/modules/grid.js    justified rows, cards (<a href="/art/<id>">), ratio cache
js/modules/viewer.js  dialog viewer: progressive load, nav, info, fullscreen
js/modules/viewer-zoom.js  pointer-event zoom/pan/swipe
js/modules/wall.js    wall switch (collapses behind an icon popover at <=600px) + legacy key migration
js/modules/share.js   share URLs, toast
js/modules/storage.js guarded localStorage (all storage goes through it)
js/modules/copy.js    neutral UI strings
js/views/browse.js    work / collection / year list view; collections.js: tiles
```

Routes: `/`, `/collections`, `/collections/<slug>`, `/year/<yyyy>`, `/art/<id>`. Query params on list views: `q`, `collection`, `medium`, `subject` (comma lists, OR within a facet, AND across), `order=chronological`.

Open items (About page, self-hosted font, Lighthouse pass) are tracked in `ArtShow.Workspace/todo.md`. Non-obvious design notes: `agent-learnt/gallery-architecture.md`.

## Checking changes
`node scripts/verify.mjs` (dev-only, no dependencies; needs a local Chrome/Chromium — set `CHROME_PATH` or `--chrome`). It serves the repo with the SPA fallback and checks every route at 375/768/1440px on all three walls: console errors, horizontal scroll, one `h1`, deep link + Escape, boot with blocked storage, 44px touch targets, tokens-only colours. Screenshots land in the temp dir (or `--out`).

## Agent Learnings (`agent-learnt/`)
The `agent-learnt/` directory is reserved for recording technical insights, environment quirks, and architectural decisions discovered across development sessions. 

Future AI agents working on this project should check `agent-learnt/` before starting tasks and add new notes as new lessons or edge cases are encountered.

## Agent Rules
Additional agent rules and project guidelines can be found in [.cursor/rules](./CodedByKay.ArtShow/.agents/rules).