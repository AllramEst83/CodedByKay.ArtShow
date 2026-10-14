import { initWall } from './modules/wall.js';
import { COPY } from './modules/copy.js';
import { initGallery, renderGallery } from './modules/gallery.js';
import { initFilters } from './modules/filters.js';
import { initLightbox, setArtworkIndex, openArtworkFromUrl } from './modules/viewer.js';
import { initPagination, resetToPageOne, updatePaginationAndRender, showPageContaining } from './modules/pagination.js';
import { initGroups, showGridView } from './modules/groups.js';

function hidePageLoader() {
  const loader = document.getElementById('page-loader');
  if (!loader) return;
  loader.classList.add('is-hidden');
  setTimeout(() => loader.remove(), 350);
}

async function loadServerArtwork() {
  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');
  const loadingState = document.getElementById('gallery-loading');

  try {
    const response = await fetch('/data/artwork.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch artwork metadata from server`);
    }
    const artwork = await response.json();

    initGallery(artwork);
    initPagination();
    initGroups(() => {
      resetToPageOne();
      updatePaginationAndRender();
    });

    initFilters(artwork, () => {
      resetToPageOne();
      updatePaginationAndRender();
    });

    // Shared /art/<id> links open straight into the viewer.
    setArtworkIndex(artwork, (item) => {
      showGridView();
      showPageContaining(item.id);
    });
    openArtworkFromUrl();
  } catch (err) {
    console.error('[App] Failed to load server artwork:', err);
    if (emptyTitle) emptyTitle.textContent = COPY.errorTitle;
    if (emptyDesc) emptyDesc.textContent = COPY.loadFailed;
    if (emptyState) emptyState.hidden = false;
  } finally {
    if (loadingState) loadingState.hidden = true;
    hidePageLoader();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initWall();
  initLightbox();
  loadServerArtwork();
});
