# Gallery Overhaul Plan — a site built only for viewing drawings

Status: **proposed** (written 2026-10-13 after a full read of `index.html`, `css/`, `js/`, `data/artwork.json`).
Audience: the agent(s) who implement this. Each phase is independently shippable and leaves the site working.

Read first: `AGENTS.md`, `agent-learnt/environment-and-architecture.md`, `.agents/rules/vanilla-web-development.mdc`.
Hard constraints from those: vanilla HTML/CSS/ES modules, **no build step**, publish root is `.`, no Netlify functions
other than the `/art/*` share-preview edge function, `data/artwork.json` is written by the sibling CLI (not hand-edited
except as a stopgap), CSS custom properties for colour/spacing/type, loading + shimmer states for async content.

---

## 1. Why: what in the app doesn't serve "looking at drawings"

The collection today: **143 pieces** (141 images, 2 videos), 15 distinct years, 2002 → 2026.

### 1.1 Features that fight the art

| Feature | Where | Problem |
|---|---|---|
| **6 themes × 4 backgrounds = 24 looks** | `index.html:76-93`, `js/modules/themes.js`, `css/tokens.css` (~330 lines), ~100 lines of per-theme overrides in `css/styles.css` | Most are UI-decoration styles (glass blur, clay inset shadows, neumorphic emboss, synthwave neon, 3px borders on `*` for neo-brutalism). They compete with the drawings and each needs its own contrast/accent patching (see the `[data-bg][data-theme]` matrix in `tokens.css:200-356`). No one can design 24 looks well; the result is that none is excellent. |
| **Fake ads + "Hide Ads" switch** | `index.html:67-75,191-212`, `js/modules/ads.js`, `js/main.js:65-86` (parallax), `.fake-ad*` CSS, `assets/ads/` (1.7 MB) | A joke feature that puts 4 unrelated images beside the work, and a header control to turn it off. Only appears ≥1700px wide. Directly opposed to "immersion". |
| **Six Google font families** | `index.html:55` | Inter, Roboto, Space Mono, Quicksand, Orbitron, Rajdhani in one render-blocking request; at most one or two are ever used at a time. |
| **Header with 3 controls + brand** | `index.html:64-95` | Two `<select>`s and a switch are the first thing you see, above the art. |
| **Pagination (25/50/100 per page, Prev/Next)** | `js/modules/pagination.js`, `index.html:172-187` | Breaks flow. The lightbox walks the *whole* filtered list but the grid shows one page, so after "next" past the last item on a page, closing the viewer can't scroll to the card (`revealCard` silently no-ops, `lightbox.js:~215`). |
| **Grid ⇄ Groups mode + Name ⇄ Year sub-toggle + breadcrumb + hidden Sort section** | `js/modules/groups.js`, `index.html:102-111,152-161` | Four interacting pieces of module-level state, saved in localStorage but **not in the URL** (reload/back loses your place). Grouping is a "mode" instead of navigation. |
| **Filter & Sort popover with 5 sections** (sort, categories, tags, timeline slider, clear) | `js/modules/filters.js`, `index.html:112-141` | Built for a database, not a gallery (see 1.2). |
| **Playful error copy** ("The internet ate our pencils!", "took a coffee break!") | `gallery.js`, `main.js`, `lightbox.js`, `index.html:167-168` | Tone clashes with a mature/immersive direction. Repeated in 5 places with no single source. |

### 1.2 The data model is being exposed as-is

Measured from `data/artwork.json`:

