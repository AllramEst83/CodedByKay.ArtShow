// Shared list view behind /, /collections/<slug> and /year/<yyyy>:
// header, order toggle, filter sheet, active-filter chips and the grid.
// Facet / search / order changes refresh the view in place (the URL is
// updated by the router); nothing here keeps state the URL does not hold.

import { COPY } from '../modules/copy.js';
import {
  FACETS, MEDIA_LABELS, applyFilters, facetCounts, sortItems,
} from '../modules/data.js';
import { renderGrid } from '../modules/grid.js';
import { updateRoute } from '../modules/router.js';
import { setState, getState } from '../modules/store.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function facetLabel(facetKey, value, collections) {
  if (facetKey === 'medium') return MEDIA_LABELS[value] || value;
  if (facetKey === 'collection') {
    const c = collections.find((entry) => entry.slug === value);
    return c ? c.name : value;
  }
  return value;
}

/**
 * @param {HTMLElement} root
 * @param {object} route current route (filters, order)
 * @param {object} opts { title, kicker?, scope: item[], facets: string[], orderToggle: boolean,
 *                        onOpen(item) }
 * @returns {{ refresh(route), destroy() }}
 */
export function renderBrowse(root, route, opts) {
  const { title, scope, facets, orderToggle, onOpen } = opts;
  const { collections } = getState();
  let sheetOpen = false;
  let gridHandles = [];
  let currentRoute = route;

  root.replaceChildren();
  const section = el('section', 'view view--browse');

  // Header
  const header = el('header', 'view-header');
  const h1 = el('h1', 'view-title', title);
  h1.tabIndex = -1;
  const count = el('p', 'view-count');
  count.setAttribute('role', 'status');
  header.append(h1, count);

  // Toolbar
  const toolbar = el('div', 'toolbar');
  let orderGroup = null;
  const orderButtons = {};
  if (orderToggle) {
    orderGroup = el('div', 'segmented');
    orderGroup.setAttribute('role', 'group');
    orderGroup.setAttribute('aria-label', 'Order');
    [['latest', 'Latest'], ['chronological', 'Chronological']].forEach(([value, label]) => {
      const b = el('button', 'segmented__btn', label);
      b.type = 'button';
      b.addEventListener('click', () => updateRoute({ order: value }));
      orderButtons[value] = b;
      orderGroup.appendChild(b);
    });
    toolbar.appendChild(orderGroup);
  }

  const filterToggle = el('button', 'toolbar__btn');
  filterToggle.type = 'button';
  filterToggle.setAttribute('aria-expanded', 'false');
  filterToggle.setAttribute('aria-controls', 'filter-sheet');
  const filterLabel = el('span', null, 'Filter');
  const filterBadge = el('span', 'toolbar__badge');
  filterToggle.append(filterLabel, filterBadge);
  filterToggle.addEventListener('click', () => {
    sheetOpen = !sheetOpen;
    sheet.hidden = !sheetOpen;
    filterToggle.setAttribute('aria-expanded', String(sheetOpen));
  });
  toolbar.appendChild(filterToggle);

  // Filter sheet
  const sheet = el('div', 'filter-sheet');
  sheet.id = 'filter-sheet';
  sheet.hidden = true;
  const facetButtons = new Map(); // `${facetKey}:${value}` -> {button, countEl}
  const facetSections = new Map();

  facets.forEach((facetKey) => {
    const facet = FACETS.find((f) => f.key === facetKey);
    const fieldset = el('fieldset', 'facet');
    fieldset.appendChild(el('legend', 'facet__label', facet.label));
    const list = el('div', 'facet__values');
    fieldset.appendChild(list);
    sheet.appendChild(fieldset);
    facetSections.set(facetKey, { fieldset, list });

    // The value universe comes from the scope, not the filtered list, so a
    // value never disappears from under the visitor.
    const values = new Set(scope.flatMap((item) => facet.values(item)));
    const ordered = [...values].sort((a, b) =>
      facetLabel(facetKey, a, collections).localeCompare(facetLabel(facetKey, b, collections)));

    ordered.forEach((value) => {
      const b = el('button', 'facet__toggle');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      const label = el('span', null, facetLabel(facetKey, value, collections));
      const countEl = el('span', 'facet__count');
      b.append(label, countEl);
      b.addEventListener('click', () => {
        const next = new Set(currentRoute.filters[facetKey]);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        updateRoute({ filters: { [facetKey]: next } });
        // keep keyboard focus on the toggle through the in-place refresh
        facetButtons.get(`${facetKey}:${value}`).button.focus();
      });
      facetButtons.set(`${facetKey}:${value}`, { button: b, countEl });
      list.appendChild(b);
    });
  });

  // Active filter chips
  const active = el('div', 'active-filters');

  // Results
  const results = el('div', 'results');

  section.append(header, toolbar, sheet, active, results);
  root.appendChild(section);

  function chip(text, onRemove) {
    const b = el('button', 'filter-chip');
    b.type = 'button';
    b.append(text + ' ');
    const x = el('span', null, '×');
    x.setAttribute('aria-hidden', 'true');
    b.appendChild(x);
    b.setAttribute('aria-label', `Remove filter: ${text}`);
    b.addEventListener('click', onRemove);
    return b;
  }

  function renderActive() {
    active.replaceChildren();
    const f = currentRoute.filters;
    let any = false;
    if (f.q) {
      any = true;
      active.appendChild(chip(`“${f.q}”`, () => {
        const input = document.getElementById('search-input');
        if (input) input.value = '';
        updateRoute({ filters: { q: '' } });
      }));
    }
    facets.forEach((facetKey) => {
      f[facetKey].forEach((value) => {
        any = true;
        active.appendChild(chip(facetLabel(facetKey, value, collections), () => {
          const next = new Set(f[facetKey]);
          next.delete(value);
          updateRoute({ filters: { [facetKey]: next } });
        }));
      });
    });
    if (any) {
      const clear = el('button', 'btn-text', 'Clear all');
      clear.type = 'button';
      clear.addEventListener('click', () => {
        const input = document.getElementById('search-input');
        if (input) input.value = '';
        const cleared = { q: '' };
        facets.forEach((k) => { cleared[k] = new Set(); });
        updateRoute({ filters: cleared });
      });
      active.appendChild(clear);
    }
    active.hidden = !any;
    const n = (f.q ? 1 : 0) + facets.reduce((sum, k) => sum + f[k].size, 0);
    filterBadge.textContent = n ? String(n) : '';
  }

  function renderFacets() {
    facets.forEach((facetKey) => {
      const counts = facetCounts(scope, currentRoute.filters, facetKey);
      facetSections.get(facetKey);
      facetButtons.forEach(({ button, countEl }, id) => {
        if (!id.startsWith(`${facetKey}:`)) return;
        const value = id.slice(facetKey.length + 1);
        const n = counts.get(value) || 0;
        const selected = currentRoute.filters[facetKey].has(value);
        button.setAttribute('aria-pressed', String(selected));
        button.disabled = n === 0 && !selected;
        countEl.textContent = String(n);
      });
    });
  }

  function destroyGrids() {
    gridHandles.forEach((h) => h.destroy());
    gridHandles = [];
  }

  function renderResults(items) {
    destroyGrids();
    results.replaceChildren();

    if (items.length === 0) {
      const empty = el('div', 'empty-state');
      empty.appendChild(el('h2', null, COPY.noMatches));
      const reset = el('button', 'btn', 'Reset filters');
      reset.type = 'button';
      reset.addEventListener('click', () => {
        const input = document.getElementById('search-input');
        if (input) input.value = '';
        const cleared = { q: '' };
        facets.forEach((k) => { cleared[k] = new Set(); });
        updateRoute({ filters: cleared });
      });
      empty.appendChild(reset);
      results.appendChild(empty);
      return;
    }

    if (currentRoute.order === 'chronological') {
      renderChronological(items);
    } else {
      const grid = el('div');
      results.appendChild(grid);
      gridHandles.push(renderGrid(grid, items, { onOpen, priority: true }));
    }
  }

  function renderChronological(items) {
    const groups = new Map();
    items.forEach((item) => {
      const key = item.year === null ? 'undated' : String(item.year);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    const rail = el('nav', 'year-rail');
    rail.setAttribute('aria-label', 'Jump to year');
    results.appendChild(rail);

    groups.forEach((groupItems, key) => {
      const sectionEl = el('section', 'year-section');
      sectionEl.id = `y-${key}`;
      const h2 = el('h2', 'year-heading');
      if (key === 'undated') {
        h2.textContent = 'Undated';
      } else {
        const a = el('a', null, key);
        a.href = `/year/${key}`;
        h2.appendChild(a);
      }
      h2.appendChild(el('span', 'year-heading__count', ` ${groupItems.length}`));
      sectionEl.appendChild(h2);
      const grid = el('div');
      sectionEl.appendChild(grid);
      results.appendChild(sectionEl);
      gridHandles.push(renderGrid(grid, groupItems, { onOpen }));

      const jump = el('button', 'year-rail__btn', key === 'undated' ? '?' : key);
      jump.type = 'button';
      jump.addEventListener('click', () => {
        sectionEl.scrollIntoView({ block: 'start' });
      });
      rail.appendChild(jump);
    });
  }

  function refresh(nextRoute) {
    currentRoute = nextRoute;
    Object.entries(orderButtons).forEach(([value, button]) => {
      button.setAttribute('aria-pressed', String(currentRoute.order === value));
    });

    const filtered = applyFilters(scope, currentRoute.filters);
    const ordered = sortItems(filtered, currentRoute.order);
    setState({ list: ordered });

    count.textContent = `${ordered.length} ${ordered.length === 1 ? 'work' : 'works'}`;
    renderActive();
    renderFacets();
    renderResults(ordered);
  }

  refresh(route);
  // Without a facet the filter control would be empty; search alone lives in the header.
  if (facets.length === 0) filterToggle.hidden = true;

  return {
    refresh,
    destroy: destroyGrids,
    focusTitle: () => h1.focus({ preventScroll: true }),
  };
}
