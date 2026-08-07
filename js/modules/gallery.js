import artwork from '../data/artwork.js';

export let filteredArtwork = [...artwork];

export function setFilteredArtwork(items) {
  filteredArtwork = items;
}

export function renderGallery(items) {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';
  
  if (items.length === 0) {
    document.getElementById('empty-state').hidden = false;
    return;
  }
  
  document.getElementById('empty-state').hidden = true;
  
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
    img.onerror = removeShimmer;

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

export function initGallery() {
  renderGallery(filteredArtwork);
}
