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
  const saved = storageService.get(STORAGE_KEY);
  const wall = WALLS.includes(saved) ? saved : DEFAULT_WALL;
  applyWall(wall, { persist: false });

  const group = document.getElementById('wall-switch');
  if (!group) return;
  const options = [...group.querySelectorAll('[data-wall-option]')];

  options.forEach((btn, i) => {
    btn.addEventListener('click', () => applyWall(btn.dataset.wallOption));
    btn.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = options[(i + step + options.length) % options.length];
      applyWall(next.dataset.wallOption);
      next.focus();
    });
  });
}
