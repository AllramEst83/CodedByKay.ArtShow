import { initWall } from './modules/wall.js';
import { COPY } from './modules/copy.js';
import { normalizeArtwork, buildCollections, buildYears } from './modules/data.js';
import { initRouter, navigate, updateRoute, currentRoute } from './modules/router.js';
import { getState, setState } from './modules/store.js';
import { initViewer, openArtwork, openArtworkById, closeArtworkSilently } from './modules/viewer.js';
import { renderBrowse } from './views/browse.js';
import { renderCollections } from './views/collections.js';

const SITE_TITLE = "Kay's ArtShow";
const SEARCH_DEBOUNCE_MS = 250;
const ALL_FACETS = ['collection', 'medium', 'subject'];

let activeView = null;

function hidePageLoader() {
  const loader = document.getElementById('page-loader');
  if (!loader) return;
  loader.classList.add('is-hidden');
  setTimeout(() => loader.remove(), 350);
}

function setTitle(title) {
  document.title = title ? `${title} — ${SITE_TITLE}` : SITE_TITLE;
}

function markNav(routeName) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const inCollections = routeName === 'collections' || routeName === 'collection';
    const on = link.dataset.nav === 'collections' ? inCollections : !inCollections;
    if (on) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function showMessage(root, heading, body, linkHref, linkText) {
  root.replaceChildren();
  const box = document.createElement('section');
  box.className = 'view empty-state';
  const h1 = document.createElement('h1');
  h1.textContent = heading;
  h1.tabIndex = -1;
  box.appendChild(h1);
  if (body) {
    const p = document.createElement('p');
    p.textContent = body;
    box.appendChild(p);
  }
  if (linkHref) {
    const a = document.createElement('a');
    a.className = 'btn';
    a.href = linkHref;
    a.textContent = linkText;
    box.appendChild(a);
  }
  root.appendChild(box);
  return { refresh: null, destroy() {}, focusTitle: () => h1.focus({ preventScroll: true }) };
}

let firstRender = true;

function renderRoute(route) {
  const root = document.getElementById('view');
  const { artwork, collections } = getState();
  if (activeView) activeView.destroy();

  const onOpen = (item) => openArtwork(item);
  markNav(route.name);

  // Keep the header search box in step with the URL (back/forward, links).
  const search = document.getElementById('search-input');
  if (search && search.value !== route.filters.q) search.value = route.filters.q;
  if (route.filters.q) setSearchOpen(true);

  switch (route.name) {
    case 'work':
      setTitle('');
      activeView = renderBrowse(root, route, {
        title: 'Work', scope: artwork, facets: ALL_FACETS, orderToggle: true, onOpen,
      });
      break;

    case 'collections':
      setTitle('Collections');
      activeView = renderCollections(root);
      break;

    case 'collection': {
      const collection = collections.find((c) => c.slug === route.slug);
      if (!collection) {
        setTitle('Collection not found');
        activeView = showMessage(root, 'Collection not found', null, '/collections', 'All collections');
        break;
      }
      setTitle(collection.name);
      activeView = renderBrowse(root, route, {
        title: collection.name, blurb: collection.blurb, scope: collection.items,
        facets: ['medium', 'subject'], orderToggle: true, onOpen,
      });
      break;
    }

    case 'year': {
      const scope = artwork.filter((item) => item.year === route.year);
      setTitle(String(route.year));
      if (scope.length === 0) {
        activeView = showMessage(root, String(route.year), 'No work from this year.', '/', 'All work');
        break;
      }
      activeView = renderBrowse(root, route, {
        title: String(route.year), scope, facets: ALL_FACETS, orderToggle: false, onOpen,
      });
      break;
    }

    default:
      activeView = showMessage(root, COPY.errorTitle, null, '/', 'All work');
  }

  // Move focus to the new view's heading for screen readers, but not on the
  // very first paint (that would steal focus from the page itself).
  if (!firstRender && activeView && activeView.focusTitle) activeView.focusTitle();
  firstRender = false;
}

// ─── Header search ────────────────────────────────────────────────────────────

function setSearchOpen(open) {
  const bar = document.getElementById('search-bar');
  const toggle = document.getElementById('search-toggle');
  if (!bar || !toggle) return;
  bar.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
}

function initSearch() {
  const toggle = document.getElementById('search-toggle');
  const input = document.getElementById('search-input');
  const bar = document.getElementById('search-bar');
  if (!toggle || !input || !bar) return;

  toggle.addEventListener('click', () => {
    const open = bar.hidden;
    setSearchOpen(open);
    if (open) input.focus();
  });

  let timer = null;
  const commit = (value) => {
    const q = value.trim();
    const route = currentRoute();
    // Search lives on list views; from the collection tiles it jumps to all work.
    if (!route || route.name === 'collections') {
      if (q) navigate(`/?q=${encodeURIComponent(q)}`);
      return;
    }
    if (q !== route.filters.q) updateRoute({ filters: { q } });
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => commit(input.value), SEARCH_DEBOUNCE_MS);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      commit(input.value);
    } else if (e.key === 'Escape') {
      clearTimeout(timer);
      input.value = '';
      commit('');
      setSearchOpen(false);
      toggle.focus();
    }
  });
}

// Optional presentation details for collections (blurb, cover, order). The site is fully
// usable without it, so any failure just means defaults.
async function loadCollectionMeta() {
  try {
    const response = await fetch('/data/collections.json');
    if (!response.ok) return [];
    const parsed = await response.json();
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const root = document.getElementById('view');
  try {
    const response = await fetch('/data/artwork.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch artwork metadata from server`);
    }
    const artwork = normalizeArtwork(await response.json());
    const collectionMeta = await loadCollectionMeta();
    setState({
      artwork,
      list: artwork,
      collections: buildCollections(artwork, collectionMeta),
      years: buildYears(artwork),
    });

    initViewer();
    initSearch();
    initRouter({
      render: renderRoute,
      refresh: (route) => {
        if (activeView && activeView.refresh) activeView.refresh(route);
        else renderRoute(route);
      },
      openArt: openArtworkById,
      closeArt: closeArtworkSilently,
    });
  } catch (err) {
    console.error('[App] Failed to load server artwork:', err);
    showMessage(root, COPY.errorTitle, COPY.loadFailed, '/', 'Try again');
  } finally {
    hidePageLoader();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initWall();
  boot();
});
