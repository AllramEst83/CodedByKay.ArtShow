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

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

const MIME_TYPES = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
};

exports.handler = async (event) => {
  const headers = event.headers || {};
  // Origin or Referer header sent by the client browser
  const requestOrigin = headers.origin || headers.referer || '';

  // Security Check 1: URL Whitelist from .env file (ALLOWED_ORIGINS)
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

  const { file, size } = event.queryStringParameters || {};

  // If no file parameter is provided, return all artwork metadata from the server-side database
  if (!file) {
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
  }

  // Normalize relative file subpath (e.g. "2010/mom-and-grandma.jpg" or "mom-and-grandma.jpg")
  const normalizedSubpath = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
  const basename = path.basename(normalizedSubpath);
  const ext = path.extname(basename).toLowerCase();

  // Security Check 2: Block hidden files and .env files
  if (basename.startsWith('.') || basename.toLowerCase().includes('env')) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Access denied: Invalid filename' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      statusCode: 415,
      body: JSON.stringify({ error: `Unsupported file type: ${ext}` }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Resolve path relative to assets/drawings
  const assetsDir = path.resolve(process.cwd(), 'assets', 'drawings');
  let filePath = path.resolve(assetsDir, normalizedSubpath);

  if (size === 'thumb') {
    const dirPath = path.dirname(normalizedSubpath);
    const thumbPath = path.resolve(assetsDir, dirPath, 'thumbs', basename);
    if (fs.existsSync(thumbPath)) {
      filePath = thumbPath;
    }
  }

  // Double-check the resolved path is strictly inside assets/drawings
  if (!filePath.startsWith(assetsDir + path.sep) && filePath !== assetsDir) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Forbidden' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const data = fs.readFileSync(filePath);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': MIME_TYPES[ext],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': requestOrigin ? requestOrigin : '*',
      },
      body: data.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Image not found: ${basename}` }),
        headers: { 'Content-Type': 'application/json' },
      };
    }
    console.error('[image fn] unexpected error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};

