# CodedByKay.ArtShow — Agent Guide

## App Overview
- **Type:** Vanilla HTML, CSS, and JS art portfolio website.
- **Hosting & Backend:** Deployed on Netlify using Netlify Serverless Functions (`netlify/functions/`).
- **Data & Media Handling:**
  - Artwork metadata is stored in `netlify/functions/data/artwork.json` and served via the `/.netlify/functions/image` serverless endpoint (metadata only — it no longer serves file bytes).
  - Raw artwork files (images and video) are stored in `assets/drawings/` and served as plain static assets straight from the Netlify CDN — full edge caching, native HTTP Range support for video, no size limits, no custom streaming code.
  - Access to `assets/drawings/*` is gated by `netlify/edge-functions/media-gate.js`, an Edge Function that checks the request's Origin/Referer against the `ALLOWED_ORIGINS` env var and either passes through to static serving (`context.next()`) or returns 403. It's a hotlink/scrape deterrent (Origin/Referer are client-supplied and spoofable), not hard DRM — same trust model the old function-based check used.
- **Routing & Deployment:** Single Page Application (SPA) using root fallback (`/*` -> `/index.html`). The root folder `.` is published directly with no build step (`npm run dev` starts `netlify dev`).

## Agent Learnings (`agent-learnt/`)
The `agent-learnt/` directory is reserved for recording technical insights, environment quirks, and architectural decisions discovered across development sessions. 

Future AI agents working on this project should check `agent-learnt/` before starting tasks and add new notes as new lessons or edge cases are encountered.

## Agent Rules
Additional agent rules and project guidelines can be found in [.cursor/rules](./CodedByKay.ArtShow/.cursor/rules).