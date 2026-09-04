# Storage Architecture Migration Plan

**Goal:** stop storing artwork files and metadata in the git repo. Move to a
model that scales to 20 years of art, costs $0–3/month, and fits a solo
.NET developer's workflow — no server to babysit, no database bill.

## Target architecture

```
┌─────────────────┐      publish       ┌──────────────────┐
│  SQLite catalog   │ ──────────────►  │  .NET CLI (Publisher) │
│  (on your machine, │                 │  - reads SQLite         │
│   source of truth) │ ◄────────────── │  - uploads new files    │
└─────────────────┘      add/edit      │  - generates thumbnails │
                                        │  - writes static JSON   │
                                        └─────────┬────────────┘
                                                   │
                        ┌──────────────────────────┼───────────────────────┐
                        ▼                          ▼                       ▼
                ┌───────────────┐         ┌─────────────────┐    ┌──────────────────┐
                │ Cloudflare R2  │         │ static JSON files │    │ Bunny Stream       │
                │ (images only)  │         │ committed to repo  │    │ (video, separate)   │
                └───────┬───────┘         └─────────┬───────┘    └─────────┬────────┘
                        │                            │                       │
                        └──────────────┬─────────────┴───────────┬──────────┘
                                        ▼                         ▼
                                  Netlify (static site) ── fetches JSON, renders
                                  <img src="R2 CDN url">   <video src="Bunny url">
```

**Key principle:** there is exactly one writer (you) and no deadline on writes.
So writes don't need to be "live" — they happen on your machine, and
publishing is a deliberate, reviewable step (a CLI run + a git commit), not a
running service. Nothing is hosted that isn't a static file, which is why
this stays free.

---

## Components

### 1. Cloudflare R2 — image files only

- One bucket (e.g. `codedbykay-artshow`), objects laid out the same way
  `assets/drawings/` is today: `originals/<year>/<slug>.webp`,
  `thumbs/<year>/<slug>-600w.webp`.
- Attach a custom subdomain (e.g. `cdn.art.codedbykay.se`) to the bucket —
  Cloudflare's edge network then *is* the CDN, no separate image-CDN product
  needed, and it replaces what Netlify Image CDN does today.
- Thumbnails are generated **once, at publish time**, not on every request —
  see CLI below. This removes the `/.netlify/images?url=...&w=600&q=75`
  proxy entirely and the URL is stored as a plain static path.
- Free up to 10 GB storage, **zero egress fees ever** (this is the feature
  that matters most for a public gallery).
- **Video does not go here** — see §3.

### 2. SQLite catalog — the source of truth

- One file, e.g. `catalog/artwork.db`, alongside the .NET tooling. Not
  hosted anywhere — it lives on your machine, backed up like any other file
  (copy it into the private half of the repo, or to R2 itself as a backup
  object, or both).
- Schema mirrors the current `artwork.json` shape 1:1, so the import step is
  a straight mapping with no data loss:

  ```sql
  CREATE TABLE Artwork (
    Id            TEXT PRIMARY KEY,   -- 'art-001'
    AddedDate     TEXT NOT NULL,
    Title         TEXT NOT NULL,
    Description   TEXT,
    CreatedDate   TEXT,
    Category      TEXT,
    Medium        TEXT,
    Type          TEXT,               -- null for images, 'video' for video items
    OriginalPath  TEXT NOT NULL,      -- local file path at import time
    R2Key         TEXT,               -- originals/2026/foo.webp (images only)
    ThumbR2Key    TEXT,               -- thumbs/2026/foo-600w.webp (images only)
    VideoProvider TEXT,               -- 'bunny' | null
    VideoId       TEXT,               -- provider's video/asset id
    VideoThumbUrl TEXT
  );

  CREATE TABLE ArtworkTags   (ArtworkId TEXT, Tag TEXT);
  CREATE TABLE ArtworkGroups (ArtworkId TEXT, GroupName TEXT);
  ```

- Access via EF Core + `Microsoft.EntityFrameworkCore.Sqlite` — real
  migrations, real LINQ queries, no hosting cost because nothing is running.
- Why SQLite and not a hosted DB: at ~660 bytes/record, 1,500 artworks is
  ~1 MB. A hosted database (Supabase/Neon/Cosmos free tiers) solves a
  concurrency and availability problem you don't have — one writer, no
  uptime requirement. SQLite is strictly simpler and costs nothing, forever.

### 3. Video — not object storage, not R2

Raw MP4 in a bucket has no adaptive bitrate and stalls on a bad connection;
R2 (or any block-storage product) is the wrong tool for playback, not just
the wrong price. Options, cheapest/simplest first:

| Option | Cost | Tradeoff |
|---|---|---|
| **Bunny Stream** (recommended) | ~$1/mo + $0.005–0.01/GB storage & delivery | Adaptive bitrate, proper player, your own domain, trivial API |
| Cloudflare Stream | $5 / 1,000 min stored | More than you need at 2 videos, fine if the library grows a lot |
| Unlisted YouTube embed | $0 | Free forever, but YouTube branding/UI on your art site |

Store `VideoProvider` + `VideoId` in SQLite; the publisher writes the
provider's playback URL into the static JSON, same as `imageUrl` today.

