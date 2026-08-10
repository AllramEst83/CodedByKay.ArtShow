export let filteredArtwork = [];

export function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

    article.appendChild(imgWrapper);
    article.appendChild(overlay);
    
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
