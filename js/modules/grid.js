// Justified-row grid of artwork cards: every row fills the width, each work is
// shown at its real aspect ratio (nothing cropped), and reading order equals
// sort order.
//
// The data carries no image dimensions yet (plan §3, item 1), so ratios are
// learnt as thumbnails load and cached per visitor; until then a 3:4 box is
// reserved. When items start carrying `width`/`height` they are used directly.

import { COPY } from './copy.js';
import { displayDate } from './data.js';
import { storageService } from './storage.js';

const GAP = 24;
const DEFAULT_RATIO = 3 / 4;
const RATIO_CACHE_KEY = 'ratios';

let ratioCache = null;

function ratios() {
  if (!ratioCache) {
    const stored = storageService.get(RATIO_CACHE_KEY, {});
    ratioCache = stored && typeof stored === 'object' ? stored : {};
  }
  return ratioCache;
}

let persistTimer = null;
function rememberRatio(id, ratio) {
  ratios()[id] = Math.round(ratio * 1000) / 1000;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => storageService.set(RATIO_CACHE_KEY, ratios()), 800);
}

function ratioOf(item) {
  if (item.width && item.height) return item.width / item.height;
  return ratios()[item.id] || DEFAULT_RATIO;
}

function targetRowHeight(width) {
  if (width < 520) return 260;
  if (width < 900) return 230;
  return 290;
}

// Split items into rows whose natural width at the target height just exceeds
// the container; the final row is left unstretched when it would be too tall.
export function computeRows(items, width) {
  const target = targetRowHeight(width);
  const rows = [];
  let row = [];
  let sum = 0;

  items.forEach((item) => {
    const r = ratioOf(item);
    row.push({ item, ratio: r });
    sum += r;
    const naturalWidth = sum * target + GAP * (row.length - 1);
    if (naturalWidth >= width) {
      rows.push({ cells: row, sum, last: false });
      row = [];
      sum = 0;
    }
  });
  if (row.length) rows.push({ cells: row, sum, last: true });

  return rows.map((rowData) => {
    const gaps = GAP * (rowData.cells.length - 1);
    const fitHeight = (width - gaps) / rowData.sum;
    // Single short last row: keep the target height instead of blowing up.
    const height = rowData.last ? Math.min(fitHeight, target * 1.15) : fitHeight;
    return { ...rowData, height };
  });
}

function buildCard(item, onOpen, onRatio, priority) {
  const a = document.createElement('a');
  a.className = 'art-card';
  a.href = `/art/${encodeURIComponent(item.id)}`;
  a.dataset.id = item.id;

  const frame = document.createElement('span');
  frame.className = 'art-card__frame';

  const placeholder = document.createElement('span');
  placeholder.className = 'shimmer';
  placeholder.setAttribute('aria-hidden', 'true');

  const img = document.createElement('img');
  img.src = item.thumbnailUrl;
  img.alt = item.description || item.title;
  img.decoding = 'async';
  // The first screenful loads eagerly at high priority; the rest lazily.
  if (priority) {
    img.fetchPriority = 'high';
  } else {
    img.loading = 'lazy';
  }

  img.addEventListener('load', () => {
    placeholder.classList.add('shimmer--done');
    if (img.naturalWidth && img.naturalHeight) {
      const r = img.naturalWidth / img.naturalHeight;
      // Items that carry width/height already reserve their exact ratio.
      if (!(item.width && item.height) && Math.abs(r - ratioOf(item)) > 0.01) {
        rememberRatio(item.id, r);
        onRatio();
      }
    }
  });
  img.addEventListener('error', () => {
    placeholder.remove();
    frame.classList.add('has-error');
    frame.textContent = COPY.cardImageFailed;
  });

  frame.append(img, placeholder);

  if (item.isVideo) {
    const badge = document.createElement('span');
    badge.className = 'art-card__play';
    badge.setAttribute('aria-hidden', 'true');
    badge.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4"></polygon></svg>';
    frame.appendChild(badge);
  }

  const caption = document.createElement('span');
  caption.className = 'art-card__caption';
  const title = document.createElement('span');
  title.className = 'art-card__title';
  title.textContent = item.title;
  const meta = document.createElement('span');
  meta.className = 'art-card__meta';
  meta.textContent = [item.isVideo ? 'Video' : '', displayDate(item)].filter(Boolean).join(' · ');
  caption.append(title, meta);

  a.append(frame, caption);

  a.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen(item);
  });
  return a;
}

// Renders `items` into `container` and keeps rows justified on resize and as
// image ratios are discovered. Returns { destroy() }.
export function renderGrid(container, items, { onOpen, priority = false }) {
  container.classList.add('art-grid');
  container.replaceChildren();

  const cards = new Map();
  let frameRequest = 0;
  let lastWidth = -1;

  function layout() {
    frameRequest = 0;
    const width = Math.floor(container.clientWidth);
    if (!width) return;
    lastWidth = width;
    const rows = computeRows(items, width);
    const fragment = document.createDocumentFragment();

    rows.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'art-row';
      row.cells.forEach(({ item, ratio }) => {
        const card = cards.get(item.id);
        // Width follows the ratio so every frame in the row shares one height.
        const w = row.height * ratio;
        card.style.width = `${w}px`;
        card.querySelector('.art-card__frame').style.height = `${row.height}px`;
        rowEl.appendChild(card);
      });
      fragment.appendChild(rowEl);
    });
    container.replaceChildren(fragment);
  }

  function schedule() {
    if (!frameRequest) frameRequest = requestAnimationFrame(layout);
  }

  items.forEach((item, i) => cards.set(item.id, buildCard(item, onOpen, schedule, priority && i < 6)));

  const observer = new ResizeObserver(() => {
    if (Math.floor(container.clientWidth) !== lastWidth) schedule();
  });
  observer.observe(container);
  layout();

  return {
    destroy() {
      observer.disconnect();
      cancelAnimationFrame(frameRequest);
    },
  };
}
