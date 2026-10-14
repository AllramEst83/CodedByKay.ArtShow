// /collections — one tile per collection (cover, name, count).

import { getState, setState } from '../modules/store.js';

export function renderCollections(root) {
  const { collections, artwork } = getState();
  root.replaceChildren();

  const section = document.createElement('section');
  section.className = 'view view--collections';

  const header = document.createElement('header');
  header.className = 'view-header';
  const h1 = document.createElement('h1');
  h1.className = 'view-title';
  h1.tabIndex = -1;
  h1.textContent = 'Collections';
  const count = document.createElement('p');
  count.className = 'view-count';
  count.textContent = `${collections.length} collections`;
  header.append(h1, count);

  const grid = document.createElement('div');
  grid.className = 'tile-grid';

  collections.forEach((collection) => {
    const a = document.createElement('a');
    a.className = 'tile';
    a.href = `/collections/${encodeURIComponent(collection.slug)}`;

    const frame = document.createElement('span');
    frame.className = 'tile__frame';
    if (collection.cover) {
      const img = document.createElement('img');
      img.src = collection.cover.thumbnailUrl;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      frame.appendChild(img);
    }

    const name = document.createElement('span');
    name.className = 'tile__name';
    name.textContent = collection.name;
    const meta = document.createElement('span');
    meta.className = 'tile__count';
    meta.textContent = `${collection.count} ${collection.count === 1 ? 'work' : 'works'}`;

    a.append(frame, name, meta);
    grid.appendChild(a);
  });

  section.append(header, grid);
  root.appendChild(section);

  // No viewer sequence of its own: fall back to everything.
  setState({ list: artwork });

  return {
    refresh: null,
    destroy() {},
    focusTitle: () => h1.focus({ preventScroll: true }),
  };
}
