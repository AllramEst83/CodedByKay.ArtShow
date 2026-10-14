// Tiny shared state. Views write what they are showing; the viewer reads the
// list it should walk. Replaces the module-scope variables that used to be
// spread across gallery/groups/filters/pagination.

const state = {
  artwork: [],      // every normalised item, in artwork.json order
  collections: [],  // derived collection summaries
  years: [],        // derived { year, count }, newest first
  list: [],         // the list currently on screen (viewer sequence)
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
