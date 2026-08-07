import { filteredArtwork } from './gallery.js';

let currentItem = null;
let isZoomed = false;
let isInfoOpen = false;

export function initLightbox() {
  document.addEventListener('artwork:open', (e) => {
    openLightbox(e.detail);
  });
  
  const lightbox = document.getElementById('lightbox');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');
  const zoomBtn = document.getElementById('lightbox-zoom');
  const infoBtn = document.getElementById('lightbox-info-btn');
  const infoCloseBtn = document.getElementById('lightbox-info-close');
  const drawerHandle = document.getElementById('drawer-handle');
  const imageContainer = document.querySelector('.lightbox-image-container');
  
  closeBtn.addEventListener('click', closeLightbox);
  
  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);
  
  zoomBtn.addEventListener('click', toggleZoom);
  if (infoBtn) {
    infoBtn.addEventListener('click', toggleInfo);
  }
  if (infoCloseBtn) {
    infoCloseBtn.addEventListener('click', closeInfo);
  }
  if (drawerHandle) {
    drawerHandle.addEventListener('click', closeInfo);
  }
  if (imageContainer) {
    imageContainer.addEventListener('click', (e) => {
      // Dismiss metadata drawer if open and clicking on image/background outside controls
      if (isInfoOpen && !e.target.closest('.lightbox-controls')) {
        closeInfo();
      }
    });
  }
  
  // Keyboard nav
  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    
    if (e.key === 'Escape') {
      if (isInfoOpen) {
        closeInfo();
      } else {
        closeLightbox();
      }
    }
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'i' || e.key === 'I') toggleInfo();
  });
  
  // Close on backdrop click
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}

function openLightbox(item) {
  currentItem = item;
  isZoomed = false;
  isInfoOpen = false; // default info state
  
  const content = document.querySelector('.lightbox-content');
  if (content) content.classList.remove('info-active');
  const infoBtn = document.getElementById('lightbox-info-btn');
  if (infoBtn) infoBtn.setAttribute('aria-expanded', 'false');
  
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
  
  const content = document.querySelector('.lightbox-content');
  if (content) content.classList.remove('info-active');
  
  setTimeout(() => {
    lightbox.hidden = true;
    document.body.style.overflow = '';
  }, 300); // var(--transition-speed)
}

function updateLightboxContent() {
  if (!currentItem) return;
  
  const container = document.querySelector('.lightbox-image-container');
  if (container) {
    const oldError = container.querySelector('.lightbox-error-fallback');
    if (oldError) oldError.remove();
  }
  
  const img = document.getElementById('lightbox-image');
  if (img) {
    img.style.display = 'block';
    img.src = currentItem.imageUrl;
    img.alt = currentItem.title;
    img.className = 'lightbox-image';
    
    img.onerror = () => {
      img.style.display = 'none';
      if (container && !container.querySelector('.lightbox-error-fallback')) {
        const errDiv = document.createElement('div');
        errDiv.className = 'lightbox-error-fallback';
        errDiv.innerHTML = `
          <span class="error-emoji" aria-hidden="true">🎨🙈</span>
          <h3>Oops, we seem to have an issue...</h3>
          <p>The canvas lost connection! Couldn't load "${currentItem.title}".</p>
          <button id="lightbox-retry-btn" class="btn btn-retry">Retry Loading 🔄</button>
        `;
        container.appendChild(errDiv);
        const retryBtn = errDiv.querySelector('#lightbox-retry-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            errDiv.remove();
            img.style.display = 'block';
            const cacheBuster = (currentItem.imageUrl.includes('?') ? '&' : '?') + 'retry=' + Date.now();
            img.src = currentItem.imageUrl + cacheBuster;
          });
        }
      }
    };
  }
  
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

function toggleInfo() {
  if (isInfoOpen) {
    closeInfo();
  } else {
    openInfo();
  }
}

function openInfo() {
  isInfoOpen = true;
  const content = document.querySelector('.lightbox-content');
  const infoBtn = document.getElementById('lightbox-info-btn');
  if (content) content.classList.add('info-active');
  if (infoBtn) infoBtn.setAttribute('aria-expanded', 'true');
}

function closeInfo() {
  isInfoOpen = false;
  const content = document.querySelector('.lightbox-content');
  const infoBtn = document.getElementById('lightbox-info-btn');
  if (content) content.classList.remove('info-active');
  if (infoBtn) infoBtn.setAttribute('aria-expanded', 'false');
}


