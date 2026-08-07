import { setFilteredArtwork } from './gallery.js';

let state = {
  searchQuery: '',
  selectedCategories: new Set(),
  selectedTags: new Set(),
  sortBy: 'date-desc'
};

let allArtwork = [];
let updateCallback = null;

export function initFilters(artwork, onUpdate) {
  allArtwork = artwork;
  updateCallback = onUpdate;
  
  setupUI();
  populateFilterOptions();
  bindEvents();
}

function setupUI() {
  const filterBtn = document.getElementById('filter-btn');
  const popover = document.getElementById('filter-popover');
  
  filterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = popover.hidden;
    popover.hidden = !isHidden;
    filterBtn.setAttribute('aria-expanded', !isHidden);
  });
  
  document.addEventListener('click', (e) => {
    if (!popover.hidden && !popover.contains(e.target) && e.target !== filterBtn) {
      popover.hidden = true;
      filterBtn.setAttribute('aria-expanded', 'false');
    }
  });
  
  popover.addEventListener('click', (e) => e.stopPropagation());
}

function populateFilterOptions() {
  const categories = [...new Set(allArtwork.map(a => a.category))];
  const tags = [...new Set(allArtwork.flatMap(a => a.tags))];
  
  const catContainer = document.getElementById('category-filters');
  categories.forEach(cat => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${cat}" data-filter="category"> ${cat}`;
    catContainer.appendChild(label);
  });
  
  const tagContainer = document.getElementById('tag-filters');
  tags.forEach(tag => {
    const label = document.createElement('label');
    label.className = 'chip-label';
    label.innerHTML = `<input type="checkbox" value="${tag}" data-filter="tag"> <span class="chip">${tag}</span>`;
    tagContainer.appendChild(label);
  });
}

function bindEvents() {
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    applyFilters();
  });
  
  document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      applyFilters();
    });
  });
  
  document.getElementById('filter-popover').addEventListener('change', (e) => {
    if (e.target.dataset.filter === 'category') {
      if (e.target.checked) state.selectedCategories.add(e.target.value);
      else state.selectedCategories.delete(e.target.value);
      applyFilters();
    } else if (e.target.dataset.filter === 'tag') {
      if (e.target.checked) state.selectedTags.add(e.target.value);
      else state.selectedTags.delete(e.target.value);
      applyFilters();
    }
  });
  
  document.getElementById('clear-filters-btn').addEventListener('click', clearAllFilters);
  document.getElementById('empty-clear-btn').addEventListener('click', clearAllFilters);
}

function renderBadges() {
  const container = document.getElementById('active-filters');
  container.innerHTML = '';
  
  if (state.searchQuery) {
    createBadge(`Search: ${state.searchQuery}`, () => {
      state.searchQuery = '';
      document.getElementById('search-input').value = '';
      applyFilters();
    });
  }
  
  state.selectedCategories.forEach(cat => {
    createBadge(`Category: ${cat}`, () => {
      state.selectedCategories.delete(cat);
      document.querySelector(`input[data-filter="category"][value="${cat}"]`).checked = false;
      applyFilters();
    });
  });
  
  state.selectedTags.forEach(tag => {
    createBadge(`Tag: ${tag}`, () => {
      state.selectedTags.delete(tag);
      document.querySelector(`input[data-filter="tag"][value="${tag}"]`).checked = false;
      applyFilters();
    });
  });
}

function createBadge(text, onRemove) {
  const badge = document.createElement('button');
  badge.className = 'badge';
  badge.innerHTML = `${text} <span aria-hidden="true">&times;</span>`;
  badge.addEventListener('click', onRemove);
  document.getElementById('active-filters').appendChild(badge);
}

export function clearAllFilters() {
  state.searchQuery = '';
  state.selectedCategories.clear();
  state.selectedTags.clear();
  
  document.getElementById('search-input').value = '';
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  
  applyFilters();
}

function applyFilters() {
  let filtered = allArtwork.filter(item => {
    const matchesSearch = !state.searchQuery || 
      item.title.toLowerCase().includes(state.searchQuery) || 
      item.description.toLowerCase().includes(state.searchQuery) ||
      item.tags.some(t => t.toLowerCase().includes(state.searchQuery));
      
    const matchesCat = state.selectedCategories.size === 0 || state.selectedCategories.has(item.category);
    const matchesTag = state.selectedTags.size === 0 || item.tags.some(t => state.selectedTags.has(t));
    
    return matchesSearch && matchesCat && matchesTag;
  });
  
  filtered.sort((a, b) => {
    if (state.sortBy === 'date-desc') return new Date(b.dateAdded) - new Date(a.dateAdded);
    if (state.sortBy === 'date-asc') return new Date(a.dateAdded) - new Date(b.dateAdded);
    if (state.sortBy === 'title-asc') return a.title.localeCompare(b.title);
    return 0;
  });
  
  renderBadges();
  setFilteredArtwork(filtered);
  if (updateCallback) updateCallback(filtered);
}
