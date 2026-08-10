/**
 * list-images.js — Netlify Function
 *
 * Recursively scans assets/drawngs/ and returns a JSON array of relative paths
 * (e.g. ["2009/my-son.jpg", "2010/mom-and-grandma.jpg"]).
 */

const fs   = require('fs');
const path = require('path');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

function walkDir(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of list) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXTENSIONS.has(ext)) {
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        results.push(relPath);
      }
    }
  }

  return results;
}

exports.handler = async (event) => {
  const origin = (event.headers || {}).origin || '*';

  // Guard: local dev only
  if (process.env.NETLIFY_DEV !== 'true') {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'This endpoint is only available in local dev mode.' }),
    };
  }

  try {
    const baseDir = path.resolve(process.cwd(), 'assets', 'drawngs');
    const files   = walkDir(baseDir);
    files.sort();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': origin,
      },
      body: JSON.stringify(files),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Could not read images directory: ' + err.message }),
    };
  }
};
