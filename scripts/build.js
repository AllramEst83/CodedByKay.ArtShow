/**
 * build.js — Production Build Script
 *
 * Packages production assets (index.html, css/, js/, assets/, netlify/) into dist/
 * explicitly excluding dev-only files like editor.html and scripts/.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const EXCLUDE = new Set([
  'editor.html',
  'scripts',
  'dist',
  'node_modules',
  '.git',
  '.github',
  '.netlify',
  'package-lock.json'
]);

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      if (EXCLUDE.has(item) || item.startsWith('.')) continue;
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('[build] Preparing production dist folder...');
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true, force: true });
}
fs.mkdirSync(DIST, { recursive: true });

copyRecursive(ROOT, DIST);

// Also copy netlify.toml redirect rules file to dist if needed or verify
console.log('[build] Production build complete in dist/ (editor.html excluded).');
