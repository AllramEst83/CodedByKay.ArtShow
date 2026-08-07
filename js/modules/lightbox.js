import { filteredArtwork } from './gallery.js';

let currentItem = null;
let isZoomed = false;

export function initLightbox() {
  document.addEventListener('artwork:open', (e) => {
    openLightbox(e.detail);
  });
  
  const lightbox = document.getElementById('lightbox');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');
  const zoomBtn = document.getElementById('lightbox-zoom');
  
  closeBtn.addEventListener('click', closeLightbox);
  
  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);
  
  zoomBtn.addEventListener('click', toggleZoom);
  
  // Keyboard nav
  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  });
  
  // Close on backdrop click
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}

function openLightbox(item) {
  currentItem = item;
  isZoomed = false;
  updateLightboxContent();
  
  const lightbox = document.getElementById('lightbox');
  lightbox.hidden = false;
  // Trigger reflow for animation
  void lightbox.offsetWidth;
  lightbox.classList.add('is-open');
  document.body.style.overflow = 'hidden'; // trap scroll
  
  document.getElementById('lightbox-close').focus();
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.remove('is-open');
  
  setTimeout(() => {
    lightbox.hidden = true;
    document.body.style.overflow = '';
  }, 300); // var(--transition-speed)
}

function updateLightboxContent() {
  if (!currentItem) return;
  
  const img = document.getElementById('lightbox-image');
  img.src = currentItem.imageUrl;
  img.alt = currentItem.title;
  img.className = 'lightbox-image';
  
  document.getElementById('lightbox-title').textContent = currentItem.title;
  document.getElementById('lightbox-category').textContent = currentItem.category;
  document.getElementById('lightbox-date').textContent = new Date(currentItem.dateAdded).toLocaleDateString();
  document.getElementById('lightbox-medium').textContent = currentItem.medium;
  document.getElementById('lightbox-dimensions').textContent = currentItem.dimensions;
  document.getElementById('lightbox-desc').textContent = currentItem.description;
  
  const tagsContainer = document.getElementById('lightbox-tags');
  tagsContainer.innerHTML = '';
  currentItem.tags.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'chip static';
    span.textContent = tag;
    tagsContainer.appendChild(span);
  });
  
  updateNavButtons();
}

function showPrev() {
  const currentIndex = filteredArtwork.findIndex(a => a.id === currentItem.id);
  if (currentIndex > 0) {
    currentItem = filteredArtwork[currentIndex - 1];
    updateLightboxContent();
  }
}

function showNext() {
  const currentIndex = filteredArtwork.findIndex(a => a.id === currentItem.id);
  if (currentIndex >= 0 && currentIndex < filteredArtwork.length - 1) {
    currentItem = filteredArtwork[currentIndex + 1];
    updateLightboxContent();
  }
}

function updateNavButtons() {
  const currentIndex = filteredArtwork.findIndex(a => a.id === currentItem.id);
  document.getElementById('lightbox-prev').disabled = currentIndex <= 0;
  document.getElementById('lightbox-next').disabled = currentIndex === -1 || currentIndex >= filteredArtwork.length - 1;
}

function toggleZoom() {
  isZoomed = !isZoomed;
  const img = document.getElementById('lightbox-image');
  if (isZoomed) {
    img.classList.add('zoomed');
  } else {
    img.classList.remove('zoomed');
  }
}
