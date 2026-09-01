import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

// Parse allowed site URLs / origins from process.env.ALLOWED_ORIGINS (defined in .env)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((url) => url.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_EXTENSIONS = new Set(['.mp4', '.webm']);

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// Netlify streaming function responses are capped at 20MB. Clamp every chunk
// well under that so large videos always fit, regardless of what range (or no
// range at all) a client asks for — the client just requests the next chunk.
const MAX_CHUNK_SIZE = 8 * 1024 * 1024;

function isAllowedOrigin(requestOrigin) {
  if (ALLOWED_ORIGINS.length === 0 || !requestOrigin) return true;
  return ALLOWED_ORIGINS.some((allowed) => {
    try {
      const allowedHost = new URL(allowed).host;
      const reqHost = new URL(requestOrigin).host;
      return reqHost === allowedHost || requestOrigin.toLowerCase().startsWith(allowed);
    } catch {
      return requestOrigin.toLowerCase().includes(allowed);
    }
  });
}

function jsonError(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (req) => {
  const requestOrigin = req.headers.get('origin') || req.headers.get('referer') || '';

  // Security Check 1: URL Whitelist from .env file (ALLOWED_ORIGINS)
  if (!isAllowedOrigin(requestOrigin)) {
    return jsonError(403, 'Access denied: Request origin is not in the ALLOWED_ORIGINS URL whitelist');
  }

  const file = new URL(req.url).searchParams.get('file');
  if (!file) return jsonError(400, 'Missing file parameter');

  // Normalize relative file subpath (e.g. "2026/elephant_man_v1_video.mp4")
  const normalizedSubpath = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
  const basename = path.basename(normalizedSubpath);
  const ext = path.extname(basename).toLowerCase();

  // Security Check 2: Block hidden files and .env files
  if (basename.startsWith('.') || basename.toLowerCase().includes('env')) {
    return jsonError(403, 'Access denied: Invalid filename');
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return jsonError(415, `Unsupported file type: ${ext}`);
  }

  // Resolve path relative to assets/drawings
  const assetsDir = path.resolve(process.cwd(), 'assets', 'drawings');
  const filePath = path.resolve(assetsDir, normalizedSubpath);

  // Double-check the resolved path is strictly inside assets/drawings
  if (!filePath.startsWith(assetsDir + path.sep) && filePath !== assetsDir) {
    return jsonError(403, 'Forbidden');
  }

  if (!existsSync(filePath)) {
    return jsonError(404, `File not found: ${basename}`);
  }

  const fileSize = statSync(filePath).size;
  const contentType = MIME_TYPES[ext];

  let start = 0;
  let requestedEnd = null;
  const rangeHeader = req.headers.get('range');
  if (rangeHeader) {
    const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (matches) {
      start = parseInt(matches[1], 10);
      if (matches[2]) requestedEnd = parseInt(matches[2], 10);
    }
  }

  if (start >= fileSize) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${fileSize}` },
    });
  }

  // Respect an explicit small range (e.g. a browser's initial probe request),
  // but never hand back more than one chunk's worth in a single response —
  // clamp open-ended or oversized requests to MAX_CHUNK_SIZE.
  const cappedEnd = Math.min(start + MAX_CHUNK_SIZE - 1, fileSize - 1);
  const end = requestedEnd !== null ? Math.min(requestedEnd, cappedEnd) : cappedEnd;
  const chunkSize = end - start + 1;

  const nodeStream = createReadStream(filePath, { start, end });

  return new Response(Readable.toWeb(nodeStream), {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(chunkSize),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
