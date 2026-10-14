import { COPY } from './copy.js';
import { displayDate, MEDIA_LABELS } from './data.js';
import { getState } from './store.js';
import { getArtworkPath, getArtworkIdFromLocation, shareArtwork, showToast } from './share.js';
import { createZoom } from './viewer-zoom.js';

const IDLE_HIDE_MS = 2500;

let currentItem = null;
// The page title to restore on close (the underlying view sets it).
let titleBeforeOpen = '';
// True when opening the viewer pushed a history entry, so closing it can pop
// that entry instead of stacking another one.
let urlPushed = false;
// Bumped on every navigation; async image loads compare against it so a slow
// load for a previous item can never paint over the current one.
let generation = 0;
// Where focus returns to when the viewer closes.
let opener = null;
let idleTimer = null;
let zoom = null;

const $ = (id) => document.getElementById(id);

// Card click: push /art/<id> and open over the list on screen.
export function openArtwork(item) {
  openViewer(item);
}

// Router callback for an /art/<id> location (first load, back/forward).
// The list underneath is already rendered; this only shows the viewer.
export function openArtworkById(id, { initial = false } = {}) {
  const item = getState().artwork.find((entry) => entry.id === id);
  if (!item) {
    window.history.replaceState({}, '', '/');
    showToast("That artwork couldn't be found");
    return;
  }
  if ($('viewer').open && currentItem && currentItem.id === item.id) return;
  // Reached by history navigation: an entry sits before this one, so closing
  // may pop it. A direct visit (initial) has nothing to pop.
  urlPushed = !initial;
  openViewer(item, { updateUrl: false });
}

// Router callback when the location is no longer /art/<id>: hide without
// touching history (the location already changed).
export function closeArtworkSilently() {
  urlPushed = false;
  if (currentItem) hideViewer();
}

function pushArtworkUrl(item) {
  const path = getArtworkPath(item);
  if (window.location.pathname === path) return;
  window.history.pushState({ artworkId: item.id }, '', path);
  urlPushed = true;
}

function replaceArtworkUrl(item) {
  window.history.replaceState({ artworkId: item.id }, '', getArtworkPath(item));
}

// The list the visitor came from; falls back to everything when the current
// piece is not in it (e.g. a deep link into a filtered view).
function sequence() {
  const { list, artwork } = getState();
  let scoped = list;
  let index = scoped.findIndex((a) => a.id === currentItem.id);
  if (index === -1) {
    scoped = artwork;
    index = scoped.findIndex((a) => a.id === currentItem.id);
  }
  return { scoped, index };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export function initViewer() {
  const dialog = $('viewer');
  const stage = $('viewer-stage');
  if (!dialog || !stage) return;

  zoom = createZoom({
    stage,
    target: $('viewer-media'),
    getImageSize: currentImageSize,
    onSwipe: (dir) => (dir > 0 ? showNext() : showPrev()),
    onTap: toggleChrome,
    onZoomChange: (zoomed) => {
      dialog.classList.toggle('is-zoomed', zoomed);
      if (zoomed) loadOriginal();
    },
  });

  $('viewer-close').addEventListener('click', closeViewer);
  $('viewer-prev').addEventListener('click', showPrev);
  $('viewer-next').addEventListener('click', showNext);
  $('viewer-info-btn').addEventListener('click', toggleInfo);
  $('viewer-info-close').addEventListener('click', closeInfo);
  $('viewer-fullscreen').addEventListener('click', toggleFullscreen);
  $('viewer-zoom').addEventListener('click', () => zoom.toggle());

  $('viewer-share').addEventListener('click', async () => {
    if (!currentItem) return;
    const result = await shareArtwork(currentItem);
    if (result === 'copied') showToast('Link copied to clipboard');
    if (result === 'failed') showToast("Couldn't share - copy the link from the address bar");
  });

  $('viewer-retry').addEventListener('click', retryImage);
  $('viewer-play').addEventListener('click', playVideo);

  // Escape is handled in onKeyDown (preventDefault there also stops the
  // browser's close watcher, which would otherwise close the dialog outright on
  // a second Escape without user activation). `cancel` is the fallback.
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    escapeLayer();
  });

  // The dialog closing by any other route must still run our cleanup and
  // restore the URL.
  dialog.addEventListener('close', () => {
    if (currentItem) closeViewer();
  });

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // Chrome auto-hide: any activity wakes it.
  ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'focusin'].forEach((type) => {
    dialog.addEventListener(type, wakeChrome, { passive: true });
  });

  // Click on the empty wall around the media (stage background) is a tap too,
  // handled by the zoom module; a click on the dialog backdrop closes.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeViewer();
  });

  window.addEventListener('resize', () => zoom && zoom.refresh());
}

