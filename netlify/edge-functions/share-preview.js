// Per-artwork link previews for /art/<id>.
//
// The site is a SPA: every URL serves the same index.html, whose Open Graph
// tags describe the whole site. Link-preview crawlers (WhatsApp, Discord,
// iMessage, Facebook...) don't run JavaScript, so a shared artwork link would
// always preview as the generic site card. This function serves the normal
// SPA shell for /art/<id> but with that artwork's title, description and
// thumbnail written into the head. The browser then opens the viewer from the
// URL as usual (see js/modules/lightbox.js).
//
// It only reads the static data/artwork.json — same contract as the site.

const SITE_NAME = "Kay's ArtShow";
const MAX_DESCRIPTION = 200;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function setMeta(html, attr, key, value) {
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(value)}">`;
  const existing = new RegExp(`<meta\\s+${attr}="${key}"[^>]*>`, 'i');
  if (existing.test(html)) return html.replace(existing, () => tag);
  return html.replace('</head>', () => `  ${tag}\n</head>`);
}

function removeMeta(html, attr, key) {
  return html.replace(new RegExp(`\\s*<meta\\s+${attr}="${key}"[^>]*>`, 'i'), '');
}

function describe(item) {
  const text = String(item.description ?? '').trim();
  if (!text) {
    return [item.category, item.medium].filter(Boolean).join(' · ') || `Artwork from ${SITE_NAME}`;
  }
  return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : text;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/art\/([^/]+)\/?$/);
  if (!match) return context.next();

  try {
    const id = decodeURIComponent(match[1]);
    const [shellResponse, dataResponse] = await Promise.all([
      fetch(new URL('/index.html', url)),
      fetch(new URL('/data/artwork.json', url)),
    ]);
    if (!shellResponse.ok || !dataResponse.ok) return context.next();

    const artwork = await dataResponse.json();
    const item = artwork.find((entry) => String(entry.id) === id);
    if (!item) return context.next();

    const title = `${item.title} — ${SITE_NAME}`;
    const description = describe(item);
    // Thumbnail (600w) rather than the multi-MB original: WhatsApp and others
    // skip or crop heavy preview images.
    const image = item.thumbnailUrl || item.imageUrl;

    let html = await shellResponse.text();
    html = html.replace(/<title>[^<]*<\/title>/i, () => `<title>${escapeHtml(title)}</title>`);
    html = setMeta(html, 'name', 'description', description);
    html = setMeta(html, 'property', 'og:title', title);
    html = setMeta(html, 'property', 'og:description', description);
    html = setMeta(html, 'property', 'og:url', `${url.origin}${url.pathname}${url.search}`);
    html = setMeta(html, 'property', 'og:image', image);
    html = setMeta(html, 'property', 'og:image:alt', item.title);
    // The site card's 512x512 dimensions don't apply to this image.
    html = removeMeta(html, 'property', 'og:image:width');
    html = removeMeta(html, 'property', 'og:image:height');
    html = setMeta(html, 'name', 'twitter:title', title);
    html = setMeta(html, 'name', 'twitter:description', description);
    html = setMeta(html, 'name', 'twitter:image', image);
    html = setMeta(html, 'name', 'twitter:image:alt', item.title);

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  } catch {
    return context.next();
  }
};

export const config = { path: '/art/*' };
