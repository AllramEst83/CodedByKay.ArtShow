function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
}

export const THEMES = ['neo-brutalism', 'neumorphism', 'glassmorphism', 'material', 'claymorphism', 'synthwave'];

export function applyTheme(themeName) {
  if (THEMES.includes(themeName)) {
    document.documentElement.setAttribute('data-theme', themeName);
    safeSet('artshow-theme', themeName);
  }
}

export function initTheme() {
  const savedTheme = safeGet('artshow-theme') || 'glassmorphism';
  applyTheme(savedTheme);
  
  const selector = document.getElementById('theme-selector');
  if (selector) {
    selector.value = savedTheme;
    selector.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  }
}

export const BACKGROUNDS = ['default', 'dark', 'gray', 'light'];

export function applyBackground(backgroundName) {
  if (BACKGROUNDS.includes(backgroundName)) {
    document.documentElement.setAttribute('data-bg', backgroundName);
    safeSet('artshow-background', backgroundName);
  }
}

export function initBackground() {
  const savedBackground = safeGet('artshow-background') || 'default';
  applyBackground(savedBackground);

  const selector = document.getElementById('background-selector');
  if (selector) {
    selector.value = savedBackground;
    selector.addEventListener('change', (e) => {
      applyBackground(e.target.value);
    });
  }
}
