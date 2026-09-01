import { setFilteredArtwork } from './gallery.js';

let state = {
  searchQuery: '',
  selectedCategories: new Set(),
  selectedTags: new Set(),
  sortBy: 'added-date-desc',
  timelineDate: null,      // Date object or null (null = no timeline filter)
  timelineInvert: false    // false = show on/before, true = show on/after
};

let allArtwork = [];
let updateCallback = null;

export function initFilters(artwork, onUpdate) {
  allArtwork = artwork;
  updateCallback = onUpdate;
  
  setupUI();
  populateFilterOptions();
  buildTimeline();
  bindEvents();
  applyFilters();
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

// ─── Timeline Slider ──────────────────────────────────────────────────────────

function buildTimeline() {
  const section = document.getElementById('timeline-filter-section');
  if (!section) return;

  // Gather sorted dates
  const dates = allArtwork
    .map(a => new Date(a.createdDate))
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b);

  if (dates.length === 0) {
    section.hidden = true;
    return;
  }

  const minMs = dates[0].getTime();
  const maxMs = dates[dates.length - 1].getTime();

  // If all dates are the same, hide slider (no range)
  if (minMs === maxMs) {
    section.hidden = true;
    return;
  }

  section.hidden = false;

  // Tick mark percentages: 0%, 25%, 50%, 75%, 100%
  const tickPercents = [0, 25, 50, 75, 100];
  const tickDates = tickPercents.map(pct => {
    const ms = minMs + (maxMs - minMs) * (pct / 100);
    return new Date(ms);
  });

  // Build tick marks HTML — odd indices (25%, 75%) drop to a lower row to prevent label crowding
  const ticksHtml = tickPercents.map((pct, i) => `
    <div class="timeline-tick${i % 2 === 1 ? ' tick-low' : ''}" style="left:${pct}%" data-ms="${tickDates[i].getTime()}" title="${formatDate(tickDates[i])}">
      <span class="tick-label">${formatDate(tickDates[i])}</span>
    </div>
  `).join('');

  section.innerHTML = `
    <h3>Timeline</h3>
    <div class="timeline-slider-wrapper">
      <input
        type="range"
        id="timeline-slider"
        class="timeline-slider"
        min="${minMs}"
        max="${maxMs}"
        value="${maxMs}"
        step="86400000"
        aria-label="Filter by creation date"
      >
      <div class="timeline-ticks" aria-hidden="true">${ticksHtml}</div>
    </div>
    <div class="timeline-meta">
      <span id="timeline-selected-label" class="timeline-selected-label">All artwork</span>
      <label class="timeline-invert-label">
        <input type="checkbox" id="timeline-invert"> Show on/after date
      </label>
    </div>
  `;

  // Bind slider
  const slider = document.getElementById('timeline-slider');
  slider.addEventListener('input', () => {
    state.timelineDate = new Date(Number(slider.value));
    updateTimelineLabel(slider, minMs, maxMs);
    applyFilters();
  });

  // Allow clicking a tick to jump to that date
  section.querySelectorAll('.timeline-tick').forEach(tick => {
    tick.style.cursor = 'pointer';
    tick.addEventListener('click', () => {
      const ms = Number(tick.dataset.ms);
      slider.value = ms;
      state.timelineDate = new Date(ms);
      updateTimelineLabel(slider, minMs, maxMs);
      applyFilters();
    });
  });

  // Bind invert checkbox
  document.getElementById('timeline-invert').addEventListener('change', (e) => {
    state.timelineInvert = e.target.checked;
    // If no date set yet and user toggles invert, set date to min
    if (state.timelineDate === null && state.timelineInvert) {
      state.timelineDate = new Date(minMs);
      slider.value = minMs;
    }
    updateTimelineLabel(slider, minMs, maxMs);
    applyFilters();
  });

  updateTimelineLabel(slider, minMs, maxMs);
}

function updateTimelineLabel(slider, minMs, maxMs) {
  const label = document.getElementById('timeline-selected-label');
  if (!label) return;
  const val = Number(slider.value);
  const isInvert = state.timelineInvert;

  if (val === maxMs && !isInvert) {
    label.textContent = 'All artwork';
    state.timelineDate = null;
  } else {
    const date = new Date(val);
    const arrow = isInvert ? '≥' : '≤';
    label.textContent = `${arrow} ${formatDate(date)}`;
    state.timelineDate = date;
  }
}

function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Events ───────────────────────────────────────────────────────────────────

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

  if (state.timelineDate !== null) {
    const arrow = state.timelineInvert ? '≥' : '≤';
    createBadge(`Created date ${arrow} ${formatDate(state.timelineDate)}`, () => {
      // Reset slider to max (show all) and clear invert mode
      const slider = document.getElementById('timeline-slider');
      const invertCheckbox = document.getElementById('timeline-invert');
      state.timelineDate = null;
      state.timelineInvert = false;
      if (invertCheckbox) invertCheckbox.checked = false;
      if (slider) {
        slider.value = slider.max;
        updateTimelineLabel(slider, Number(slider.min), Number(slider.max));
      }
      applyFilters();
    });
  }
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
  state.timelineDate = null;
  state.timelineInvert = false;
  
  document.getElementById('search-input').value = '';
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  
  // Reset slider
  const slider = document.getElementById('timeline-slider');
  if (slider) {
    slider.value = slider.max;
    updateTimelineLabel(slider, Number(slider.min), Number(slider.max));
  }
  
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

    let matchesTimeline = true;
    if (state.timelineDate !== null) {
      const itemDate = new Date(item.createdDate);
      if (state.timelineInvert) {
        matchesTimeline = itemDate >= state.timelineDate;
      } else {
        matchesTimeline = itemDate <= state.timelineDate;
      }
    }
    
    return matchesSearch && matchesCat && matchesTag && matchesTimeline;
  });
  
  filtered.sort((a, b) => {
    if (state.sortBy === 'date-desc') return new Date(b.createdDate) - new Date(a.createdDate);
    if (state.sortBy === 'date-asc') return new Date(a.createdDate) - new Date(b.createdDate);
    if (state.sortBy === 'added-date-desc') return new Date(b.addedDate) - new Date(a.addedDate);
    if (state.sortBy === 'added-date-asc') return new Date(a.addedDate) - new Date(b.addedDate);
    if (state.sortBy === 'title-asc') return a.title.localeCompare(b.title);
    return 0;
  });
  
  renderBadges();
  setFilteredArtwork(filtered);
  if (updateCallback) updateCallback(filtered);
}
