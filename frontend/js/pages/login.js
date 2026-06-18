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
                <button type="button" class="login-tab active" data-tab="login">Masuk</button>
                <button type="button" class="login-tab" data-tab="register">Daftar</button>
              </div>

              <!-- Sign In Fields -->
              <div class="login-fields" id="login-fields">
                <div class="login-field">
                  <label class="login-label" for="login-email">Email</label>
                  <input type="email" class="input" id="login-email" placeholder="Masukkan alamat email" required autocomplete="email">
                </div>
                <div class="login-field">
                  <label class="login-label" for="login-password">Kata Sandi</label>
                  <input type="password" class="input" id="login-password" placeholder="Masukkan kata sandi" required autocomplete="current-password">
                </div>
                <div class="login-remember">
                  <label class="login-checkbox-label">
                    <input type="checkbox" id="remember-me" checked>
                    <span>Ingat saya</span>
                  </label>
                </div>
              </div>

              <!-- Register Fields -->
              <div class="login-fields hidden" id="register-fields">
                <div class="login-field">
                  <label class="login-label" for="reg-name">Nama Lengkap</label>
                  <input type="text" class="input" id="reg-name" placeholder="Masukkan nama lengkap Anda" autocomplete="name" required>
                </div>
                <div class="login-field">
                  <label class="login-label" for="reg-email">Email</label>
                  <input type="email" class="input" id="reg-email" placeholder="Masukkan alamat email" autocomplete="email" required>
                </div>
                <div class="login-field">
                  <label class="login-label" for="reg-password">Kata Sandi</label>
                  <input type="password" class="input" id="reg-password" placeholder="Masukkan kata sandi (min. 8 karakter)" autocomplete="new-password" required>
                  <!-- Password Strength Indicator -->
                  <div id="password-strength-container" class="hidden" style="margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <span style="font-size: 11px; font-family: var(--font-mono); color: var(--text-muted);">Kekuatan Sandi:</span>
                      <span id="password-strength-text" style="font-size: 11px; font-family: var(--font-mono); font-weight: bold;">Lemah</span>
                    </div>
                    <div style="display: flex; gap: 4px; height: 4px;">
                      <div class="strength-bar-segment" style="flex: 1; background: var(--border); border-radius: var(--radius); transition: background 0.3s;"></div>
                      <div class="strength-bar-segment" style="flex: 1; background: var(--border); border-radius: var(--radius); transition: background 0.3s;"></div>
                      <div class="strength-bar-segment" style="flex: 1; background: var(--border); border-radius: var(--radius); transition: background 0.3s;"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Error Message -->
            <div class="login-error hidden" id="login-error"></div>
            <!-- Success Message -->
            <div class="login-success hidden" id="login-success"></div>

            <!-- Submit -->
            <button type="submit" class="btn btn-primary btn-lg login-submit" id="login-submit">
              <span id="login-btn-text">Masuk</span>
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
  const successEl = $('#login-success');

  let currentTab = 'login';

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === currentTab));

      if (currentTab === 'login') {
        loginFields.classList.remove('hidden');
        registerFields.classList.add('hidden');
        btnText.textContent = 'Masuk';
      } else {
        loginFields.classList.add('hidden');
        registerFields.classList.remove('hidden');
        btnText.textContent = 'Daftar';
      }

      errorEl.classList.add('hidden');
      successEl.classList.add('hidden');
      if (strengthContainer) strengthContainer.classList.add('hidden');
    });
  });

  // Password strength logic
  const regPasswordInput = $('#reg-password');
  const strengthContainer = $('#password-strength-container');
  const strengthText = $('#password-strength-text');
  const strengthSegments = document.querySelectorAll('.strength-bar-segment');

  if (regPasswordInput && strengthContainer) {
    regPasswordInput.addEventListener('input', () => {
      const val = regPasswordInput.value;
      if (!val) {
        strengthContainer.classList.add('hidden');
        return;
      }
      strengthContainer.classList.remove('hidden');

      const score = calculatePasswordStrength(val);
      updateStrengthUI(score);
    });
  }

  function calculatePasswordStrength(pwd) {
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    
    if (pwd.length < 8) return 1; // Always weak if < 8 chars
    if (score <= 2) return 1;    // Weak
    if (score === 3) return 2;   // Medium
    return 3;                    // Strong
  }

  function updateStrengthUI(score) {
    const colors = {
      1: { text: 'Lemah 🔴', color: 'var(--status-red)', activeCount: 1 },
      2: { text: 'Sedang 🟡', color: 'var(--status-yellow)', activeCount: 2 },
      3: { text: 'Kuat 🟢', color: 'var(--primary)', activeCount: 3 }
    };

    const current = colors[score];
    if (strengthText) {
      strengthText.textContent = current.text;
      strengthText.style.color = current.color;
    }

    if (strengthSegments.length > 0) {
      strengthSegments.forEach((seg, idx) => {
        if (idx < current.activeCount) {
          seg.style.backgroundColor = current.color;
        } else {
          seg.style.backgroundColor = 'var(--border)';
        }
      });
    }
  }

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');
    submitBtn.disabled = true;
    btnText.textContent = currentTab === 'login' ? 'Memproses masuk...' : 'Memproses daftar...';
    spinner.classList.remove('hidden');

    try {
      if (currentTab === 'login') {
        const email = $('#login-email').value.trim();
        const password = $('#login-password').value;

        if (!email || !password) {
          throw new Error('Harap isi semua kolom');
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
          throw new Error('Harap isi semua kolom');
        }
        if (password.length < 8) {
          throw new Error('Kata sandi harus terdiri dari minimal 8 karakter');
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

        if (res.status === 202 || data.pending) {
          alert('⚠️ Account anda akan kami tinjau terlebih dahulu, Terimakasih sudah mendaftar');
          
          // Clear registration fields
          $('#reg-name').value = '';
          $('#reg-email').value = '';
          $('#reg-password').value = '';
          
          // Switch back to login (Masuk) tab
          currentTab = 'login';
          tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'login'));
          loginFields.classList.remove('hidden');
          registerFields.classList.add('hidden');
          btnText.textContent = 'Masuk';
          return;
        }

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
      btnText.textContent = currentTab === 'login' ? 'Masuk' : 'Daftar';
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
