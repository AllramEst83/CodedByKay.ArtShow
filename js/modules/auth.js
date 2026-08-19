/**
 * auth.js — Netlify Identity client-side integration
 *
 * Strategy: render the sign-in button IMMEDIATELY so it always shows up,
 * then let the identity widget update the UI once it initialises.
 * This makes the UI resilient to slow/failed CDN loads.
 */

export function initAuth() {
  const control = document.getElementById('auth-control');
  if (!control) {
    console.warn('[auth] #auth-control not found in DOM');
    return;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  function getInitials(email = '') {
    return email.slice(0, 2).toUpperCase();
  }

  function isAdminUser(user) {
    // Check only the 'admin' role from app_metadata.
    // app_metadata is server-set (read-only from client) so this is safe to
    // check here. We do NOT hardcode email addresses in client code —
    // the server-side function is the actual security gate.
    return (user?.app_metadata?.roles ?? []).includes('admin');
  }

  // ── Builders ───────────────────────────────────────────────────────────

  function buildSignInBtn() {
    return `
      <button id="auth-signin-btn" class="btn auth-signin-btn" aria-label="Sign in">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        Sign In
      </button>`;
  }

  function buildAvatar(user) {
    const initials = getInitials(user.email);
    const admin    = isAdminUser(user);
    return `
      <div class="auth-avatar-wrap" id="auth-avatar-wrap">
        <button
          class="auth-avatar-btn"
          id="auth-avatar-btn"
          aria-haspopup="true"
          aria-expanded="false"
          aria-label="Account menu"
          title="${user.email}"
        >
          <span class="auth-avatar" aria-hidden="true">${initials}</span>
        </button>
        <div class="auth-menu" id="auth-menu" hidden role="menu" aria-label="Account options">
          <span class="auth-menu-email">${user.email}</span>
          ${admin
            ? `<a href="/admin" class="auth-menu-item" role="menuitem">User Management</a>`
            : ''}
          <button class="auth-menu-item auth-signout-btn" id="auth-signout-btn" role="menuitem">
            Sign Out
          </button>
        </div>
      </div>`;
  }

  // ── Event binding ──────────────────────────────────────────────────────

  function bindEvents(user) {
    if (!user) {
      document.getElementById('auth-signin-btn')?.addEventListener('click', () => {
        const ni = window.netlifyIdentity;
        if (ni) {
          ni.open('login');
        } else {
          console.warn('[auth] netlifyIdentity not available — cannot open login modal');
        }
      });
      return;
    }

    const avatarBtn = document.getElementById('auth-avatar-btn');
    const menu      = document.getElementById('auth-menu');

    avatarBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menu.hidden;
      menu.hidden  = isOpen;
      avatarBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('auth-avatar-wrap');
      if (menu && !menu.hidden && !wrap?.contains(e.target)) {
        menu.hidden = true;
        avatarBtn?.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu && !menu.hidden) {
        menu.hidden = true;
        avatarBtn?.setAttribute('aria-expanded', 'false');
        avatarBtn?.focus();
      }
    });

    document.getElementById('auth-signout-btn')?.addEventListener('click', () => {
      window.netlifyIdentity?.logout();
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────

  function render(user) {
    console.log('[auth] render called, user:', user ? user.email : 'null');
    control.innerHTML = user ? buildAvatar(user) : buildSignInBtn();
    bindEvents(user);
  }

  // ── Step 1: Render sign-in button IMMEDIATELY ─────────────────────────
  // Don't wait for identity — button always shows up right away.
  render(null);

  // ── Step 2: Hook up identity widget if available ──────────────────────
  const ni = window.netlifyIdentity;
  if (!ni) {
    console.warn('[auth] window.netlifyIdentity not found — CDN script may not have loaded');
    return;
  }

  console.log('[auth] netlifyIdentity found, registering events then calling init()');

  // IMPORTANT: register handlers BEFORE init() — init fires synchronously
  // when no session exists, so handlers registered after would miss the event.
  ni.on('init',  (user) => {
    console.log('[auth] init event fired, user:', user ? user.email : 'null');
    render(user);
  });
  ni.on('login', (user) => {
    console.log('[auth] login event fired');
    ni.close();
    render(user);
  });
  ni.on('logout', () => {
    console.log('[auth] logout event fired');
    render(null);
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
      window.location.href = '/';
    }
  });
  ni.on('error', (err) => console.error('[auth] Identity error:', err));

  ni.init();
}