- **`category`** (6 values: Illustration 75, Concept Art 38, Portraits 18, Graffiti 8, Architecture 3, Landscape 1) largely duplicates **`groups`** (10 values: Fantastical 55, Whimsical 21, Atelje Kopiko 21, Studies 17, Portraits 15, Graffiti 10, School project 5, Architecture 3, Mythology 1, Landscape 1). Portraits / Graffiti / Architecture / Landscape exist in both. Two overlapping taxonomies = visitor confusion.
- **`tags`** mix three different things: *medium* (`pencil` 126, `watercolor`, `ink`, `marker`, `digital`), *non-discriminating filler* (`sketch` 94/143, `pencil` 126/143) and genuine *subject* tags (`creature` 35, `fantasy` 31, `humor` 22, `robot` 22, `animal`, `surreal`, `horror`, `nature`, `sci-fi`…). Filtering by "pencil" returns 88% of the site.
- **`medium`** is free text with 18 near-duplicate strings (`"Pencil, marker and watercolor. Digital"` / `"…Digital."` / `"Pencil, and watercolor. Digital"` …).
- **`createdDate`**: **127 of 143 are `YYYY-01-01`** — i.e. the real precision is *year*. Yet the UI shows `2010-01-01` in the viewer, offers a day-granularity **timeline slider** (`filters.js` `buildTimeline`, step = 1 day) and sorts "Created date" with arbitrary order inside each year.
- **`addedDate`** sort options ("Added date (Oldest/Newest)") are an owner concern; visitors care about "latest" at most.
- **No image dimensions** in the JSON → cards can't reserve space; `CSS column-count` masonry (`styles.css:~649`) reflows as thumbnails load and, worse, reads **top-to-bottom per column**, so chronological/sorted order is not visually readable.

### 1.3 The viewer (lightbox) is a themed card, not a viewing room

`js/modules/lightbox.js` (524 lines), `styles.css:1005-1400`:

- Framed card (`border-radius`, `box-shadow`, 1px border, 2rem overlay padding, `max-height: 90vh`) over an 85% black scrim — the art gets noticeably less than the screen. Theme colours leak in (glass tint, neo-brutal borders…).
- **Zoom** = `transform: scale(2)` on a `max-width:100%` img inside `overflow:auto` (`toggleZoom`): no pan control, not anchored to the click point, no wheel/pinch/drag, no way to see real pixels.
- Loads `imageUrl` (the **multi-MB original**, per the comment in `share-preview.js`) with a spinner; the already-cached 600w thumbnail is not used as an instant placeholder; neighbours are not preloaded.
- **No swipe/touch navigation** (buttons + arrow keys only); no `pointer`/`touch` handlers anywhere.
- `aria-modal="true"` but **no focus trap**, **focus is not returned** to the card on close, background not `inert`.
- Fullscreen works by *moving the sidebar DOM node* into the fullscreened container (`onFullscreenChange`) and duplicating prev/next buttons (`#lightbox-fs-prev/next`) — brittle.
- Chrome (close, 4 control buttons, 2 side arrows, info drawer) is always on screen; nothing auto-hides.
- Info shows `Created: 2010-01-01`, `Medium: <long free text>`, `Category`, tag chips — useful, but it's presented as a form-like sidebar.

### 1.4 Correctness / robustness bugs found while reading (fix opportunistically)

1. **Page can fail to boot when storage is blocked.** `groups.js:6-7` and `pagination.js:5` call `localStorage.getItem` at **module import time, unguarded**; `themes.js` does too. If storage throws (Safari private/blocked cookies), the import of `main.js` fails and the whole app is dead. A guarded `storageService` already exists (`storage.js`) but is used only by `ads.js`. Three key styles coexist: `artshow-theme`, `artshow_view_mode`, `artshow_hide_ads` (the last via the `artshow_` prefix wrapper).
2. **HTML injection from user-typed search**: `filters.js:298` sets `badge.innerHTML` from a template string containing `text`, where `text` contains the raw search query (`Search: <img onerror=…>` executes — self-XSS). Also `filters.js:56,64` build checkbox markup from data values via `innerHTML`, and `renderBadges` uses `querySelector('[value="${cat}"]')`, which breaks on values containing quotes.
3. **Dead CSS**: `css/themes.css` (124 lines) is **not linked anywhere** and duplicates `tokens.css`. `tokens.css:2-26` defines a second token set (`--bg`, `--bg-card`, `--accent-2`, `--font-mono`…) from another app that `styles.css` never references.
4. **Stale docs**: `agent-learnt/environment-and-architecture.md` ("Netlify Identity Integration" section) and `docs/netlify-identity-auth-setup.md` describe an `admin.html`, `js/auth.js`, `netlify/functions/admin-users.js` that do not exist in this repo.
5. **Cards are `<article tabindex=0>` + click handler** (`gallery.js`) — Enter works, Space doesn't, no middle-click / open-in-new-tab / link semantics, and crawlers see no links to `/art/<id>`.
6. `prefers-reduced-motion` is not honoured anywhere (hover `scale(1.02)`, shimmer, smooth scroll, lightbox transitions).
7. `<meta name="theme-color">` is hard-coded `#120e24` (glassmorphism) regardless of the chosen look.

