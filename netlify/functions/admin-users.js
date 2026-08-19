/**
 * admin-users.js — Netlify Function
 *
 * Exposes admin CRUD operations for Netlify Identity users via the GoTrue
 * Admin HTTP API. Only reachable by authenticated admin users.
 *
 * Endpoints:
 *   GET    /.netlify/functions/admin-users         → list users
 *   POST   /.netlify/functions/admin-users         → invite user  { action: 'invite', email }
 *   DELETE /.netlify/functions/admin-users?id=<id> → delete user
 *
 * Security model:
 *   1. Netlify automatically verifies the Authorization: Bearer JWT and injects
 *      the decoded payload into context.clientContext.user.
 *   2. We additionally check the caller's email against ADMIN_EMAILS env var
 *      (or the kaywib@gmail.com fallback) as a second gate.
 *   3. The short-lived admin bearer token (context.clientContext.identity.token)
 *      is used to make GoTrue admin calls — it never leaves the server.
 */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'kaywib@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// ── Authorization check ────────────────────────────────────────────────────

function isAdmin(clientContext) {
  const user = clientContext?.user;
  if (!user) return false;

  const roles = user.app_metadata?.roles ?? [];
  const email = (user.email ?? '').toLowerCase();

  return roles.includes('admin') || ADMIN_EMAILS.includes(email);
}

// ── GoTrue HTTP helper ─────────────────────────────────────────────────────

async function gotrueRequest(url, method, body, adminToken) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`GoTrue ${method} ${url} → ${res.status}: ${text}`);
  }

  return method === 'DELETE' ? null : res.json();
}

// ── Response helpers ───────────────────────────────────────────────────────

function json(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  const { clientContext } = context;

  // 1. Authentication + authorisation
  if (!isAdmin(clientContext)) {
    console.warn('[admin-users] Forbidden — caller is not an admin');
    return json(403, { error: 'Forbidden' });
  }

  // 2. Get the short-lived admin token injected by Netlify Identity
  const adminToken = clientContext?.identity?.token;
  if (!adminToken) {
    console.error('[admin-users] No identity.token in clientContext');
    return json(401, { error: 'Admin token unavailable — ensure Netlify Identity is enabled' });
  }

  // 3. Base URL for GoTrue admin API (auto-injected by Netlify)
  const identityUrl = (clientContext?.identity?.url ?? '').replace(/\/$/, '');
  if (!identityUrl) {
    console.error('[admin-users] identity.url is empty');
    return json(500, { error: 'Identity URL unavailable' });
  }

  const usersUrl = `${identityUrl}/admin/users`;

  try {
    // ── GET: list all users ──────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const data = await gotrueRequest(usersUrl, 'GET', undefined, adminToken);
      return json(200, data.users ?? []);
    }

    // ── POST: invite a user ──────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { action, email } = body;

      if (action !== 'invite' || !email) {
        return json(400, { error: 'Invalid request — expected { action: "invite", email }' });
      }

      const invited = await gotrueRequest(
        `${identityUrl}/admin/invite`,
        'POST',
        { email },
        adminToken,
      );
      return json(200, { ok: true, user: invited });
    }

    // ── DELETE: remove a user ────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      const userId = event.queryStringParameters?.id;
      if (!userId) {
        return json(400, { error: 'Missing query param: id' });
      }

      await gotrueRequest(`${usersUrl}/${userId}`, 'DELETE', undefined, adminToken);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[admin-users] Error:', err.message);
    return json(500, { error: err.message });
  }
};
