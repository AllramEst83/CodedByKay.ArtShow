// Share links for individual artworks: /art/<id>?v=<version>.
//
// The path opens that artwork in the viewer (see lightbox.js) and is what the
// netlify/edge-functions/share-preview.js function builds link-preview cards
// from. `v` is a short hash of the fields shown in the preview: it is stable
// while the artwork is unchanged, and changes when its title, description or
// image does, so chat apps (which cache previews hard) fetch a fresh card.

const ART_PATH = /^\/art\/([^/]+)\/?$/;

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function getShareVersion(item) {
  return hash([item.title, item.description, item.thumbnailUrl || item.imageUrl].join('|'));
}

export function getArtworkPath(item) {
  return `/art/${encodeURIComponent(item.id)}`;
}

export function getShareUrl(item) {
  return `${window.location.origin}${getArtworkPath(item)}?v=${getShareVersion(item)}`;
}

export function getArtworkIdFromLocation() {
  const match = window.location.pathname.match(ART_PATH);
  return match ? decodeURIComponent(match[1]) : null;
}

function copyWithTextarea(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

// Resolves to 'shared' | 'copied' | 'cancelled' | 'failed'.
export async function shareArtwork(item) {
  const url = getShareUrl(item);

  if (navigator.share) {
    try {
      await navigator.share({ title: item.title, text: item.title, url });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // Any other failure: fall through to copying the link instead.
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return copyWithTextarea(url) ? 'copied' : 'failed';
  }
}

let toastTimer = null;

export function showToast(message) {
  // Inside native fullscreen only the fullscreened subtree renders.
  const host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
  let toast = document.getElementById('share-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'share-toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
  }
  if (toast.parentElement !== host) host.appendChild(toast);
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}
