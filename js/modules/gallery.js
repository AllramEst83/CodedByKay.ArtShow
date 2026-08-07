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
    
    // Shimmer placeholder
    const shimmer = document.createElement('div');
    shimmer.className = 'shimmer';
    
    const img = document.createElement('img');
    img.src = item.thumbnailUrl;
    img.alt = item.title;
    img.loading = 'lazy';
    img.onload = () => shimmer.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';
    
    const title = document.createElement('h3');
    title.textContent = item.title;
    
    const category = document.createElement('span');
    category.className = 'card-category';
    category.textContent = item.category;
    
    overlay.appendChild(category);
    overlay.appendChild(title);
    
    article.appendChild(shimmer);
    article.appendChild(img);
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
