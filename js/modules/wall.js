import { storageService } from './storage.js';

export const WALLS = ['dark', 'gray', 'paper'];
const DEFAULT_WALL = 'dark';
const STORAGE_KEY = 'wall';
const THEME_COLORS = { dark: '#0f0f10', gray: '#a9a9ae', paper: '#f3eee4' };

// Pre-redesign keys, migrated once then deleted.
const LEGACY_BACKGROUND_KEY = 'artshow-background';
const LEGACY_THEME_KEY = 'artshow-theme';
const LEGACY_BACKGROUND_MAP = { dark: 'dark', gray: 'gray', light: 'paper' };

function migrateLegacy() {
  try {
    const legacyBg = localStorage.getItem(LEGACY_BACKGROUND_KEY);
    if (legacyBg !== null && storageService.get(STORAGE_KEY) === null) {
      const mapped = LEGACY_BACKGROUND_MAP[legacyBg];
      if (mapped) storageService.set(STORAGE_KEY, mapped);
    }
    localStorage.removeItem(LEGACY_BACKGROUND_KEY);
    localStorage.removeItem(LEGACY_THEME_KEY);
    storageService.remove('hide_ads');
  } catch {
    // storage blocked — nothing to migrate
  }
}

export function applyWall(wall, { persist = true } = {}) {
  if (!WALLS.includes(wall)) return;
  document.documentElement.setAttribute('data-wall', wall);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[wall]);
  if (persist) storageService.set(STORAGE_KEY, wall);
  document.querySelectorAll('[data-wall-option]').forEach((btn) => {
    const active = btn.dataset.wallOption === wall;
    btn.setAttribute('aria-checked', String(active));
    btn.tabIndex = active ? 0 : -1;
  });
}

export function initWall() {
  migrateLegacy();
  initWallMenu();
  const saved = storageService.get(STORAGE_KEY);
  const wall = WALLS.includes(saved) ? saved : DEFAULT_WALL;
  applyWall(wall, { persist: false });

  // One control in the header and one inside the viewer; each is its own radiogroup.
  document.querySelectorAll('.wall-switch').forEach((group) => {
    const options = [...group.querySelectorAll('[data-wall-option]')];
    options.forEach((btn, i) => {
      btn.addEventListener('click', () => applyWall(btn.dataset.wallOption));
      btn.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        // The viewer's own key handler must not also treat this as navigation.
        e.preventDefault();
        e.stopPropagation();
        const next = options[(i + step + options.length) % options.length];
        applyWall(next.dataset.wallOption);
        next.focus();
      });
    });
  });
}

// Phones collapse the header swatches behind #wall-toggle (CSS decides when the
// toggle is visible); this just opens/closes the popover.
function initWallMenu() {
  const menu = document.getElementById('wall-menu');
  const toggle = document.getElementById('wall-toggle');
  if (!menu || !toggle) return;

  const setOpen = (open, { restoreFocus = false } = {}) => {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (!open && restoreFocus) toggle.focus();
  };

  toggle.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    setOpen(open);
    if (open) menu.querySelector('[aria-checked="true"]')?.focus();
  });
  // Picking a wall is the whole job of the popover: apply, then get out of the way.
  menu.addEventListener('click', (e) => {
    if (e.target.closest('[data-wall-option]')) setOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) setOpen(false);
  });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false, { restoreFocus: true });
  });
}
