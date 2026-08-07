const fs = require('fs');
const path = require('path');

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
  const { file } = event.queryStringParameters || {};

  if (!file) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required query parameter: file' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Security: strip any directory components — only bare filenames allowed.
  const basename = path.basename(file);
  const ext = path.extname(basename).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      statusCode: 415,
      body: JSON.stringify({ error: `Unsupported file type: ${ext}` }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Resolve path relative to the repo root (process.cwd() in Netlify)
  const filePath = path.resolve(process.cwd(), 'assets', 'drawngs', basename);

  // Double-check the resolved path is still inside the expected directory
  const assetsDir = path.resolve(process.cwd(), 'assets', 'drawngs');
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
