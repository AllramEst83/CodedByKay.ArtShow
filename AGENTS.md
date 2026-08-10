# CodedByKay.ArtShow — Agent Guide

## App Overview
- **Type:** Vanilla HTML, CSS, and JS art portfolio website.
- **Hosting & Backend:** Deployed on Netlify using Netlify Serverless Functions (`netlify/functions/`).
- **Data & Media Handling:**
  - Artwork metadata is stored in `netlify/functions/data/artwork.json`.
  - Raw artwork files are stored in `assets/drawngs/`.
  - Direct static access to `assets/drawngs/*` is blocked via `netlify.toml`. Images and metadata are served dynamically through the `/.netlify/functions/image` serverless endpoint.
- **Routing & Deployment:** Single Page Application (SPA) using root fallback (`/*` -> `/index.html`). The root folder `.` is published directly with no build step (`npm run dev` starts `netlify dev`).

## Agent Learnings (`agent-learnt/`)
The `agent-learnt/` directory is reserved for recording technical insights, environment quirks, and architectural decisions discovered across development sessions. 

Future AI agents working on this project should check `agent-learnt/` before starting tasks and add new notes as new lessons or edge cases are encountered.

## Agent Rules
Additional agent rules and project guidelines can be found in [.cursor/rules](./CodedByKay.ArtShow/.cursor/rules).