---

## 2. Target: one considered look, built around the drawing

### 2.1 Design direction — "quiet brutalism / the gallery wall"

You mentioned *mature design* or *brutalism* to build immersion. The recommendation is to merge them: the **structural honesty** of brutalism (raw type, hairline rules, visible grid, zero decoration) with the **restraint** of a gallery (art is the only colour, lots of wall). This is *not* the current "neo-brutalism" theme (yellow hover, 4px black borders, cartoon shadows) — that one is loud and fights the work.

Principles:

1. **The art is the only colour.** UI is monochrome (ink on wall). Single accent used *only* for focus rings and the active state, and it must pass contrast on every wall.
2. **No decoration:** `border-radius: 0`, no drop/neon/inset shadows, no blur/glass, no gradients, no hover scale. Separation comes from hairlines (1px) and whitespace.
3. **Type does the personality:** one family (suggest a neutral grotesk — Inter is already loaded, or a self-hosted variable font), optionally a mono for tiny labels/years. Large, tight titles; uppercase 11–12px tracked micro-labels; tabular numerals for years.
4. **Content-first chrome:** the header is a thin bar (brand + 3–4 text links + search icon + wall switch). Everything else appears on demand.
5. **Don't crop the work.** Show drawings at their real aspect ratio, caption *beneath* (title · year) rather than hidden in a hover overlay (hover doesn't exist on touch).

### 2.2 "Wall" instead of theme + background

Replace the two dropdowns by **one** control with **three walls**, chosen for what they do for art (not for style):

| Wall | Purpose | Notes |
|---|---|---|
| **Dark** (default) | Immersive; makes light paper/scans glow | e.g. `#0f0f10`, text `#ecebe8` |
| **Gray** | Neutral mid-tone, the classic backdrop for judging colour/tone | the existing `#a9a9ae`-style wall; verify text/UI contrast |
| **Paper** | Warm off-white; closest to a sketchbook page | e.g. `#f3eee4` |

- UI: a small icon button in the header opening a 3-swatch popover (or segmented control) — not a `<select>`. Same control available inside the viewer (the wall matters most *while* looking).
- Persist as one key (`wall`) via `storageService`; pre-paint inline script in `<head>` sets `data-wall` to avoid a flash (keep, but guard + rename). **Migrate** old keys: map `artshow-background` `dark|gray|light` → `dark|gray|paper`; ignore `artshow-theme`; delete both.
- Tokens: a single `:root` block (spacing, type scale, hairline, focus, motion) + three `:root[data-wall="…"]` blocks that only swap ~8 colour tokens. Target: `tokens.css` < 120 lines, `data-theme` selectors in `styles.css` → 0.
- Keep `<meta name="theme-color">` in sync with the wall.

### 2.3 Information architecture

Visitor mental model: **"Browse everything → Collections → a Year → one piece."** Everything addressable by URL.

