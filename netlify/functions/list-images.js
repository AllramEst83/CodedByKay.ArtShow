/**
 * list-images.js — Netlify Function
 *
 * Returns a JSON array of filenames found in assets/drawngs/.
 * Used by the editor to detect images not yet in artwork.json.
 */

const fs   = require('fs');
const path = require('path');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

exports.handler = async (event) => {
  const origin = (event.headers || {}).origin || '*';

  try {
    const dir   = path.resolve(process.cwd(), 'assets', 'drawngs');
    const files = fs.readdirSync(dir).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ALLOWED_EXTENSIONS.has(ext) && !f.startsWith('.');
    });

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