### 4. .NET CLI publisher

A single console project, e.g. `tools/ArtShow.Publisher/`, run manually
from your machine when you add or edit artwork.

**Commands:**

| Command | What it does |
|---|---|
| `import` | One-time: reads the existing `netlify/functions/data/artwork.json` + `assets/drawings/**`, populates SQLite, uploads existing images to R2. Run once, then retired. |
| `add --file <path> --title ... --category ...` | Generates a thumbnail (ImageSharp), uploads original + thumbnail to R2, inserts a SQLite row. |
| `edit <id> --title ...` | Updates a SQLite row. No re-upload. |
| `publish` | Reads all SQLite rows, writes static JSON (see §5), does **not** touch R2 — publish is metadata-only and cheap to re-run. |

**Libraries:**
- `AWSSDK.S3` — R2 is S3-compatible, this just needs a custom endpoint URL.
- `SixLabors.ImageSharp` — thumbnail generation (resize to 600w, re-encode
  WebP), replaces what Netlify Image CDN did on-demand.
- `Microsoft.EntityFrameworkCore.Sqlite` — catalog access.

### 5. Static JSON output — what the Netlify site actually fetches

- `publish` writes to `netlify/functions/data/artwork.json` (same path,
  same shape the frontend already expects) — or, once past a few hundred
  items, shards it per year (`artwork-2026.json`, `artwork-2025.json`, …)
  to avoid shipping the whole catalog on every page load.
- `netlify/functions/image.js` can be **retired** once the frontend fetches
  the static JSON file directly instead of going through the function —
  one less moving part, and it removes the `Cache-Control: no-cache`
  problem on every visit noted during review.
- `thumbnailUrl` stops being a Netlify Image CDN query string and becomes a
  plain R2 CDN path, generated once at `add`/`publish` time instead of
  re-derived by Netlify on every request.

---

## Migration phases

### Phase 0 — Get media out of git history (do this first, independent of everything else)

1. Confirm nothing under `assets/drawings/` is referenced anywhere except
   `artwork.json` (it isn't, per current audit).
2. Once files are re-hosted (Phase 2), remove `assets/drawings/` from the
   working tree and run `git filter-repo` to strip it from history.
3. **This rewrites history and requires a force-push** — coordinate timing,
   make sure no one else has an unpushed clone, and keep a backup of the
   pre-filter repo until the new setup is verified end-to-end.
4. Expected result: `.git` drops from ~142 MB to low single-digit MB.

### Phase 1 — Stand up R2

1. Create the Cloudflare account + R2 bucket, attach the custom CDN
   subdomain.
2. Generate an S3-compatible API token scoped to that bucket only.

### Phase 2 — Build the SQLite catalog + import

1. Scaffold `tools/ArtShow.Publisher/` with the EF Core model above.
2. Run `import`: parses the current `artwork.json`, uploads each file in
   `assets/drawings/**` to R2 (originals + freshly generated thumbnails),
   populates SQLite with R2 keys.
3. Spot-check a handful of records against the live site before trusting
   the import.

### Phase 3 — Video migration

1. Create the Bunny Stream library, upload the two existing videos
   (`elephant_man_v1_video_2.mp4`, `elephant_man_v2_video.mp4`).
2. Update the corresponding SQLite rows with `VideoProvider`/`VideoId`.
3. Confirm playback + range-request seeking works from the Netlify site.

### Phase 4 — Cut the site over

1. Run `publish`, commit the generated JSON, verify the gallery renders
   identically against R2/Bunny URLs.
2. Update `js/main.js` to fetch the static JSON file directly (drop the
   `/.netlify/functions/image` call).
3. Retire `netlify/functions/image.js`.
4. Update `netlify/edge-functions/media-gate.js` — it currently gates
   `/assets/drawings/*` and `/.netlify/images/*`, neither of which exist
   after this migration. Either retire it, or repoint it at whatever gets
   added back for hotlink protection on the new CDN domain (R2 custom
   domains support Cloudflare's own hotlink rules, which can replace this
   edge function outright).
5. Update `netlify.toml` — drop the `included_files` bundling for
   `netlify/functions/data/**` and the `/assets/drawings/*` cache headers
   (no longer relevant).

### Phase 5 — Execute Phase 0 (git history cleanup)

Do this last, once the new pipeline has been live and verified for a
period you're comfortable with — it's the one irreversible step, so it
goes after everything else is proven, not before.

---

## Cost summary

| Item | Free tier | Cost past free tier |
|---|---|---|
| R2 storage | 10 GB | $0.015/GB-month |
| R2 egress | unlimited | $0, always |
| Bunny Stream | none | ~$1/mo + ~$0.01/GB |
| SQLite | n/a — runs locally | $0 |
| Netlify static hosting | current plan, unchanged | unchanged |

**Expected total: $0/month now, ~$1–3/month once past ~10 GB of images and
a modest amount of video.**

## Open decisions before starting

- [ ] Confirm Bunny Stream vs. YouTube-unlisted for video (cost vs. branding).
- [ ] Decide JSON sharding threshold (single file is fine well past current
      53 items; shard by year once it's a genuinely large payload).
- [ ] Decide where the SQLite file itself gets backed up (private repo
      folder, R2 object, or both).
