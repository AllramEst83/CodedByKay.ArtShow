To Do:
- [x] On mobile (Claymorphism theme): The title "Kay's ArtShow" disappears over images with a white background because the header is glass. Consider giving the header a slight tint.
  - **Done:** Added tinted background `rgba(240, 230, 255, 0.92)` with `backdrop-filter: blur(16px)` for Claymorphism header, ensuring high contrast legibility over white artwork images.
- [x] On mobile: When a user taps an image, the metadata is not displayed properly due to insufficient vertical space. We should rethink how we present the metadata. One idea is to display an "i" icon that reveals the metadata within the lightbox when tapped.
  - **Done:** Added an Info ("i") toggle button in the lightbox controls. On mobile screens, metadata smoothly slides up in a scrollable bottom sheet drawer when tapped.
- [x] The theme selector is to big at tims for the mobile space. I dont know how we should solve that gracefully
  - **Done:** Enforced `white-space: nowrap` and `clamp(1.2rem, 5vw, 1.75rem)` font scaling on title, and added responsive compact selector sizing (`max-width: 125px`) for small mobile viewports.
- [x] Add a whitelist for the function call that reads from a .env file.
  - **Done:** Enforced an explicit `ALLOWED_FILES` whitelist in `netlify/functions/image.js` and blocked hidden files (`.env`, `.git`) with HTTP 403.

- Things to consider:
  - **Are images being served to the browser before the call to the `/image` function?**
    - Yes. In `netlify.toml`, `publish = "."` causes Netlify's static CDN to serve everything under `/assets/drawngs/` statically. However, `artwork.js` was configured to fetch images via `/.netlify/functions/image?file=...`, invoking a serverless Lambda function for each image load.
  - **Is there a better way to serve images than storing them on the server?**
    - **Option A (Static CDN):** Reference `/assets/drawngs/file.jpg` directly in `artwork.js` so Netlify CDN edge nodes serve images directly with zero Lambda execution cost and fast byte-range caching.
    - **Option B (Image CDN / Cloud Storage):** Upload images to Cloudinary, ImageKit, or AWS S3 + CloudFront to get dynamic WebP/AVIF format optimization, responsive thumbnail generation, and repository storage reduction.