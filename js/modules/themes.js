export const THEMES = ['neo-brutalism', 'neumorphism', 'glassmorphism', 'material', 'claymorphism', 'synthwave'];

export function applyTheme(themeName) {
  if (THEMES.includes(themeName)) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('artshow-theme', themeName);
  }
}

export function initTheme() {
  const savedTheme = localStorage.getItem('artshow-theme') || 'glassmorphism';
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
    localStorage.setItem('artshow-background', backgroundName);
  }
}

export function initBackground() {
  const savedBackground = localStorage.getItem('artshow-background') || 'default';
  applyBackground(savedBackground);

  const selector = document.getElementById('background-selector');
  if (selector) {
    selector.value = savedBackground;
    selector.addEventListener('change', (e) => {
      applyBackground(e.target.value);
    });
  }
}
