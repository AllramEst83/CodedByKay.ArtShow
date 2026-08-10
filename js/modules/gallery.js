export let filteredArtwork = [];

export function setFilteredArtwork(items) {
  filteredArtwork = items;
}

export function renderGallery(items) {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';
  
  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');
  
  if (items.length === 0) {
    if (emptyTitle) emptyTitle.textContent = "Oops, we seem to have an issue...";
    if (emptyDesc) emptyDesc.textContent = "No artwork found matching your search or filters. Try resetting your search!";
    if (emptyState) emptyState.hidden = false;
    return;
  }
  
  if (emptyState) emptyState.hidden = true;
  
  let failedCount = 0;
  
  items.forEach(item => {
    const article = document.createElement('article');
    article.className = 'art-card';
    article.tabIndex = 0;
    article.dataset.id = item.id;
    
    // Image wrapper — shimmer sits as an absolute overlay inside this
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'art-card-image-wrapper';

    const shimmer = document.createElement('div');
    shimmer.className = 'shimmer';

    const img = document.createElement('img');
    img.src = item.thumbnailUrl;
    img.alt = item.title;
    img.loading = 'lazy';

    const removeShimmer = () => {
      shimmer.classList.add('shimmer--done');
      shimmer.addEventListener('transitionend', () => shimmer.remove(), { once: true });
    };
    
    img.onload = removeShimmer;
    
    img.onerror = () => {
      removeShimmer();
      failedCount++;
      imgWrapper.classList.add('has-error');
      imgWrapper.innerHTML = `
        <div class="card-error-fallback">
          <span class="error-emoji" aria-hidden="true">🎨☕</span>
          <p class="error-title">Oops, we seem to have an issue...</p>
          <p class="error-subtext">This drawing took an unexpected coffee break!</p>
        </div>
      `;
      
      // If all images in gallery fail to load due to network/server issues
      if (failedCount === items.length && emptyState) {
        if (emptyTitle) emptyTitle.textContent = "Oops, we seem to have an issue...";
        if (emptyDesc) emptyDesc.textContent = "The internet ate our pencils! We couldn't fetch the artwork images from the server right now.";
        emptyState.hidden = false;
      }
    };

    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';

    const title = document.createElement('h3');
    title.textContent = item.title;

    const category = document.createElement('span');
    category.className = 'card-category';
    category.textContent = item.category;

    overlay.appendChild(category);
    overlay.appendChild(title);

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(shimmer);

    // ── Desktop "i" info button ──────────────────────────────────────────────
    const infoBtn = document.createElement('button');
    infoBtn.className = 'card-info-btn';
    infoBtn.setAttribute('aria-label', 'Show artwork info');
    infoBtn.title = 'Artwork info';
    infoBtn.type = 'button';
    infoBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>`;

    // Metadata peek tooltip
    const formattedDate = item.createdDate
      ? new Date(item.createdDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '';
    const metaPeek = document.createElement('div');
    metaPeek.className = 'card-meta-peek';
    metaPeek.setAttribute('role', 'tooltip');
    metaPeek.innerHTML = `
      ${item.medium ? `<div class="meta-peek-row"><span class="peek-label">Medium</span><span class="peek-value">${item.medium}</span></div>` : ''}
      ${formattedDate ? `<div class="meta-peek-row"><span class="peek-label">Created</span><span class="peek-value">${formattedDate}</span></div>` : ''}
      ${item.dimensions ? `<div class="meta-peek-row"><span class="peek-label">Size</span><span class="peek-value">${item.dimensions}</span></div>` : ''}
    `;

    let peekOpen = false;

    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent lightbox from opening
      peekOpen = !peekOpen;
      metaPeek.classList.toggle('is-visible', peekOpen);
      infoBtn.setAttribute('aria-expanded', peekOpen);
    });

    // Close on outside click
    document.addEventListener('click', () => {
      if (peekOpen) {
        peekOpen = false;
        metaPeek.classList.remove('is-visible');
        infoBtn.setAttribute('aria-expanded', 'false');
      }
    }, { capture: false });

    article.appendChild(imgWrapper);
    article.appendChild(overlay);
    article.appendChild(infoBtn);
    article.appendChild(metaPeek);
    
    // Events
    const openLightbox = () => {
      document.dispatchEvent(new CustomEvent('artwork:open', { detail: item }));
    };
    
    article.addEventListener('click', openLightbox);
    article.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') openLightbox();
    });
    
    gallery.appendChild(article);
  });
}

export function initGallery(initialArtwork = []) {
  setFilteredArtwork(initialArtwork);
  renderGallery(filteredArtwork);
}
