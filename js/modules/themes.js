export const THEMES = ['neo-brutalism', 'neumorphism', 'glassmorphism', 'material', 'claymorphism'];

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
