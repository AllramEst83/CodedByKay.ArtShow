const PREFIX = 'artshow_';

function buildKey(key) {
  return `${PREFIX}${key}`;
}

export const storageService = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(buildKey(key));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(buildKey(key), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(buildKey(key));
    } catch {
      // ignore
    }
  },
};
