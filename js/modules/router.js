// URL <-> view state. No framework: pushState + popstate + link interception.
//
//   /                          all work (latest first, ?order=chronological)
//   /collections               one tile per collection
//   /collections/<slug>        a collection's works
//   /year/<yyyy>               one year's works
//   /art/<id>                  the viewer over whichever list you came from
//
// Query params on list views: q, collection, medium, subject (comma lists),
// order. Every state is shareable and survives reload and the back button.
//
// The viewer owns /art/<id> history entries (it pushes them when a card is
// opened); this module only reacts to them on popstate / first load.

export const LIST_PARAMS = ['collection', 'medium', 'subject'];

let handlers = null;
let current = null; // last route that was rendered as a view (never 'art')
let renderedKey = null;

export function parseLocation(loc = window.location) {
  const path = loc.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(loc.search);

  const filters = { q: (params.get('q') || '').trim() };
  LIST_PARAMS.forEach((key) => {
    filters[key] = new Set((params.get(key) || '').split(',').filter(Boolean));
  });
  const order = params.get('order') === 'chronological' ? 'chronological' : 'latest';

  let m;
  if (path === '/') return { name: 'work', path, filters, order };
  if (path === '/collections') return { name: 'collections', path, filters, order };
  if ((m = path.match(/^\/collections\/([^/]+)$/))) {
    return { name: 'collection', path, slug: decodeURIComponent(m[1]), filters, order };
  }
  if ((m = path.match(/^\/year\/(\d{4})$/))) {
    return { name: 'year', path, year: Number(m[1]), filters, order };
  }
  if ((m = path.match(/^\/art\/([^/]+)$/))) {
    return { name: 'art', path, id: decodeURIComponent(m[1]), filters, order };
  }
  return { name: 'notfound', path, filters, order };
}

export function buildSearch({ filters, order }) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  LIST_PARAMS.forEach((key) => {
    if (filters[key] && filters[key].size) params.set(key, [...filters[key]].join(','));
  });
  if (order === 'chronological') params.set('order', 'chronological');
  const s = params.toString();
  return s ? `?${s}` : '';
}

function keyOf(route) {
  return route.path + buildSearch(route);
}

export function currentRoute() {
  return current;
}

function saveScroll() {
  try {
    window.history.replaceState({ ...(window.history.state || {}), scrollY: window.scrollY }, '');
  } catch { /* ignore */ }
}

function showRoute(route, { scroll = 'top' } = {}) {
  current = route;
  renderedKey = keyOf(route);
  handlers.render(route);
  if (scroll === 'top') window.scrollTo(0, 0);
  else if (typeof scroll === 'number') window.scrollTo(0, scroll);
}

// Reacts to whatever the location now is (first load and back/forward).
function sync({ initial = false } = {}) {
  const route = parseLocation();

  if (route.name === 'art') {
    // Underneath the viewer there must be a list: a direct visit gets "all work".
    if (!current) showRoute(parseLocation({ pathname: '/', search: '' }), { scroll: null });
    handlers.openArt(route.id, { initial });
    return;
  }

  handlers.closeArt();
  if (route.name === 'notfound') {
    window.history.replaceState({}, '', '/');
    sync({ initial });
    return;
  }
  if (keyOf(route) !== renderedKey) {
    const y = window.history.state && typeof window.history.state.scrollY === 'number'
      ? window.history.state.scrollY
      : 'top';
    showRoute(route, { scroll: initial ? null : y });
  }
}

export function navigate(url, { replace = false } = {}) {
  const target = new URL(url, window.location.origin);
  if (target.origin !== window.location.origin) {
    window.location.href = url;
    return;
  }
  if (!replace) saveScroll();
  const href = target.pathname + target.search;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', href);
  sync();
}

// Updates query params of the current list route in place (no new history
// entry) and lets the active view refresh itself instead of re-rendering.
export function updateRoute(patch, { push = false } = {}) {
  if (!current) return;
  const next = {
    ...current,
    filters: { ...current.filters, ...(patch.filters || {}) },
    order: patch.order || current.order,
  };
  const href = next.path + buildSearch(next);
  if (push) saveScroll();
  window.history[push ? 'pushState' : 'replaceState']({}, '', href);
  current = next;
  renderedKey = keyOf(next);
  if (handlers.refresh) handlers.refresh(next);
}

function isInternalListLink(a) {
  if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return false;
  const url = new URL(a.href, window.location.origin);
  if (url.origin !== window.location.origin) return false;
  // Cards open the viewer themselves; everything else routed here is a view.
  return !url.pathname.startsWith('/art/') && /^(\/|\/collections(\/[^/]+)?|\/year\/\d{4})$/.test(url.pathname.replace(/(.)\/+$/, '$1'));
}

export function initRouter(callbacks) {
  handlers = callbacks;
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!isInternalListLink(a)) return;
    e.preventDefault();
    navigate(a.getAttribute('href'));
  });

  window.addEventListener('popstate', () => sync());
  sync({ initial: true });
}