| URL | View |
|---|---|
| `/` | All work. Default order: *latest additions* first (matches current default, gives return visitors something new). Secondary order toggle: *Chronological* (oldest→newest, grouped under year headings). |
| `/collections` | One tile per collection (cover, name, count). Replaces "Groups" mode. |
| `/collections/<slug>` | Collection page: title, optional one-line blurb, its works. |
| `/year/<yyyy>` (or year anchors/rail on `/` chronological) | Works from that year. Replaces "Group by Year". |
| `/art/<id>?v=<hash>` | The viewer over whichever list you came from. **Unchanged contract** (share links + edge function). |

Facets (replace the 5-section popover): keep it to **Collection**, **Medium** (normalized, ~6 values), **Subject** (tags minus medium/filler). Show as a single row of text toggles / one slim sheet. **Drop from the UI:** `category` (redundant with collection), Title A–Z sort, "Added date" sorts, the day-level timeline slider (replace with the year rail). Search stays (title, description, tags) but collapses to an icon that expands.

---

## 3. Cross-repo asks (sibling `CodedByKay.ArtShow.CLI`) — non-blocking

Everything below has a **front-end fallback** so the web work doesn't wait. Do these in parallel when convenient; the frontend should feature-detect the new fields.

1. **`width` / `height`** (of the thumbnail, or of the original + thumb) per item → enables `aspect-ratio` on cards (no layout shift) and justified rows. *Fallback:* read `naturalWidth/Height` on load and reserve a 4:3 box meanwhile.
2. **`displayUrl`** — a ~2000px-long-edge WebP between thumb (600w) and original, used by the viewer by default; `imageUrl` (original) only for "view full size". *Fallback:* use `imageUrl`.
3. **Date precision**: `datePrecision: "year" | "month" | "day"` (or store year-only dates as `"2010"`). *Fallback:* treat `MM-DD === 01-01` as year-only (127/143 items).
4. **Normalized medium**: `media: ["pencil","watercolor","ink","marker","digital","photography"]` array alongside the free-text `medium` (keep that as the caption string). *Fallback:* a small keyword map in `js/modules/` that derives `media[]` from `medium` + tags.
5. **Subject tags clean-up**: stop emitting medium words and `sketch` as tags (or flag them). *Fallback:* a deny-list constant in the frontend.
6. **Collections**: slug + optional `blurb` + optional manual `order`/`cover` per collection (today a collection is only a string on each item). *Fallback:* slugify the string, cover = most recent piece, blurb none.
7. **`alt`** text (the current descriptions are already alt-quality; could just reuse `description`).

---

## 4. Phases

Every phase: keep `/art/<id>` deep links, share-preview edge function and `data/artwork.json` fetch working; verify at 375 / 768 / 1440 px (see Phase 5 for tooling); update `AGENTS.md` + `agent-learnt/` when architecture changes.

### Phase 0 — Safe cleanup (no visible change) · small

Goal: shrink the surface area and fix boot-time hazards before restyling.

- [ ] Delete `css/themes.css` (unreferenced). Delete the unused `:root` token block (`tokens.css:2-26`) after grepping `styles.css` for each variable (grep already shows none are used).
- [ ] Route **all** storage through `storageService`; make every read guarded; remove module-top-level `localStorage` reads in `groups.js`, `pagination.js`, `themes.js` (read lazily inside `init*`). Keep the inline pre-paint script but wrap it in try/catch (it is) and align key names.
- [ ] Fix HTML injection: build filter checkboxes/badges with `textContent`/`createElement` (or an `escapeHtml` helper), stop using attribute selectors with raw values (keep a `Map` of inputs instead).
- [ ] Fix the stale docs: remove the Netlify Identity sections from `agent-learnt/environment-and-architecture.md`; delete (or move to `docs/archive/`) `docs/netlify-identity-auth-setup.md`; move the finished root `plan.md` (storage migration, mostly ✅) to `docs/archive/storage-migration-plan.md` and fix links.
- [ ] Add `@media (prefers-reduced-motion: reduce)` that disables transforms/shimmer/smooth-scroll (this is permanent and survives the redesign).

