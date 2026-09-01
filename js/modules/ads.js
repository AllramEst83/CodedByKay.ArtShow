import { storageService } from './storage.js';

const HIDE_ADS_KEY = 'hide_ads';

export function initAdsToggle() {
  const toggle = document.getElementById('ads-toggle');
  if (!toggle) return;

  const hideAds = storageService.get(HIDE_ADS_KEY, false);
  toggle.checked = hideAds;
  applyAdsVisibility(hideAds);

  toggle.addEventListener('change', () => {
    applyAdsVisibility(toggle.checked);
    storageService.set(HIDE_ADS_KEY, toggle.checked);
  });
}

function applyAdsVisibility(hideAds) {
  document.documentElement.classList.toggle('hide-ads', hideAds);
  const toggle = document.getElementById('ads-toggle');
  if (toggle) toggle.setAttribute('aria-checked', String(hideAds));
}
