import { filteredArtwork } from './gallery.js';

const STORAGE_KEY = 'artshow_view_mode';
const GROUP_BY_STORAGE_KEY = 'artshow_group_by_mode';

let viewMode = localStorage.getItem(STORAGE_KEY) === 'groups' ? 'groups' : 'grid';
let groupByMode = localStorage.getItem(GROUP_BY_STORAGE_KEY) === 'year' ? 'year' : 'name';
let activeGroup = null;
let onChange = null;

export function initGroups(onUpdate) {
  onChange = onUpdate;

  const gridBtn = document.getElementById('view-grid-btn');
  const groupsBtn = document.getElementById('view-groups-btn');
  const backBtn = document.getElementById('back-to-groups-btn');
  const groupByNameBtn = document.getElementById('group-by-name-btn');
  const groupByYearBtn = document.getElementById('group-by-year-btn');

  gridBtn.addEventListener('click', () => setViewMode('grid'));
  groupsBtn.addEventListener('click', () => setViewMode('groups'));
  backBtn.addEventListener('click', () => {
    activeGroup = null;
    updateSortVisibility();
    updateGroupByToggleVisibility();
    updateBreadcrumb();
    onChange();
  });

  if (groupByNameBtn) groupByNameBtn.addEventListener('click', () => setGroupByMode('name'));
  if (groupByYearBtn) groupByYearBtn.addEventListener('click', () => setGroupByMode('year'));

  updateToggleUI();
  updateGroupByToggleUI();
  updateSortVisibility();
  updateGroupByToggleVisibility();
  updateBreadcrumb();
}

function setViewMode(mode) {
  if (viewMode === mode) return;
  viewMode = mode;
  activeGroup = null;
  localStorage.setItem(STORAGE_KEY, mode);
  updateToggleUI();
  updateSortVisibility();
  updateGroupByToggleVisibility();
  updateBreadcrumb();
  onChange();
}

function setGroupByMode(mode) {
  if (groupByMode === mode) return;
  groupByMode = mode;
  activeGroup = null;
  localStorage.setItem(GROUP_BY_STORAGE_KEY, mode);
  updateGroupByToggleUI();
  updateSortVisibility();
  updateBreadcrumb();
  onChange();
}

function selectGroup(name) {
  activeGroup = name;
  updateSortVisibility();
  updateGroupByToggleVisibility();
  updateBreadcrumb();
  onChange();
}

function updateToggleUI() {
  const gridBtn = document.getElementById('view-grid-btn');
  const groupsBtn = document.getElementById('view-groups-btn');
  gridBtn.classList.toggle('is-active', viewMode === 'grid');
  gridBtn.setAttribute('aria-pressed', String(viewMode === 'grid'));
  groupsBtn.classList.toggle('is-active', viewMode === 'groups');
  groupsBtn.setAttribute('aria-pressed', String(viewMode === 'groups'));
}

function updateGroupByToggleUI() {
  const nameBtn = document.getElementById('group-by-name-btn');
  const yearBtn = document.getElementById('group-by-year-btn');
  if (!nameBtn || !yearBtn) return;
  nameBtn.classList.toggle('is-active', groupByMode === 'name');
  nameBtn.setAttribute('aria-pressed', String(groupByMode === 'name'));
  yearBtn.classList.toggle('is-active', groupByMode === 'year');
  yearBtn.setAttribute('aria-pressed', String(groupByMode === 'year'));
}

function updateGroupByToggleVisibility() {
  const toggle = document.getElementById('group-by-toggle');
  if (toggle) toggle.hidden = !(viewMode === 'groups' && !activeGroup);
}

function updateSortVisibility() {
  const sortSection = document.getElementById('sort-filter-section');
  if (sortSection) sortSection.hidden = viewMode === 'groups' && !activeGroup;
}

function updateBreadcrumb() {
  const breadcrumb = document.getElementById('group-breadcrumb');
  const labelEl = document.getElementById('group-breadcrumb-label');
  const nameEl = document.getElementById('group-breadcrumb-name');
  if (!breadcrumb) return;
  if (viewMode === 'groups' && activeGroup) {
    breadcrumb.hidden = false;
    if (labelEl) labelEl.textContent = groupByMode === 'year' ? 'Year:' : 'Group:';
    if (nameEl) nameEl.textContent = activeGroup;
  } else {
    breadcrumb.hidden = true;
  }
}

export function isGroupsMode() {
  return viewMode === 'groups';
}

export function getActiveGroup() {
  return activeGroup;
}

// Pieces without a valid createdDate have no year bucket to belong to.
function getItemYear(item) {
  const year = new Date(item.createdDate).getFullYear();
  return Number.isNaN(year) ? null : String(year);
}

// The artwork list pagination/lightbox should walk: everything filtered in
// grid mode, or only the active group's/year's items when one is selected.
export function getScopedArtwork() {
  if (viewMode === 'groups' && activeGroup) {
    if (groupByMode === 'year') {
      return filteredArtwork.filter(item => getItemYear(item) === activeGroup);
    }
    return filteredArtwork.filter(item => Array.isArray(item.groups) && item.groups.includes(activeGroup));
  }
  return filteredArtwork;
}

export function computeGroupBoxes() {
  const groups = new Map();

  if (groupByMode === 'year') {
    filteredArtwork.forEach(item => {
      const year = getItemYear(item);
      if (!year) return;
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(item);
    });

    return [...groups.entries()]
      .map(([name, items]) => ({
        name,
        count: items.length,
        cover: items.slice().sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))[0]
      }))
      .sort((a, b) => b.name.localeCompare(a.name));
  }

  filteredArtwork.forEach(item => {
    if (!Array.isArray(item.groups)) return;
    item.groups.forEach(name => {
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(item);
    });
  });

  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      count: items.length,
      cover: items.slice().sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))[0]
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function renderGroupBoxes(boxes) {
  const gallery = document.getElementById('gallery');
  gallery.classList.add('is-groups-view');
  gallery.innerHTML = '';

  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');

  if (boxes.length === 0) {
    if (emptyTitle) emptyTitle.textContent = "No groups yet...";
    if (emptyDesc) emptyDesc.textContent = "No artwork matches your search or filters, or none has been grouped yet.";
    if (emptyState) emptyState.hidden = false;
    return;
  }

  if (emptyState) emptyState.hidden = true;

  boxes.forEach(box => {
    const article = document.createElement('article');
    article.className = 'art-card group-card';
    article.tabIndex = 0;

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'art-card-image-wrapper group-card-image-wrapper';

    const img = document.createElement('img');
    img.src = box.cover.thumbnailUrl;
    img.alt = '';
    img.loading = 'lazy';
    imgWrapper.appendChild(img);

    const countBadge = document.createElement('span');
    countBadge.className = 'group-card-count';
    countBadge.textContent = `${box.count} ${box.count === 1 ? 'piece' : 'pieces'}`;
    imgWrapper.appendChild(countBadge);

    const overlay = document.createElement('div');
    overlay.className = 'card-overlay group-card-overlay';

    const title = document.createElement('h3');
    title.textContent = box.name;
    overlay.appendChild(title);

    article.appendChild(imgWrapper);
    article.appendChild(overlay);

    const open = () => selectGroup(box.name);
    article.addEventListener('click', open);
    article.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') open();
    });

    gallery.appendChild(article);
  });
}

export function clearGroupsViewClass() {
  document.getElementById('gallery').classList.remove('is-groups-view');
}
