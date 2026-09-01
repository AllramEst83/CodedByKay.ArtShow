# Environment & Architecture Notes

## App Structure & Serving Model
- **Publish Root:** Netlify is configured to publish `.` directly. Do not introduce complex build outputs (`dist/`) unless explicitly requested.
- **Media Serving (migrated off function proxying):** Images and video in `assets/drawings/**` are served as plain static assets directly from the Netlify CDN — do not add `assets/drawings/**` back to `[functions].included_files` or re-introduce a byte-proxying function. `artwork.json`'s `imageUrl`/`thumbnailUrl`/`videoUrl` fields are plain paths like `/assets/drawings/2026/elephant_man_v1_video.mp4`, not `/.netlify/functions/...?file=...` query strings.
  - **Why:** the old `image.js` read+base64-encoded every image through a regional Lambda (≈33% size overhead, ~6MB sync response ceiling, single-region latency). Video was worse — a hand-rolled `video-stream.mjs` had to manually parse `Range` headers and clamp every response to 8MB because Netlify streaming function responses cap at 20MB. Static CDN serving has none of these limits and supports native HTTP Range requests for video with zero custom code.
  - **Access gate:** `netlify/edge-functions/media-gate.js` runs in front of `/assets/drawings/*`, checks Origin/Referer against `ALLOWED_ORIGINS`, and calls `context.next()` to let Netlify's normal static pipeline serve the file (or returns 403). It never touches file bytes itself — that's what preserves full CDN caching and Range support. `netlify/functions/image.js` now serves *only* the artwork metadata JSON.
  - **If protection needs to be stronger later:** Origin/Referer are client-spoofable; a real upgrade would be signed, expiring tokens minted by a function and checked in the edge function, not a switch back to byte-proxying.
- **Editor Isolation:** Any local dev tools or draft editors must be completely isolated or omitted from production deployment if not meant to be public.

## Netlify Identity Integration
- **Widget:** The browser UI uses `netlify-identity-widget` loaded from CDN (`https://identity.netlify.com/v1/netlify-identity-widget.js`). It exposes `window.netlifyIdentity`. No npm install needed for the frontend.
- **Auth module:** `js/modules/auth.js` is imported by both `js/main.js` (gallery page) and `js/admin.js` (admin page). It renders sign-in button or initials avatar into `#auth-control` in the header.
- **Admin page:** `admin.html` at `/admin` (clean URL via `netlify.toml` redirect). Guarded client-side by `js/admin.js` + server-side by `netlify/functions/admin-users.js`.
- **Serverless function:** `netlify/functions/admin-users.js` uses `context.clientContext.identity.url` and `context.clientContext.identity.token` for GoTrue admin API calls. **Never expose `identity.token` to the browser.**
- **JWT refresh:** Always call `user.jwt()` (not a cached string) before any authenticated fetch — it auto-refreshes when near expiry (1-hour TTL).
- **Role updates:** After changing roles via the admin API, the affected user must re-login or call `netlifyIdentity.refresh()` for the new JWT to reflect the change.
- **`identity-signup` trigger** (`netlify/functions/identity-signup.js`): Netlify calls this automatically on new user signup. Cannot be tested locally with `netlify dev` — must deploy to live site.
- **Registration mode:** Set to **Invite only** in the Netlify dashboard (Identity → Registration). Open registration is disabled.
- **Admin authorization:** Pure RBAC using `app_metadata.roles` including `'admin'` checked server-side in `admin-users.js`.
- **Full Auth Setup Guide:** See [docs/netlify-identity-auth-setup.md](../docs/netlify-identity-auth-setup.md) for complete end-to-end setup instructions.
