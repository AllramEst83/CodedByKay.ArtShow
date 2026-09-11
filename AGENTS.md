# CodedByKay.ArtShow — Agent Guide

## App Overview
- **Type:** Vanilla HTML, CSS, and JS art portfolio website.
- **Hosting & Backend:** Deployed on Netlify as pure static hosting — no Netlify Functions or Edge Functions remain (both were retired 2026-09-11 once media moved fully off Netlify; see below).
- **Data & Media Handling:**
  - Artwork metadata lives in `data/artwork.json`, committed to this repo and written by the sibling `CodedByKay.ArtShow.CLI` tool's `Publish` command (see `ArtShow.Workspace/AGENTS.md`). The frontend (`js/main.js`) fetches it directly as a static file — `netlify.toml`'s `publish = "."` already exposes it at that path, no serverless function involved. (It used to live under `netlify/functions/data/` from when a function read it off disk; moved to `data/` 2026-09-11 once that function was retired, so the path wouldn't keep implying one exists.)
  - Images are hosted on **Cloudflare R2** via the custom domain `https://kaysartshow.fyi` — `imageUrl`/`thumbnailUrl` in `artwork.json` are already-absolute URLs pointing there (never the bucket's `r2.dev` URL). This repo stores no raw image files; `assets/drawings/` was removed once every item was confirmed live on R2.
  - Video is hosted on **YouTube** (uploaded manually via YouTube Studio, not through this repo or the CLI's API). `artwork.json`'s `videoUrl` is a bare `https://www.youtube-nocookie.com/embed/<id>` URL; the lightbox (`js/modules/lightbox.js`) embeds it in an `<iframe>` with playback params appended at open time, instead of a raw `<video>` element. `thumbnailUrl` for video items is YouTube's own auto-generated thumbnail (`img.youtube.com/vi/<id>/hqdefault.jpg`).
  - No origin/hotlink gating remains on the app-code side (the old `media-gate.js` Edge Function and `/.netlify/functions/image` Lambda are both deleted) — if hotlink protection is ever wanted for the R2-hosted images, it's a Cloudflare dashboard setting on the custom domain, not app code.
- **Routing & Deployment:** Single Page Application (SPA) using root fallback (`/*` -> `/index.html`). The root folder `.` is published directly with no build step (`npm run dev` starts `netlify dev`).

## Agent Learnings (`agent-learnt/`)
The `agent-learnt/` directory is reserved for recording technical insights, environment quirks, and architectural decisions discovered across development sessions. 

Future AI agents working on this project should check `agent-learnt/` before starting tasks and add new notes as new lessons or edge cases are encountered.

## Agent Rules
Additional agent rules and project guidelines can be found in [.cursor/rules](./CodedByKay.ArtShow/.agents/rules).