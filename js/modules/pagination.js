import { filteredArtwork, renderGallery } from './gallery.js';

let currentPage = 1;
let itemsPerPage = parseInt(localStorage.getItem('artshow_items_per_page'), 10) || 25;

export function initPagination() {
  const perPageSelect = document.getElementById('per-page');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  
  if (perPageSelect) {
    perPageSelect.value = itemsPerPage;
    perPageSelect.addEventListener('change', (e) => {
      itemsPerPage = parseInt(e.target.value, 10);
      localStorage.setItem('artshow_items_per_page', itemsPerPage);
      currentPage = 1; // Reset to page 1 on size change
      updatePaginationAndRender();
    });
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        updatePaginationAndRender();
        scrollToGalleryTop();
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(filteredArtwork.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        updatePaginationAndRender();
        scrollToGalleryTop();
      }
    });
  }
}

export function resetToPageOne() {
  currentPage = 1;
}

export function updatePaginationAndRender() {
  const totalItems = filteredArtwork.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  
  // Ensure current page is within valid bounds
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const sliced = filteredArtwork.slice(start, end);
  
  updatePaginationUI(totalPages, totalItems);
  renderGallery(sliced);
  prefetchNextPage();
}

function updatePaginationUI(totalPages, totalItems) {
  const container = document.getElementById('pagination-controls');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const pageInfo = document.getElementById('page-info');
  
  if (!container) return;
  
  if (totalItems === 0) {
    container.hidden = true;
    return;
  }
  
  container.hidden = false;
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

function scrollToGalleryTop() {
  const gallery = document.getElementById('gallery');
  if (gallery) {
    gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Pre-fetch thumbnails for the next page to make navigation instantaneous
function prefetchNextPage() {
  const totalPages = Math.ceil(filteredArtwork.length / itemsPerPage);
  if (currentPage >= totalPages) return;
  
  const start = currentPage * itemsPerPage;
  const end = start + itemsPerPage;
  const nextSlice = filteredArtwork.slice(start, end);
  
  nextSlice.forEach(item => {
    const img = new Image();
    img.src = item.thumbnailUrl;
  });
}
