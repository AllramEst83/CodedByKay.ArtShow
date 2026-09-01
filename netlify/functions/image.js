const fs = require('fs');
const path = require('path');

// Try loading dotenv for local execution if present
try {
  require('dotenv').config();
} catch (e) {
  // In Netlify production, process.env values are set via Netlify Dashboard / CLI
}

// Parse allowed site URLs / origins from process.env.ALLOWED_ORIGINS (defined in .env)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(url => url.trim().toLowerCase())
  .filter(Boolean);

// Serves the artwork metadata catalog. Raw artwork files (images and video)
// are no longer proxied through this function — they're static assets under
// assets/drawings/, served directly by the Netlify CDN and gated by
// netlify/edge-functions/media-gate.js.
exports.handler = async (event) => {
  const headers = event.headers || {};
  // Origin or Referer header sent by the client browser
  const requestOrigin = headers.origin || headers.referer || '';

  // Security Check: URL Whitelist from .env file (ALLOWED_ORIGINS)
  if (ALLOWED_ORIGINS.length > 0 && requestOrigin) {
    const isAllowedOrigin = ALLOWED_ORIGINS.some(allowed => {
      try {
        const allowedHost = new URL(allowed).host;
        const reqHost = new URL(requestOrigin).host;
        return reqHost === allowedHost || requestOrigin.toLowerCase().startsWith(allowed);
      } catch {
        return requestOrigin.toLowerCase().includes(allowed);
      }
    });

    if (!isAllowedOrigin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied: Request origin is not in the ALLOWED_ORIGINS URL whitelist' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }
  }

  try {
    const dataPath = path.resolve(process.cwd(), 'netlify', 'functions', 'data', 'artwork.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': requestOrigin ? requestOrigin : '*',
      },
      body: rawData,
    };
  } catch (err) {
    console.error('[image fn] error reading metadata:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to read server metadata' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