**Done when:** site looks identical; app boots with `localStorage` throwing (test by stubbing in devtools / Playwright `addInitScript`); no unreferenced CSS/JS/assets remain except those removed in Phase 1.

### Phase 1 — One look: remove themes, ads, extra fonts · medium

Goal: the "gallery wall" look in §2, with the header reduced to essentials.

- [ ] **Tokens** (`css/tokens.css`): rewrite as one base block + `[data-wall="dark|gray|paper"]`. Define: wall/ink/muted/hairline/accent/focus colours, a 4-or-8-pt spacing scale, a type scale (`--text-xs … --text-xl`), one `--ease` + `--duration` pair. Check contrast ≥ 4.5:1 for body, 3:1 for large text and UI borders on **all three** walls (gray is the risky one).
- [ ] **Remove** from `styles.css`: every `[data-theme=…]` rule (21 lines reference it), the `[data-bg]` overrides at the bottom, `.theme-selector`, `.theme-controls`, all `.fake-ad*`, `.ads-toggle`, `.switch*`, glass/clay/synthwave header styles, hover `scale`, shadows, radii (set `--radius: 0`; delete the var if nothing needs it).
- [ ] **Remove** `js/modules/ads.js`, the parallax block in `js/main.js:65-86`, `assets/ads/`, the `<aside class="fake-ad…">` markup and the `#ads-toggle` label, `initAdsToggle`. (Open decision D1 — default: remove.)
- [ ] **Replace** `themes.js` with `wall.js` (`initWall()`, `applyWall()`), one header control (icon + 3 swatches), `aria-pressed`/`role="radiogroup"` semantics, keyboard accessible. Old-key migration per §2.2. Update the `<head>` pre-paint script accordingly.
- [ ] **Fonts:** one family (+ optional mono). Prefer self-hosting a variable WOFF2 in `assets/fonts/` with `font-display: swap` and a `<link rel="preload">`; if staying on Google Fonts, request a single family with only the needed weights. Remove the other five.
- [ ] **Header:** brand (home link) · text nav (`Work`, `Collections`, optional `About`) · search icon · wall control. Sticky only if it doesn't cost viewport height on mobile (consider hide-on-scroll-down).
- [ ] **Copy:** one `copy.js` (or constants) for empty/error states in a neutral, mature voice ("Nothing matches those filters.", "This image couldn't be loaded. Retry"). Remove the pencil/coffee jokes (D2).
- [ ] `theme-color` meta follows the wall.

**Done when:** `grep -r "data-theme\|fake-ad\|ads-toggle" .` returns nothing outside archived docs; first paint shows no flash of another wall; Lighthouse a11y ≥ 95 on both `/` and `/art/<id>`; page weight drops by the fonts + 1.7 MB ads.

### Phase 2 — The viewer ("viewing room") · large — highest value

Goal: the drawing gets the screen; chrome appears only when needed. Rewrite `lightbox.js` into `js/modules/viewer.js` (+ `viewer-zoom.js`), keep the exported API (`initLightbox`, `setArtworkIndex`, `openArtworkFromUrl`) or adapt `main.js` accordingly.

