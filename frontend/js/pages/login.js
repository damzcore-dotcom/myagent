/**
 * DAMZ AGENT — Login Page
 * Premium authentication screen with Obsidian Sentinel aesthetic.
 */

import { $, sleep } from '../utils/helpers.js';

export function render() {
  return `
    <div class="login-page">
      <div class="login-bg">
        <div class="login-grid-overlay"></div>
      </div>
      <div class="login-container">
        <div class="login-card">
          <!-- Logo -->
          <div class="login-logo">
            <div class="login-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2"/>
                <circle cx="12" cy="5" r="2"/>
                <path d="M12 7v4"/>
                <line x1="8" y1="16" x2="8" y2="16"/>
                <line x1="16" y1="16" x2="16" y2="16"/>
              </svg>
            </div>
            <div class="login-logo-text">DAMZ AGENT</div>
            <div class="login-logo-sub">v2.0.0 · SMART Personal Ai Assistant</div>
          </div>

          <!-- Login Form -->
          <form class="login-form" id="login-form">
            <div id="login-tab-content">
              <div class="login-tabs">
                <button type="button" class="login-tab active" data-tab="login">Sign In</button>
                <button type="button" class="login-tab" data-tab="register">Register</button>
              </div>

              <!-- Sign In Fields -->
              <div class="login-fields" id="login-fields">
                <div class="login-field">
                  <label class="login-label" for="login-email">Email</label>
                  <input type="email" class="input" id="login-email" placeholder="agent@damz.local" required autocomplete="email">
                </div>
                <div class="login-field">
                  <label class="login-label" for="login-password">Password</label>
                  <input type="password" class="input" id="login-password" placeholder="••••••••" required autocomplete="current-password">
                </div>
                <div class="login-remember">
                  <label class="login-checkbox-label">
                    <input type="checkbox" id="remember-me" checked>
                    <span>Remember me</span>
                  </label>
                </div>
              </div>

              <!-- Register Fields -->
              <div class="login-fields hidden" id="register-fields">
                <div class="login-field">
                  <label class="login-label" for="reg-name">Full Name</label>
                  <input type="text" class="input" id="reg-name" placeholder="Damz" autocomplete="name">
                </div>
                <div class="login-field">
                  <label class="login-label" for="reg-email">Email</label>
                  <input type="email" class="input" id="reg-email" placeholder="agent@damz.local" autocomplete="email">
                </div>
                <div class="login-field">
                  <label class="login-label" for="reg-password">Password</label>
                  <input type="password" class="input" id="reg-password" placeholder="Min 8 characters" autocomplete="new-password">
                </div>
              </div>
            </div>

            <!-- Error Message -->
            <div class="login-error hidden" id="login-error"></div>

            <!-- Submit -->
            <button type="submit" class="btn btn-primary btn-lg login-submit" id="login-submit">
              <span id="login-btn-text">Sign In</span>
              <span class="login-spinner hidden" id="login-spinner"></span>
            </button>
          </form>

          <!-- Footer -->
          <div class="login-footer">
            <div class="login-footer-line">
              <span class="login-footer-dot"></span>
              <span>100% Local · Zero Cloud Leakage</span>
            </div>
            <div class="login-footer-ascii">━━━ Obsidian Sentinel ━━━</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function mount(onLogin) {
  const form = $('#login-form');
  const tabs = document.querySelectorAll('.login-tab');
  const loginFields = $('#login-fields');
  const registerFields = $('#register-fields');
  const submitBtn = $('#login-submit');
  const btnText = $('#login-btn-text');
  const spinner = $('#login-spinner');
  const errorEl = $('#login-error');

  let currentTab = 'login';

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === currentTab));

      if (currentTab === 'login') {
        loginFields.classList.remove('hidden');
        registerFields.classList.add('hidden');
        btnText.textContent = 'Sign In';
      } else {
        loginFields.classList.add('hidden');
        registerFields.classList.remove('hidden');
        btnText.textContent = 'Create Account';
      }

      errorEl.classList.add('hidden');
    });
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    btnText.textContent = currentTab === 'login' ? 'Signing in...' : 'Creating account...';
    spinner.classList.remove('hidden');

    try {
      if (currentTab === 'login') {
        const email = $('#login-email').value.trim();
        const password = $('#login-password').value;

        if (!email || !password) {
          throw new Error('Please fill in all fields');
        }

        // Try better-auth API
        const res = await fetch('http://127.0.0.1:3001/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Invalid email or password');
        }

        const data = await res.json();
        localStorage.setItem('damz_session', JSON.stringify({
          user: data.user || { email, name: email.split('@')[0] },
          token: data.token || 'session',
          loggedInAt: new Date().toISOString(),
        }));

      } else {
        const name = $('#reg-name').value.trim();
        const email = $('#reg-email').value.trim();
        const password = $('#reg-password').value;

        if (!name || !email || !password) {
          throw new Error('Please fill in all fields');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }

        const res = await fetch('http://127.0.0.1:3001/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
          credentials: 'include',
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Registration failed');
        }

        const data = await res.json();
        localStorage.setItem('damz_session', JSON.stringify({
          user: data.user || { email, name },
          token: data.token || 'session',
          loggedInAt: new Date().toISOString(),
        }));
      }

      // Success — trigger navigation
      if (onLogin) onLogin();

    } catch (err) {
      // If backend not available, fallback to demo mode
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        // Demo mode — save mock session
        const email = currentTab === 'login' ? $('#login-email').value : $('#reg-email').value;
        const name = currentTab === 'register' ? $('#reg-name').value : email.split('@')[0];
        localStorage.setItem('damz_session', JSON.stringify({
          user: { email, name },
          token: 'demo-session',
          loggedInAt: new Date().toISOString(),
          demo: true,
        }));
        if (onLogin) onLogin();
        return;
      }

      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = currentTab === 'login' ? 'Sign In' : 'Create Account';
      spinner.classList.add('hidden');
    }
  });
}

export function unmount() {}

/** Check if user has a session. */
export function isAuthenticated() {
  const session = localStorage.getItem('damz_session');
  return !!session;
}

/** Get current user. */
export function getCurrentUser() {
  try {
    const session = JSON.parse(localStorage.getItem('damz_session'));
    return session?.user || null;
  } catch { return null; }
}

/** Log out — clear session. */
export function logout() {
  localStorage.removeItem('damz_session');
  // Try to call better-auth logout
  fetch('http://127.0.0.1:3001/api/auth/sign-out', { method: 'POST', credentials: 'include' }).catch(() => {});
}
