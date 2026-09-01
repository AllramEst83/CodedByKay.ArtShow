// Gatekeeper for raw artwork files (assets/drawings/**). Runs at the Netlify
// edge in front of static asset serving — it never touches the file bytes
// itself, it only decides whether the request may proceed. On a pass,
// context.next() hands off to Netlify's normal static/CDN pipeline, so
// images and video get full edge caching and native HTTP Range support
// with no size limits and no custom streaming code.
//
// Mirrors the origin/referer allowlist that used to live in
// netlify/functions/image.js: same ALLOWED_ORIGINS env var, same
// fail-open-when-no-list-configured and fail-open-when-no-origin-header
// behavior (this is a hotlink/scrape deterrent, not hard DRM — Origin and
// Referer are client-supplied and can be spoofed by a determined caller).

function parseAllowedOrigins() {
  return (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((url) => url.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedOrigin(requestOrigin, allowedOrigins) {
  if (allowedOrigins.length === 0 || !requestOrigin) return true;
  return allowedOrigins.some((allowed) => {
    try {
      const allowedHost = new URL(allowed).host;
      const reqHost = new URL(requestOrigin).host;
      return reqHost === allowedHost || requestOrigin.toLowerCase().startsWith(allowed);
    } catch {
      return requestOrigin.toLowerCase().includes(allowed);
    }
  });
}

export default async (request, context) => {
  const requestOrigin = request.headers.get('origin') || request.headers.get('referer') || '';
  const allowedOrigins = parseAllowedOrigins();

  if (!isAllowedOrigin(requestOrigin, allowedOrigins)) {
    return new Response(
      JSON.stringify({ error: 'Access denied: request origin is not in the ALLOWED_ORIGINS whitelist' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return context.next();
};

export const config = { path: '/assets/drawings/*' };