- [ ] **Structure:** native `<dialog>` (opened with `showModal()`) → free focus trap, `inert` background, Escape, top-layer. Full-bleed on the wall colour — no card frame, no radius, no scrim transparency. Image fitted with `object-fit: contain` and a modest margin ("mat"); safe-area insets on mobile.
- [ ] **Chrome:** top bar (close · position `12 / 143` · share · info · fullscreen · wall) and prev/next edge zones. **Auto-hide** after ~2.5 s of inactivity (pointer/touch/key wakes it), always visible when `prefers-reduced-motion` or when a control has focus. Caption strip at the bottom: *title — year*; "i" expands the full details panel (description, medium, collection, subject tags as links that navigate to filtered views).
- [ ] **Zoom/pan** with Pointer Events, no library: wheel / pinch / double-click-or-tap toggles fit ↔ 100% pixels centred on the pointer; drag to pan when zoomed; arrows/`+`/`-`/`0` keys; reset on navigate. Cap at the natural resolution of whichever file is loaded; swap to `imageUrl` (original) when zooming past `displayUrl`'s resolution.
- [ ] **Progressive load:** paint the already-cached thumbnail immediately (blurred/scaled), then swap to `displayUrl`/`imageUrl` on `decode()`; preload previous/next (`new Image().decode()`); abort stale loads when navigating fast (generation counter, as the current `onload` closures can race).
- [ ] **Navigation:** swipe left/right (Pointer Events, threshold + velocity), arrow keys, edge click zones; position persists in the URL via `replaceState` (already done). Keep `Escape` layering: exit zoom → close info → close viewer. Support `Home`/`End`.
- [ ] **Fullscreen:** call `requestFullscreen()` on the `<dialog>`/viewer root so chrome, caption and toasts are all inside — **delete** the DOM-reparenting code and the duplicate `#lightbox-fs-prev/next` buttons. Toast host stays the fullscreen element (already handled in `share.js`).
- [ ] **Focus:** return focus to the originating card/link on close; on direct visit to `/art/<id>` focus the dialog heading.
- [ ] **Video:** keep the YouTube `nocookie` iframe (muted autoplay is fine), same chrome, no zoom button; consider a poster + "play" facade so the iframe loads only on intent.
- [ ] **Errors:** neutral message + Retry (cache-busting retry already exists — keep behaviour).
- [ ] **Presentation mode (stretch):** `P` / button → auto-advance every N s with chrome hidden; Esc exits.
- [ ] Preserve: `document.title` updates, `popstate` open/close, `urlPushed` history logic, `getShareUrl`/`?v=` hash, native-share → clipboard → textarea fallback.

**Done when:** on a 1440×900 screen the displayed image occupies ≥ 92% of the available height (no frame); swipe + pinch work on a phone-emulated viewport; Tab never leaves the open dialog; closing returns focus; no `appendChild(sidebar)` code remains; navigating 20 items rapidly never shows a stale image (manual + Playwright).

### Phase 3 — Browsing & grouping redesign · large

Goal: replace modes/pagination/popover with navigation that lives in the URL. Introduce a tiny state + router layer (no framework).

