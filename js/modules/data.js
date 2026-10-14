// Normalises data/artwork.json for the browsing UI and holds the pure
// filter / sort helpers.
//
// Everything derived here has a front-end fallback by design (see
// docs/gallery-overhaul-plan.md §3): when the CLI/MCP start publishing a real
// `media[]`, `datePrecision`, collection slugs, etc., the fields below are
// used as-is and the derivation is skipped.

// Display names for the normalised medium vocabulary, in facet order.
export const MEDIA_LABELS = {
  pencil: 'Pencil',
  watercolor: 'Watercolor',
  ink: 'Ink',
  marker: 'Marker',
  digital: 'Digital',
  photography: 'Photography',
};

const MEDIA_PATTERNS = [
  ['pencil', /pencil/i],
  ['watercolor', /water\s?colou?r/i],
  ['ink', /\bink\b|fine\s?liner/i],
  ['marker', /marker/i],
  ['digital', /digital/i],
  ['photography', /photo/i],
];

// Tags that are not visitor-facing subjects: the medium words (they live in
// the Medium facet) and filler that nearly every piece carries.
const NON_SUBJECT_TAGS = new Set([...Object.keys(MEDIA_LABELS), 'sketch']);

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function deriveMedia(item) {
  if (Array.isArray(item.media)) return item.media;
  const text = `${item.medium || ''} ${(item.tags || []).join(' ')}`;
  return MEDIA_PATTERNS.filter(([, re]) => re.test(text)).map(([key]) => key);
}

function deriveYear(item) {
  const year = new Date(item.createdDate).getUTCFullYear();
  return Number.isNaN(year) ? null : year;
}

function isYearOnly(item) {
  if (item.datePrecision) return item.datePrecision === 'year';
  // 127 of 143 pieces carry YYYY-01-01: the real precision is the year.
  return /-01-01$/.test(item.createdDate || '');
}

export function normalizeArtwork(raw) {
  return raw.map((item, index) => {
    const names = Array.isArray(item.groups) ? item.groups : [];
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return {
      ...item,
      tags,
      id: String(item.id),
      index, // position in artwork.json = order added; deterministic tiebreaker
      year: deriveYear(item),
      yearOnly: isYearOnly(item),
      media: deriveMedia(item),
      subjects: tags.filter((t) => !NON_SUBJECT_TAGS.has(t)),
      collections: names.map((name) => ({ name, slug: slugify(name) })),
      isVideo: item.type === 'video',
    };
  });
}

export function displayDate(item) {
  if (!item.createdDate) return '';
  return item.yearOnly && item.year ? String(item.year) : formatDate(item.createdDate);
}

// ─── Collections / years ──────────────────────────────────────────────────────

function latestFirst(a, b) {
  return (new Date(b.addedDate) - new Date(a.addedDate)) || (b.index - a.index);
}

export function chronological(a, b) {
  return (
    ((a.year ?? Infinity) - (b.year ?? Infinity)) ||
    (new Date(a.createdDate) - new Date(b.createdDate)) ||
    (a.index - b.index)
  );
}

export function sortItems(items, order) {
  const copy = items.slice();
  copy.sort(order === 'chronological' ? chronological : latestFirst);
  return copy;
}

export function buildCollections(artwork) {
  const map = new Map();
  artwork.forEach((item) => {
    item.collections.forEach(({ name, slug }) => {
      if (!map.has(slug)) map.set(slug, { slug, name, items: [] });
      map.get(slug).items.push(item);
    });
  });
  return [...map.values()]
    .map((c) => ({
      ...c,
      count: c.items.length,
      // Fallback cover: the most recent piece that is an image.
      cover: c.items.slice().sort(latestFirst).find((i) => !i.isVideo) || c.items[0],
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function buildYears(artwork) {
  const years = new Map();
  artwork.forEach((item) => {
    if (item.year === null) return;
    years.set(item.year, (years.get(item.year) || 0) + 1);
  });
  return [...years.entries()].map(([year, count]) => ({ year, count })).sort((a, b) => b.year - a.year);
}

// ─── Facets ───────────────────────────────────────────────────────────────────

export const FACETS = [
  { key: 'collection', label: 'Collection', values: (i) => i.collections.map((c) => c.slug) },
  { key: 'medium', label: 'Medium', values: (i) => i.media },
  { key: 'subject', label: 'Subject', values: (i) => i.subjects },
];

function matchesQuery(item, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    (item.title || '').toLowerCase().includes(needle) ||
    (item.description || '').toLowerCase().includes(needle) ||
    item.tags.some((t) => t.toLowerCase().includes(needle))
  );
}

// `filters`: { q, collection: Set, medium: Set, subject: Set }.
// OR within a facet, AND across facets. `except` leaves one facet out, which
// is how per-value counts are computed.
export function applyFilters(items, filters, except = null) {
  return items.filter((item) => {
    if (!matchesQuery(item, filters.q)) return false;
    return FACETS.every((facet) => {
      if (facet.key === except) return true;
      const wanted = filters[facet.key];
      if (!wanted || wanted.size === 0) return true;
      return facet.values(item).some((v) => wanted.has(v));
    });
  });
}

export function facetCounts(items, filters, facetKey) {
  const facet = FACETS.find((f) => f.key === facetKey);
  const pool = applyFilters(items, filters, facetKey);
  const counts = new Map();
  pool.forEach((item) => {
    new Set(facet.values(item)).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  });
  return counts;
}
