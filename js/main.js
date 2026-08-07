import { initTheme } from './modules/themes.js';
import { initGallery, renderGallery } from './modules/gallery.js';
import { initFilters } from './modules/filters.js';
import { initLightbox } from './modules/lightbox.js';
import artwork from './data/artwork.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initGallery();
  initFilters(artwork, (filtered) => {
    renderGallery(filtered);
  });
  initLightbox();
});
