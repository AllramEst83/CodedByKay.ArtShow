/**
 * save-artwork.js — LOCAL DEV ONLY Netlify Function
 *
 * Writes the submitted artwork JSON back to:
 *   netlify/functions/data/artwork.json
 *
 * This function is intentionally guarded to only operate when
 * NETLIFY_DEV=true is present (automatically set by `netlify dev`).
 * It will return 403 in any other environment.
 */

const fs   = require('fs');
const path = require('path');

exports.handler = async (event) => {
  // ── Guard: only allow in local Netlify Dev ──────────────────────────────
  const isLocalDev = process.env.NETLIFY_DEV === 'true';
  if (!isLocalDev) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'This endpoint is only available in local dev mode.' }),
    };
  }

  // ── Allow CORS preflight ─────────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' }),
    };
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let artwork;
  try {
    artwork = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      body: JSON.stringify({ error: 'Invalid JSON body.' }),
    };
  }

  if (!Array.isArray(artwork)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      body: JSON.stringify({ error: 'Expected an array of artwork objects.' }),
    };
  }

  // ── Write to disk ────────────────────────────────────────────────────────
  const dataPath = path.resolve(
    process.cwd(),
    'netlify', 'functions', 'data', 'artwork.json'
  );

  try {
    fs.writeFileSync(dataPath, JSON.stringify(artwork, null, 2), 'utf-8');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      body: JSON.stringify({ ok: true, saved: artwork.length }),
    };
  } catch (err) {
    console.error('[save-artwork] write error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      body: JSON.stringify({ error: 'Failed to write artwork.json', detail: err.message }),
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
