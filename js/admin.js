/**
 * admin.js — User management page logic
 *
 * Responsibilities:
 *   1. Init theme + auth widget
 *   2. After Identity initialises, verify the current user is an admin —
 *      redirect to / if not.
 *   3. Load the user list from the admin-users serverless function.
 *   4. Render an interactive user table with delete actions.
 *   5. Handle the invite modal flow.
 */

import { initTheme }  from './modules/themes.js';
import { initAuth }   from './modules/auth.js';

const API = '/.netlify/functions/admin-users';

// ── Admin check (client-side guard — server enforces too) ──────────────────

function isAdminUser(user) {
  // Role-only check — no hardcoded emails in client code.
  // The server (admin-users.js) is the real security gate.
  return (user?.app_metadata?.roles ?? []).includes('admin');
}

// ── API helpers ────────────────────────────────────────────────────────────

async function getToken() {
  const user = window.netlifyIdentity?.currentUser?.();
  if (!user) return null;
  return user.jwt(); // auto-refreshes if expired
}

async function apiFetch(path = '', options = {}) {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (options.method === 'DELETE') return null;
  return res.json();
}

// ── Table rendering ────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function renderTable(users, wrap) {
  if (!users.length) {
    wrap.innerHTML = '<p class="empty-users">No users yet. Use "+ Invite User" to add someone.</p>';
    return;
  }

  wrap.innerHTML = `
    <table class="users-table">
      <thead>
        <tr>
          <th scope="col">Email</th>
          <th scope="col">Created</th>
          <th scope="col">Last Login</th>
          <th scope="col">Roles</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        ${users.map((u) => `
          <tr data-user-id="${u.id}">
            <td>${u.email}</td>
            <td>${formatDate(u.created_at)}</td>
            <td>${formatDate(u.last_sign_in_at)}</td>
            <td>${(u.app_metadata?.roles ?? []).join(', ') || '—'}</td>
            <td>
              <button
                class="delete-btn"
                data-id="${u.id}"
                data-email="${u.email}"
                aria-label="Delete ${u.email}"
              >Delete</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  // Bind delete buttons
  wrap.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { id, email } = btn.dataset;
      if (!confirm(`Delete user ${email}?\n\nThis cannot be undone.`)) return;
      btn.disabled = true;
      btn.textContent = 'Deleting…';
      try {
        await apiFetch(`?id=${id}`, { method: 'DELETE' });
        await refreshUsers();
      } catch (e) {
        alert(`Failed to delete: ${e.message}`);
        btn.disabled = false;
        btn.textContent = 'Delete';
      }
    });
  });
}

async function refreshUsers() {
  const wrap = document.getElementById('users-table-wrap');
  try {
    const users = await apiFetch();
    renderTable(users, wrap);
  } catch (e) {
    wrap.innerHTML = `<p class="admin-error">Failed to load users: ${e.message}</p>`;
  }
}

// ── Invite modal ───────────────────────────────────────────────────────────

function openInviteModal() {
  const modal = document.getElementById('invite-modal');
  modal.hidden = false;
  document.getElementById('invite-email').value = '';
  document.getElementById('invite-error').hidden = true;
  document.getElementById('invite-email').focus();
}

function closeInviteModal() {
  document.getElementById('invite-modal').hidden = true;
  document.getElementById('invite-error').hidden = true;
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // Register the admin guard BEFORE initAuth() calls netlifyIdentity.init()
  // (the 'init' event fires synchronously if no session is stored)
  window.netlifyIdentity.on('init', async (user) => {
    if (!user || !isAdminUser(user)) {
      // Not logged in or not an admin → go home
      window.location.replace('/');
      return;
    }

    const loading = document.getElementById('admin-loading');
    const content = document.getElementById('admin-content');
    loading.hidden = true;
    content.hidden = false;
    await refreshUsers();
  });

  // initAuth() calls netlifyIdentity.init() internally — must come AFTER .on('init')
  initAuth();

  // ── Invite flow ──────────────────────────────────────────────────────────

  document.getElementById('invite-btn').addEventListener('click', openInviteModal);
  document.getElementById('invite-cancel-btn').addEventListener('click', closeInviteModal);

  // Close modal on backdrop click
  document.getElementById('invite-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeInviteModal();
  });

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('invite-modal').hidden) {
      closeInviteModal();
    }
  });

  document.getElementById('invite-submit-btn').addEventListener('click', async () => {
    const email     = document.getElementById('invite-email').value.trim();
    const errEl     = document.getElementById('invite-error');
    const submitBtn = document.getElementById('invite-submit-btn');

    errEl.hidden = true;

    if (!email) {
      errEl.textContent = 'Please enter an email address.';
      errEl.hidden = false;
      document.getElementById('invite-email').focus();
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Sending…';

    try {
      await apiFetch('', {
        method: 'POST',
        body: JSON.stringify({ action: 'invite', email }),
      });
      closeInviteModal();
      await refreshUsers();
    } catch (e) {
      errEl.textContent = `Failed to invite: ${e.message}`;
      errEl.hidden = false;
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Send Invite';
    }
  });

  // Allow submitting the invite form with Enter
  document.getElementById('invite-email').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('invite-submit-btn').click();
  });
});