- [ ] **`js/modules/router.js`**: parse/serialize `/`, `/collections`, `/collections/<slug>`, `/year/<yyyy>`, `/art/<id>`; `pushState` + `popstate`; query params for facets/search/sort (`?medium=pencil&subject=creature&q=…&order=chronological`) so any state is shareable and reload-safe. Keep the `/art/*` ↔ edge-function contract; `netlify.toml`'s `/* → /index.html` already serves the other paths (confirm `/collections/*` and `/year/*` are not shadowed). Viewer sequence = the list the visitor came from (its URL context), falling back to "all".
- [ ] **`js/modules/store.js`** (≈40 lines): `getState`, `setState`, `subscribe`; replaces the mutable module-scope variables spread over `gallery.js` / `groups.js` / `filters.js` / `pagination.js` and the `CustomEvent('artwork:open')` indirection. Views read from it; the router writes to it. Remove the live-binding `export let filteredArtwork` pattern.
- [ ] **Views** (`js/views/`): `work.js` (flat grid), `collections.js` (tiles), `collection.js`, `year.js` — each a function `render(state) → DOM`. Delete `groups.js`, `pagination.js`, the group-by toggle, breadcrumb, per-page selector markup.
- [ ] **Grid:** replace `column-count` masonry with **justified rows** (or CSS grid with per-item `aspect-ratio`) so reading order = sort order and nothing is cropped; reserve space from `width/height` (fallback in §3, item 1). Captions beneath (title, year; video marked with a small label instead of the folded "ribbon" + play badge). Cards are real `<a href="/art/<id>">` (intercepted for SPA navigation) with `loading="lazy"`, `decoding="async"`, and a quiet placeholder block (the colourful rainbow shimmer goes; a neutral pulse that respects reduced-motion).
- [ ] **No pagination:** render progressively (IntersectionObserver sentinel, ~48 items per batch) or render all with `content-visibility: auto`; 143 thumbs @600w is fine either way. Viewer next/prev must always be able to reveal the card (lazy-render up to that item).
- [ ] **Chronological mode:** year headings with a sticky year rail (replaces the timeline slider and "Group by Year"); year-only dates shown as `2010`, never `2010-01-01`. Within a year order by `addedDate`/id for determinism.
- [ ] **Collections page:** large tiles (cover + name + count); optional blurb on the collection page header; breadcrumb is just the URL (`Collections / Fantastical`).
- [ ] **Facets & search:** one slim "Filter" sheet — Collection, Medium, Subject — as text toggles with counts; active filters rendered as removable text chips (use `textContent`). Search expands from the header icon; debounced as today. Default landing has **no** controls visible besides the header.
- [ ] Remove `category` from UI and filters (keep in data); remove Title A–Z and "Added date" sort UI (keep an internal "latest" default).
- [ ] Optional `About` view (artist statement + contact). There is currently no page that says who Kay is (D3).

**Done when:** every view is reachable by URL, survives reload, and works with the back button; opening a piece from `/collections/fantastical` and pressing next stays inside that collection; closing the viewer lands on the right card at any scroll position; `groups.js`, `pagination.js`, `filters.js` timeline code are gone; no layout shift when thumbnails load (CLS ≈ 0 in Lighthouse).

### Phase 4 — Data contract improvements (needs the CLI) · medium

Only after §3 asks land (or earlier with the fallbacks, then switch to real fields):

- [ ] Frontend consumes `width/height`, `displayUrl`, `datePrecision`, `media[]`, collection metadata when present; fallbacks removed once all 143 items carry the fields (note in `agent-learnt/`).
- [ ] Update `netlify/edge-functions/share-preview.js` only if field names change; it must keep working for `/art/<id>`; consider using `displayUrl` for the OG image (still the 600w thumb unless a 1200×630 crop is generated) and the collection name in the description.
- [ ] Sharding decision (`plan.md` open item) is still not needed at 143 items; revisit at ~500.
- [ ] Update `AGENTS.md` data-contract paragraph to list the new fields.

### Phase 5 — Polish, accessibility, performance, verification · medium

- [ ] **Verification harness:** a small Playwright script (Chromium is pre-installed in the cloud env at `/opt/pw-browsers`; do **not** run `playwright install`) that loads `/`, `/collections`, `/collections/<slug>`, `/art/<id>` at 375, 768, 1440 px for each wall and saves screenshots to a scratch dir; plus assertions: no console errors, no horizontal scroll, no `localStorage`-throws crash, deep link opens viewer, back closes it. Keep it under `scripts/` or `tests/` as a dev-only file (D4).
- [ ] **A11y:** one `h1` per view, logical heading order (cards currently use `h3` with no `h2`), skip-to-content link, visible focus on every wall, `aria-current` on nav, landmarks, alt text from data, live-region announcements for filter counts, touch targets ≥ 44px.
- [ ] **Perf:** preconnect to `kaysartshow.fyi`; `fetchpriority="high"` on the first row; `Cache-Control` for `/css`, `/js` (short or fingerprinted via a `?v=` string bumped manually since there is no build); consider splitting `styles.css` (1638 lines → ~500 after Phase 1) into `base/layout/components/viewer` files if still > 700 lines.
- [ ] **PWA/meta:** update `site.webmanifest` `theme_color/background_color`; refresh OG/Twitter site description to match the new voice; keep `og:image` absolute.
- [ ] **Docs:** rewrite the "App Overview" in `AGENTS.md` (no themes/ads, new routes, new modules); add `agent-learnt/` notes on router/store, viewer pointer handling, and the wall system; archive this plan with ✅ marks.

