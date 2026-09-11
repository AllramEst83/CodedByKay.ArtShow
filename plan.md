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
                │ Cloudflare R2  │         │ static JSON files │    │ YouTube            │
                │ (images only)  │         │ committed to repo  │    │ (video, Kay uploads │
                └───────┬───────┘         └─────────┬───────┘    │  manually)          │
                        │                            │            └─────────┬────────┘
                        └──────────────┬─────────────┴───────────┬──────────┘
                                        ▼                         ▼
                                  Netlify (static site) ── fetches JSON, renders
                                  <img src="R2 CDN url">   <iframe src="youtube-nocookie.com/embed/id">
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
- Attach a custom subdomain (e.g. `kaysartshow.fyi`, what's actually in use) to the bucket —
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
    VideoId       TEXT                -- YouTube video id (video items only); thumbnail is derived from it, not stored
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

### 3. Video — YouTube, not object storage or a dedicated stream provider

Raw MP4 in a bucket has no adaptive bitrate and stalls on a bad connection;
R2 (or any block-storage product) is the wrong tool for playback, not just
the wrong price. Bunny Stream was the original plan here (adaptive bitrate,
your own domain, no on-site branding) but was **dropped 2026-09-11 before
ever being set up** — no Bunny account, no cost, and Kay decided YouTube's
$0 and zero-maintenance hosting was worth the tradeoff of YouTube's own
player chrome inside the embed:

| Option | Cost | Tradeoff |
|---|---|---|
| **YouTube (decided)** | $0 | Free forever, embedded inline via `youtube-nocookie.com/embed/<id>` (not a redirect to youtube.com) — some YouTube player chrome, but the visitor never leaves the site |
| Bunny Stream | ~$1/mo + $0.005–0.01/GB storage & delivery | Adaptive bitrate, proper player, your own domain — abandoned before setup |
| Cloudflare Stream | $5 / 1,000 min stored | More than needed at 2 videos |

Upload happens manually through YouTube Studio, not the YouTube Data API —
an OAuth upload flow (Google Cloud project, consent screen, ~6 uploads/day
default quota) was judged not worth it for something done rarely. The CLI
just stores the resulting `VideoId` in SQLite; `publish` derives both the
embed URL and the thumbnail from it alone:

```csharp
var videoUrl     = $"https://www.youtube-nocookie.com/embed/{artwork.VideoId}";
var thumbnailUrl = $"https://img.youtube.com/vi/{artwork.VideoId}/hqdefault.jpg"; // YouTube's own, no upload needed
```

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

- `publish` writes to `data/artwork.json` (same shape the frontend already
  expects; moved here from `netlify/functions/data/artwork.json` 2026-09-11
  once no function read it anymore) — or, once past a few hundred
  items, shards it per year (`artwork-2026.json`, `artwork-2025.json`, …)
  to avoid shipping the whole catalog on every page load.
- `netlify/functions/image.js` can be **retired** once the frontend fetches
  the static JSON file directly instead of going through the function —
  one less moving part, and it removes the `Cache-Control: no-cache`
  problem on every visit noted during review.
- `thumbnailUrl` stops being a Netlify Image CDN query string and becomes a
  plain R2 CDN path, generated once at `add`/`publish` time instead of
  re-derived by Netlify on every request.
- Today's `imageUrl` is a **relative path** (`/assets/drawings/2010/...`),
  because the file is same-origin, served by Netlify itself. Once files live
  on R2 — a different origin — every URL in the JSON has to become
  **absolute**.
- **Don't use the bucket's `r2.dev` URL.** It's explicitly dev/test-only:
  no Cloudflare caching, no CDN, and a variable rate limit that returns
  `429`s under real traffic. Use a **custom domain attached to the R2
  bucket** (`kaysartshow.fyi`, what's actually in use) — that's what
  actually gets you Cloudflare's edge caching, i.e. the CDN behavior this
  migration is counting on.
- **SQLite stores the bucket-relative key only** (`R2Key`,
  `ThumbR2Key` — e.g. `originals/2026/elephant-man-v1.webp`), never a full
  URL. `publish` derives the absolute URL by combining a config value with
  that key at generation time:

  ```csharp
  var imageUrl     = $"{options.R2PublicBaseUrl}/{artwork.R2Key}";
  var thumbnailUrl = $"{options.R2PublicBaseUrl}/{artwork.ThumbR2Key}";
  ```

  `R2PublicBaseUrl` (`https://kaysartshow.fyi`) lives in the publisher's
  config (env var / `appsettings.json`), not in the database. Video rows
  store just `VideoId` (a YouTube video id) — both the embed URL and the
  thumbnail are derived from it at publish time against YouTube's fixed,
  well-known domains, no config value needed for video the way `R2Key`
  needs `R2PublicBaseUrl`.

  **Why this matters:** if the CDN domain ever changes (provider switch, a
  staging environment, a new subdomain), it's a one-line config edit and a
  `publish` re-run — not a migration touching every one of 1,500 rows. The
  R2 key is the durable fact worth persisting; the URL is just one way of
  presenting it.

---

## Migration phases

### Phase 0 — Get media out of git history (working-tree part done 2026-09-11, history rewrite still deferred)

1. ✅ Confirmed nothing under `assets/drawings/` is referenced anywhere
   except `artwork.json`.
2. ✅ Files are re-hosted (Phase 2) and confirmed live — `assets/drawings/`
   removed from the working tree (the two not-yet-migrated videos staged
   at `ArtShow.Workspace/working-on/videos-to-upload/` first, see §3 Phase 3).
3. `git filter-repo` to strip it from history **not yet run** — still
   deliberately last (Phase 5 below).
4. **This rewrites history and requires a force-push** — coordinate timing,
   make sure no one else has an unpushed clone, and keep a backup of the
   pre-filter repo until the new setup is verified end-to-end.
5. Expected result: `.git` drops from ~142 MB to low single-digit MB.

### Phase 1 — Stand up R2 (done)

1. ✅ Cloudflare account + R2 bucket created, custom domain `kaysartshow.fyi`
   attached (**not** the bucket's `r2.dev` URL — that has no caching and
   is rate-limited by design).
2. ✅ S3-compatible API token generated, scoped to that bucket only.
3. ✅ `R2PublicBaseUrl` set to the custom domain in the publisher's config —
   every generated `imageUrl`/`thumbnailUrl` is built from this at publish
   time (see §5), never hardcoded per record.

### Phase 2 — Build the SQLite catalog + import (done, import code since removed)

1. Scaffolded `tools/ArtShow.Publisher/` (now `CodedByKay.ArtShow.CLI`)
   with the EF Core model above.
2. Ran `import`: parsed the then-current `artwork.json`, uploaded each file in
   `assets/drawings/**` to R2 (originals + freshly generated thumbnails),
   populates SQLite with R2 keys.
3. Spot-check a handful of records against the live site before trusting
   the import.

### Phase 3 — Video migration

1. Upload the two existing videos (`elephant_man_v1_video_2.mp4`,
   `elephant_man_v2_video.mp4` — staged at
   `ArtShow.Workspace/working-on/videos-to-upload/` after `assets/drawings/`
   was removed from the site repo) to YouTube via YouTube Studio, manually.
2. Add each as a catalog row via the CLI's Add artwork → Video (pastes the
   YouTube id into `VideoId`) — metadata for both is recorded in that
   staging folder's `README.md`.
3. Confirm the embed plays inline in the lightbox on the Netlify site.

### Phase 4 — Cut the site over (done 2026-09-11)

1. ✅ `publish` run, gallery confirmed rendering against real R2 URLs (all
   51 items' image/thumbnail URLs HEAD-checked 200 on `kaysartshow.fyi`).
2. ✅ `js/main.js` fetches the static JSON file directly (`/data/artwork.json`,
   served as a plain static asset — `netlify.toml`'s `publish = "."`
   already exposes it) instead of calling `/.netlify/functions/image`.
3. ✅ `netlify/functions/image.js` retired (deleted).
4. ✅ `netlify/edge-functions/media-gate.js` retired (deleted) — real
   hotlink protection, if wanted later, is a Cloudflare dashboard setting
   on the R2 custom domain, not app code.
5. ✅ `netlify.toml` updated — dropped the `included_files` bundling (no
   functions left) and the `/assets/drawings/*` cache headers; added a
   short-TTL cache header for the now-static JSON path instead.
6. ✅ The entire `netlify/` folder removed — `artwork.json` moved to plain
   `data/artwork.json` (its old `netlify/functions/data/` path implied a
   function was still involved; none is).

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
| YouTube video hosting | unlimited | $0, always |
| SQLite | n/a — runs locally | $0 |
| Netlify static hosting | current plan, unchanged | unchanged |

**Expected total: $0/month now, ~$1.50/month once past ~10 GB of images
(video is free on YouTube regardless of volume).**

## Open decisions

- [x] Bunny Stream vs. YouTube for video — **YouTube**, decided 2026-09-11
      (see §3).
- [ ] Decide JSON sharding threshold (single file is fine well past current
      51 items; shard by year once it's a genuinely large payload).
- [ ] Decide where the SQLite file itself gets backed up (private repo
      folder, R2 object, or both).
