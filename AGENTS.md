# CodedByKay.ArtShow — Agent Guide

## App Overview
- **Type:** Vanilla HTML, CSS, and JS art portfolio website.
- **Hosting & Backend:** Deployed on Netlify using Netlify Serverless Functions (`netlify/functions/`) for metadata and a Netlify Edge Function (`netlify/edge-functions/`) for access control.
- **Data & Media Handling:**
  - Artwork metadata is stored in `netlify/functions/data/artwork.json` and served via the `/.netlify/functions/image` serverless endpoint (metadata only — it does not serve file bytes).
  - Raw artwork files (images and video) are stored in `assets/drawings/` and served as plain static assets straight from the Netlify CDN — full edge caching, native HTTP Range support for video, no size limits, no custom streaming code. `artwork.json`'s `imageUrl`/`videoUrl` fields point directly at these static paths (e.g. `/assets/drawings/2026/elephant_man_v1_video.mp4`).
  - Gallery/pagination/groups `thumbnailUrl` fields are instead routed through **Netlify Image CDN** (`/.netlify/images?url=<path>&w=600&q=75`) — a width-only resize (no forced crop) that shrinks the download for grid cards without touching the full-quality image used in the lightbox. Format is auto-negotiated (AVIF/WebP) by Netlify based on the request's `Accept` header.
  - Both `assets/drawings/*` and `/.netlify/images/*` are gated by `netlify/edge-functions/media-gate.js`, an Edge Function that checks the request's Origin/Referer against the `ALLOWED_ORIGINS` env var and either passes through to static/Image CDN serving (`context.next()`) or returns 403. It's a hotlink/scrape deterrent (Origin/Referer are client-supplied and spoofable, and absent entirely on a direct URL visit), not hard DRM — same trust model the old function-based check used. If real access control is ever needed, it would require signed/expiring tokens instead.
- **Routing & Deployment:** Single Page Application (SPA) using root fallback (`/*` -> `/index.html`). The root folder `.` is published directly with no build step (`npm run dev` starts `netlify dev`).

## Agent Learnings (`agent-learnt/`)
The `agent-learnt/` directory is reserved for recording technical insights, environment quirks, and architectural decisions discovered across development sessions. 

Future AI agents working on this project should check `agent-learnt/` before starting tasks and add new notes as new lessons or edge cases are encountered.

## Agent Rules
Additional agent rules and project guidelines can be found in [.cursor/rules](./CodedByKay.ArtShow/.agents/rules).