function onKeyDown(e) {
  const dialog = $('viewer');
  if (!dialog.open) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key) {
    case 'Escape':
      escapeLayer();
      break;
    case 'ArrowLeft':
      if (!zoom.panBy(80, 0)) showPrev();
      break;
    case 'ArrowRight':
      if (!zoom.panBy(-80, 0)) showNext();
      break;
    case 'ArrowUp':
      if (!zoom.panBy(0, 80)) return;
      break;
    case 'ArrowDown':
      if (!zoom.panBy(0, -80)) return;
      break;
    case 'Home': goTo(0); break;
    case 'End': goTo(-1); break;
    case '+':
    case '=': zoom.zoomBy(1.5); break;
    case '-':
    case '_': zoom.zoomBy(1 / 1.5); break;
    case '0': zoom.reset(); break;
    case 'i':
    case 'I': toggleInfo(); break;
    case 'f':
    case 'F': toggleFullscreen(); break;
    default: return;
  }
  e.preventDefault();
}

// Escape layers: exit zoom -> close info -> close viewer. (Native fullscreen
// consumes its own Escape before the page sees it.)
function escapeLayer() {
  if (zoom.isZoomed()) zoom.reset();
  else if (!$('viewer-info').hidden) closeInfo();
  else closeViewer();
}

// ─── Open / close ─────────────────────────────────────────────────────────────

function openViewer(item, { updateUrl = true } = {}) {
  const dialog = $('viewer');
  const wasOpen = dialog.open;
  if (!wasOpen) {
    const active = document.activeElement;
    opener = active && active !== document.body ? active : null;
  }

  currentItem = item;
  if (updateUrl) pushArtworkUrl(item);

  if (!wasOpen) {
    titleBeforeOpen = document.title;
    closeInfo();
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    wakeChrome();
    // Direct visit to /art/<id>: nothing to return to, so land on the title.
    if (!opener) $('viewer-title').focus({ preventScroll: true });
  }
  renderItem();
}

// User-initiated close. Drops the history entry the viewer pushed (the
// popstate handler then hides it); for a direct /art/<id> visit there is no
// such entry, so hide it and rewrite the URL back to the gallery.
function closeViewer() {
  if (urlPushed) {
    urlPushed = false;
    window.history.back();
    return;
  }
  hideViewer();
  if (getArtworkIdFromLocation() !== null) {
    window.history.replaceState({}, '', '/');
  }
}

function hideViewer() {
  const dialog = $('viewer');
  if (!currentItem) return;
  const closedItem = currentItem;
  currentItem = null;
  generation += 1; // abandon any in-flight loads

  if (titleBeforeOpen) document.title = titleBeforeOpen;
  if (document.fullscreenElement || document.webkitFullscreenElement) exitFullscreen();
  clearMedia();
  zoom.reset();
  clearTimeout(idleTimer);
  if (dialog.open) dialog.close();
  document.body.style.overflow = '';

  revealCard(closedItem);
  const target = opener && opener.isConnected ? opener : findCard(closedItem);
  opener = null;
  if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
}

function findCard(item) {
  return document.querySelector(`#view [data-id="${CSS.escape(String(item.id))}"]`);
}

