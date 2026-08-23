import { filteredArtwork, formatDate } from './gallery.js';

let currentItem = null;
let isZoomed = false;
let isInfoOpen = false;
let isFullscreen = false;

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
  const fullscreenBtn = document.getElementById('lightbox-fullscreen');
  
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
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullscreen);
  }

  // Fullscreen-internal nav arrows
  const fsPrevBtn = document.getElementById('lightbox-fs-prev');
  const fsNextBtn = document.getElementById('lightbox-fs-next');
  if (fsPrevBtn) fsPrevBtn.addEventListener('click', showPrev);
  if (fsNextBtn) fsNextBtn.addEventListener('click', showNext);

  // Listen for fullscreen change events (e.g. user presses Escape in native fullscreen)
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  
  // Keyboard nav
  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    
    if (e.key === 'Escape') {
      if (isFullscreen) {
        exitFullscreen();
      } else if (isInfoOpen) {
        closeInfo();
      } else {
        closeLightbox();
      }
    }
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'i' || e.key === 'I') toggleInfo();
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
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
  if (isFullscreen) exitFullscreen();
  stopCurrentVideo();
  
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.remove('is-open');
  
  const content = document.querySelector('.lightbox-content');
  if (content) content.classList.remove('info-active');
  
  setTimeout(() => {
    lightbox.hidden = true;
    document.body.style.overflow = '';
  }, 300); // var(--transition-speed)
}

function stopCurrentVideo() {
  const existing = document.getElementById('lightbox-video');
  if (existing) {
    existing.pause();
    existing.src = '';
    existing.remove();
  }
}

function updateLightboxContent() {
  if (!currentItem) return;
  
  const container = document.querySelector('.lightbox-image-container');
  if (container) {
    const oldError = container.querySelector('.lightbox-error-fallback');
    if (oldError) oldError.remove();
  }

  const isVideo = currentItem.type === 'video';

  // Toggle zoom button visibility — zoom has no meaning for video
  const zoomBtn = document.getElementById('lightbox-zoom');
  if (zoomBtn) zoomBtn.style.display = isVideo ? 'none' : '';

  if (isVideo) {
    // Hide static image
    const img = document.getElementById('lightbox-image');
    if (img) img.style.display = 'none';

    stopCurrentVideo();

    const video = document.createElement('video');
    video.id = 'lightbox-video';
    video.className = 'lightbox-video';
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.src = currentItem.videoUrl;
    video.setAttribute('aria-label', currentItem.title);

    video.onerror = () => {
      video.remove();
      if (container && !container.querySelector('.lightbox-error-fallback')) {
        const errDiv = document.createElement('div');
        errDiv.className = 'lightbox-error-fallback';
        errDiv.innerHTML = `
          <span class="error-emoji" aria-hidden="true">🎬🙈</span>
          <h3>Oops, we seem to have an issue...</h3>
          <p>Couldn't load the video "${currentItem.title}".</p>
          <button id="lightbox-retry-btn" class="btn btn-retry">Retry Loading 🔄</button>
        `;
        container.appendChild(errDiv);
        errDiv.querySelector('#lightbox-retry-btn')?.addEventListener('click', () => {
          errDiv.remove();
          updateLightboxContent();
        });
      }
    };

    // Insert before .lightbox-controls so it sits behind the control bar
    const controls = container?.querySelector('.lightbox-controls');
    if (container && controls) {
      container.insertBefore(video, controls);
    } else if (container) {
      container.appendChild(video);
    }
  } else {
    // Image path
    stopCurrentVideo();

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
  }
  
  document.getElementById('lightbox-title').textContent = currentItem.title;
  document.getElementById('lightbox-category').textContent = currentItem.category;
  document.getElementById('lightbox-date').textContent = formatDate(currentItem.createdDate);
  document.getElementById('lightbox-medium').textContent = currentItem.medium;
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
  const isPrev = currentIndex <= 0;
  const isNext = currentIndex === -1 || currentIndex >= filteredArtwork.length - 1;
  document.getElementById('lightbox-prev').disabled = isPrev;
  document.getElementById('lightbox-next').disabled = isNext;
  const fsPrev = document.getElementById('lightbox-fs-prev');
  const fsNext = document.getElementById('lightbox-fs-next');
  if (fsPrev) fsPrev.disabled = isPrev;
  if (fsNext) fsNext.disabled = isNext;
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
  const container = document.querySelector('.lightbox-image-container');
  const infoBtn = document.getElementById('lightbox-info-btn');
  if (content) content.classList.add('info-active');
  if (container) container.classList.add('info-active'); // for fullscreen mode
  if (infoBtn) infoBtn.setAttribute('aria-expanded', 'true');
}

function closeInfo() {
  isInfoOpen = false;
  const content = document.querySelector('.lightbox-content');
  const container = document.querySelector('.lightbox-image-container');
  const infoBtn = document.getElementById('lightbox-info-btn');
  if (content) content.classList.remove('info-active');
  if (container) container.classList.remove('info-active');
  if (infoBtn) infoBtn.setAttribute('aria-expanded', 'false');
}

// ─── Fullscreen ───────────────────────────────────────────────────────────────

function toggleFullscreen() {
  if (!isFullscreen) {
    enterFullscreen();
  } else {
    exitFullscreen();
  }
}

function enterFullscreen() {
  const container = document.querySelector('.lightbox-image-container');
  if (!container) return;

  if (container.requestFullscreen) {
    container.requestFullscreen();
  } else if (container.webkitRequestFullscreen) {
    container.webkitRequestFullscreen();
  }
}

function exitFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

function onFullscreenChange() {
  isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const btn = document.getElementById('lightbox-fullscreen');
  const container = document.querySelector('.lightbox-image-container');
  const content = document.querySelector('.lightbox-content');
  const sidebar = document.querySelector('.lightbox-sidebar');

  if (isFullscreen) {
    if (btn) {
      btn.setAttribute('aria-label', 'Exit fullscreen');
      btn.title = 'Exit fullscreen';
      btn.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
          <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
        </svg>`;
    }
    if (container) container.classList.add('is-fullscreen');
    // Move sidebar into the fullscreened element so it appears in fullscreen
    if (sidebar && container) {
      container.appendChild(sidebar);
      sidebar.dataset.movedToFs = 'true';
    }
  } else {
    if (btn) {
      btn.setAttribute('aria-label', 'Enter fullscreen');
      btn.title = 'Enter fullscreen';
      btn.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
        </svg>`;
    }
    if (container) container.classList.remove('is-fullscreen');
    // Move sidebar back to lightbox-content
    if (sidebar && sidebar.dataset.movedToFs && content) {
      content.appendChild(sidebar);
      delete sidebar.dataset.movedToFs;
    }
    isFullscreen = false;
  }
}
