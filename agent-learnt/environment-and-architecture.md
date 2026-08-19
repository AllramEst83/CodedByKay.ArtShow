# Environment & Architecture Notes

## App Structure & Serving Model
- **Publish Root:** Netlify is configured to publish `.` directly. Do not introduce complex build outputs (`dist/`) unless explicitly requested.
- **Image Protection:** Static HTTP access to `assets/drawngs/*` is denied in `netlify.toml`. Media must be fetched via `/.netlify/functions/image?file=...`.
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
- **Admin emails env var:** `ADMIN_EMAILS=kaywib@gmail.com` must be set in Netlify dashboard → Environment Variables. Used as server-side admin gate in `admin-users.js`.