// After viewing (esp. via a shared link) leave the artwork's card on screen so
// the visitor isn't dropped somewhere else on the page.
function revealCard(item) {
  // Every card of the list is in the DOM (no pagination), so it is always there
  // unless the viewer walked outside the filtered list.
  const card = findCard(item);
  if (card) card.scrollIntoView({ block: 'center', behavior: 'instant' });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function currentImageSize() {
  const main = $('viewer-image');
  if (main.complete && main.naturalWidth) return { w: main.naturalWidth, h: main.naturalHeight };
  const thumb = $('viewer-thumb');
  if (thumb.complete && thumb.naturalWidth) return { w: thumb.naturalWidth, h: thumb.naturalHeight };
  return null;
}

function clearMedia() {
  const main = $('viewer-image');
  const thumb = $('viewer-thumb');
  main.onload = main.onerror = null;
  main.removeAttribute('src');
  main.hidden = true;
  thumb.removeAttribute('src');
  thumb.hidden = true;
  $('viewer-video-host').replaceChildren();
  $('viewer-video-facade').hidden = true;
  $('viewer-error').hidden = true;
  $('viewer-loading').hidden = true;
}

function renderItem() {
  if (!currentItem) return;
  const item = currentItem;
  const myGeneration = ++generation;
  const isVideo = item.type === 'video';

  clearMedia();
  zoom.reset();
  zoom.setEnabled(!isVideo);
  $('viewer-zoom').hidden = isVideo;
  $('viewer').classList.toggle('is-video', isVideo);

  document.title = `${item.title} — Kay's ArtShow`;
  $('viewer-title').textContent = item.title;
  $('viewer-year').textContent = displayDate(item);
  $('viewer').setAttribute('aria-label', item.title);

  renderInfo(item);
  updatePosition();

  if (isVideo) {
    const facade = $('viewer-video-facade');
    const poster = $('viewer-poster');
    poster.src = item.thumbnailUrl || '';
    poster.alt = item.title;
    facade.hidden = false;
    $('viewer-play').focus({ preventScroll: true });
  } else {
    loadImage(item, myGeneration);
  }
  preloadNeighbours();
}

// Paint the already-cached thumbnail immediately, then swap to the full image
// once it has decoded.
function loadImage(item, myGeneration, { cacheBust = false } = {}) {
  const thumb = $('viewer-thumb');
  const main = $('viewer-image');
  const url = item.displayUrl || item.imageUrl;

  if (item.thumbnailUrl) {
    thumb.alt = '';
    thumb.src = item.thumbnailUrl;
    thumb.hidden = false;
  }
  $('viewer-loading').hidden = false;

  const loader = new Image();
  loader.src = cacheBust ? withCacheBuster(url) : url;
  const done = () => {
    if (myGeneration !== generation) return;
    main.alt = item.title;
    main.src = loader.src;
    main.hidden = false;
    thumb.hidden = true;
    $('viewer-loading').hidden = true;
    zoom.refresh();
  };
  const failed = () => {
    if (myGeneration !== generation) return;
    $('viewer-loading').hidden = true;
    $('viewer-error-text').textContent = COPY.viewerImageFailed(item.title);
    $('viewer-error').hidden = false;
    $('viewer-retry').focus({ preventScroll: true });
  };
  loader.decode().then(done, () => {
    // decode() can reject for formats it dislikes even though the image loads.
    if (loader.complete && loader.naturalWidth) done();
    else failed();
  });
}

function withCacheBuster(url) {
  return url + (url.includes('?') ? '&' : '?') + 'retry=' + Date.now();
}

function retryImage() {
  if (!currentItem) return;
  $('viewer-error').hidden = true;
  loadImage(currentItem, ++generation, { cacheBust: true });
}

// Zooming past the display-size file swaps in the original (same box, so no
// visual jump) so pixels stay sharp up to 100%.
function loadOriginal() {
  const item = currentItem;
  if (!item || !item.displayUrl || item.displayUrl === item.imageUrl) return;
  const main = $('viewer-image');
  if (main.dataset.original === item.imageUrl) return;
  const myGeneration = generation;
  const loader = new Image();
  loader.src = item.imageUrl;
  loader.decode().then(() => {
    if (myGeneration !== generation || currentItem !== item) return;
    main.dataset.original = item.imageUrl;
    main.src = loader.src;
    zoom.refresh();
  }, () => { /* keep the display-size image */ });
}

function playVideo() {
  if (!currentItem || currentItem.type !== 'video') return;
  const video = document.createElement('iframe');
  video.className = 'viewer-video';
  video.title = currentItem.title;
  video.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  video.allowFullscreen = true;
  video.frameBorder = '0';
  video.src = `${currentItem.videoUrl}?autoplay=1&mute=1&rel=0`;
  $('viewer-video-host').replaceChildren(video);
  $('viewer-video-facade').hidden = true;
}

function renderInfo(item) {
  $('viewer-info-title').textContent = item.title;

  const collection = $('viewer-collection');
  collection.replaceChildren();
  item.collections.forEach((c, i) => {
    if (i) collection.append(', ');
    const a = document.createElement('a');
    a.href = `/collections/${encodeURIComponent(c.slug)}`;
    a.textContent = c.name;
    collection.appendChild(a);
  });

  $('viewer-date').textContent = displayDate(item);
  $('viewer-medium').textContent = item.medium || item.media.map((m) => MEDIA_LABELS[m] || m).join(', ');
  $('viewer-desc').textContent = item.description || '';

  const tags = $('viewer-tags');
  tags.replaceChildren();
  item.subjects.forEach((tag) => {
    const a = document.createElement('a');
    a.className = 'chip static chip--link';
    a.href = `/?subject=${encodeURIComponent(tag)}`;
    a.textContent = tag;
    tags.appendChild(a);
  });
}

function preloadNeighbours() {
  const { scoped, index } = sequence();
  [scoped[index - 1], scoped[index + 1]].forEach((neighbour) => {
    if (!neighbour || neighbour.type === 'video') return;
    // Originals are multi-MB; without a display-size file, warm the thumbnail
    // (already tiny) so navigation still paints instantly.
    const url = neighbour.displayUrl || neighbour.thumbnailUrl;
    if (!url) return;
    const img = new Image();
    img.src = url;
    img.decode().catch(() => {});
  });
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function goToItem(item) {
  if (!item || item === currentItem) return;
  currentItem = item;
  replaceArtworkUrl(item);
  renderItem();
}

function showPrev() {
  if (!currentItem) return;
  const { scoped, index } = sequence();
  if (index > 0) goToItem(scoped[index - 1]);
}

function showNext() {
  if (!currentItem) return;
  const { scoped, index } = sequence();
  if (index >= 0 && index < scoped.length - 1) goToItem(scoped[index + 1]);
}

function goTo(position) {
  if (!currentItem) return;
  const { scoped } = sequence();
  if (!scoped.length) return;
  goToItem(position < 0 ? scoped[scoped.length - 1] : scoped[position]);
}

function updatePosition() {
  const { scoped, index } = sequence();
  $('viewer-position').textContent = index >= 0 ? `${index + 1} / ${scoped.length}` : '';
  $('viewer-prev').disabled = index <= 0;
  $('viewer-next').disabled = index === -1 || index >= scoped.length - 1;
}

// ─── Info panel ───────────────────────────────────────────────────────────────

function toggleInfo() {
  if ($('viewer-info').hidden) openInfo();
  else closeInfo();
}

function openInfo() {
  $('viewer-info').hidden = false;
  $('viewer-info-btn').setAttribute('aria-expanded', 'true');
  $('viewer').classList.add('info-open');
  $('viewer-info-close').focus({ preventScroll: true });
}

function closeInfo() {
  const wasOpen = !$('viewer-info').hidden;
  $('viewer-info').hidden = true;
  $('viewer-info-btn').setAttribute('aria-expanded', 'false');
  $('viewer').classList.remove('info-open');
  if (wasOpen && $('viewer').open) $('viewer-info-btn').focus({ preventScroll: true });
}

// ─── Auto-hiding chrome ───────────────────────────────────────────────────────

function chromeMustStay() {
  const dialog = $('viewer');
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !$('viewer-info').hidden ||
    dialog.querySelector('.viewer-chrome :focus-visible') !== null
  );
}

function wakeChrome() {
  const dialog = $('viewer');
  dialog.classList.remove('chrome-hidden');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!chromeMustStay()) dialog.classList.add('chrome-hidden');
  }, IDLE_HIDE_MS);
}

function toggleChrome() {
  const dialog = $('viewer');
  if (dialog.classList.contains('chrome-hidden')) wakeChrome();
  else if (!chromeMustStay()) {
    clearTimeout(idleTimer);
    dialog.classList.add('chrome-hidden');
  }
}

// ─── Fullscreen ───────────────────────────────────────────────────────────────
// The viewer root inside the <dialog> goes fullscreen (browsers refuse
// fullscreen on a <dialog> itself), so chrome, caption and toasts all stay
// inside it - no DOM reparenting.

function toggleFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) exitFullscreen();
  else enterFullscreen();
}

function enterFullscreen() {
  const root = $('viewer-root');
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (request) request.call(root);
}

function exitFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit) exit.call(document);
}

function onFullscreenChange() {
  const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const btn = $('viewer-fullscreen');
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
  btn.title = on ? 'Exit fullscreen' : 'Enter fullscreen';
  zoom && zoom.refresh();
}