---

## 5. Suggested module layout after the overhaul

```
index.html                 # shell: header, <main id="view">, <dialog id="viewer">
css/tokens.css             # base tokens + 3 wall blocks
css/base.css  layout.css  components.css  viewer.css
js/main.js                 # boot: wall → data → router → viewer
js/modules/store.js        # state + subscribe
js/modules/router.js       # URL <-> state
js/modules/wall.js         # wall switch + persistence
js/modules/storage.js      # (existing) guarded localStorage
js/modules/share.js        # (existing) share URLs / toast
js/modules/data.js         # fetch + normalize artwork (fallbacks for §3)
js/modules/copy.js         # neutral UI strings
js/modules/viewer.js  viewer-zoom.js
js/views/work.js  collections.js  collection.js  year.js  about.js
```

## 6. Risks & things not to break

- **Share links:** `/art/<id>?v=<hash>` and `netlify/edge-functions/share-preview.js` rewrite `<title>`, `description`, `og:*`, `twitter:*` by regex on `index.html` — keep those tags in `<head>` with the same attribute forms, keep root-absolute asset paths (`/css/…`).
- **Hash stability:** `getShareVersion` hashes `title|description|thumbnailUrl` — don't change its inputs or every shared preview refetches.
- **No build step / no new server code.** Resist adding a bundler or framework; ES modules + small files are enough at this size.
- **Don't re-add functions** (see `agent-learnt/`). Hotlink protection, if wanted, is a Cloudflare setting.
- **Phase boundaries:** Phase 1 can ship without Phase 2/3 (the old lightbox/grid will already look consistent on one wall). Don't start Phase 3 before Phase 0's storage fix — the router relies on a safe `storageService`.
- **Visual drift:** after Phase 1, any new component must use only tokens; add a grep check (no hex colours outside `tokens.css`).

## 7. Open decisions (defaults chosen so work isn't blocked)

| # | Question | Default if no answer |
|---|---|---|
| D1 | Are the fake ads a deliberate bit you want to keep somewhere (e.g. an easter egg)? | **Remove entirely** |
| D2 | Tone for UI copy: neutral/mature, or keep a little humour in error states? | Neutral everywhere |
| D3 | Add an About / artist statement page? | Add a minimal one in Phase 3 (text provided by Kay) |
| D4 | OK to add a dev-only Playwright script (no runtime dependency)? | Yes, under `scripts/`, not published logic |
| D5 | Look: quiet-brutalist grotesk (default) vs. warmer museum serif titles? | Grotesk; swapping fonts is a token change only |
| D6 | Keep "Latest additions" as the landing order, or lead with chronological/curated? | Latest additions, with a one-click Chronological toggle |
| D7 | Keep tags as visitor-facing "Subject" filters, or drop tag filtering and rely on Collections + Medium only? | Keep as Subject, hidden until the filter sheet is opened |

## 8. Effort & order summary

| Phase | Size | Depends on | User-visible win |
|---|---|---|---|
| 0 Cleanup | S | — | Robust boot, safer code, accurate docs |
| 1 One look | M | 0 | Themes/ads/dropdowns gone, calm header, one wall switch |
| 2 Viewer | L | 1 | Full-bleed viewing, real zoom/pan, swipe, no stale images |
| 3 Browse & grouping | L | 0, (1) | URL-based collections/years, no pagination, no layout shift |
| 4 Data contract | M | CLI work | Sharper images, correct year display, clean facets |
| 5 Polish | M | all | A11y/perf pass, docs, regression screenshots |
