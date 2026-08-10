import { initTheme } from './modules/themes.js';
import { initGallery, renderGallery } from './modules/gallery.js';
import { initFilters } from './modules/filters.js';
import { initLightbox } from './modules/lightbox.js';

async function loadServerArtwork() {
  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');
  
  try {
    const response = await fetch('/.netlify/functions/image');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch artwork metadata from server`);
    }
    const artwork = await response.json();
    
    initGallery(artwork);
    initFilters(artwork, (filtered) => {
      renderGallery(filtered);
    });
  } catch (err) {
    console.error('[App] Failed to load server artwork:', err);
    if (emptyTitle) emptyTitle.textContent = "Oops, we seem to have an issue...";
    if (emptyDesc) emptyDesc.textContent = "The internet ate our pencils! We couldn't fetch the artwork metadata from the server right now.";
    if (emptyState) emptyState.hidden = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLightbox();
  loadServerArtwork();
});

