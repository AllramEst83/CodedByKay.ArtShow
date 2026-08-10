# Environment & Architecture Notes

## App Structure & Serving Model
- **Publish Root:** Netlify is configured to publish `.` directly. Do not introduce complex build outputs (`dist/`) unless explicitly requested.
- **Image Protection:** Static HTTP access to `assets/drawngs/*` is denied in `netlify.toml`. Media must be fetched via `/.netlify/functions/image?file=...`.
- **Editor Isolation:** Any local dev tools or draft editors must be completely isolated or omitted from production deployment if not meant to be public.
