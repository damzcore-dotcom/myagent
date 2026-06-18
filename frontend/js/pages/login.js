/**
 * DAMZ AGENT — Login Page
 * Premium authentication screen with Obsidian Sentinel aesthetic.
 */

import { $, sleep } from '../utils/helpers.js';

let errorTimeout = null;

export function render() {
  return `
    <div class="login-page">
      <div class="login-bg">
        <div class="login-grid-overlay"></div>
        <div class="login-glow-orb login-glow-orb-1"></div>
        <div class="login-glow-orb login-glow-orb-2"></div>
        <div class="login-glow-orb login-glow-orb-3"></div>
      </div>
      <div class="login-container">
        <div class="login-card">
          <!-- Logo -->
          <div class="login-logo">
            <div class="login-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l3 3h-6l3-3z" fill="currentColor" fill-opacity="0.2"/>
                <path d="M12 2v4"/>
                <polygon points="8 9 11 10 10 12 7 11" fill="currentColor" fill-opacity="0.9"/>
                <polygon points="16 9 13 10 14 12 17 11" fill="currentColor" fill-opacity="0.9"/>
                <path d="M5 8h14"/>
                <path d="M5 8l1.5 6.5L12 18l5.5-3.5L19 8"/>
                <path d="M9 13.5l3 2 3-2"/>
                <path d="M10 15.5l2 1.5 2-1.5"/>
                <path d="M4 6l2 2M20 6l-2 2"/>
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
                  <div class="password-input-wrapper" style="position: relative;">
                    <input type="password" class="input" id="login-password" placeholder="Masukkan kata sandi" required autocomplete="current-password" style="padding-right: 40px;">
                    <button type="button" class="toggle-password-btn" data-target="login-password" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px;">
                      <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      <svg class="eye-off-icon hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </button>
                  </div>
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
                  <input type="text" class="input" id="reg-name" placeholder="Masukkan nama lengkap Anda" autocomplete="name">
                </div>
                <div class="login-field">
                  <label class="login-label" for="reg-email">Email</label>
                  <input type="email" class="input" id="reg-email" placeholder="Masukkan alamat email" autocomplete="email">
                </div>
                <div class="login-field">
                  <label class="login-label" for="reg-password">Kata Sandi</label>
                  <div class="password-input-wrapper" style="position: relative;">
                    <input type="password" class="input" id="reg-password" placeholder="Masukkan kata sandi (min. 8 karakter)" autocomplete="one-time-code" style="padding-right: 40px;">
                    <button type="button" class="toggle-password-btn" data-target="reg-password" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px;">
                      <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      <svg class="eye-off-icon hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </button>
                  </div>
                </div>
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
              <span>Private & Secure · Zero Cloud Leakage</span>
            </div>
            <div class="login-footer-ascii">━━━ Damz Agent ━━━</div>
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

  // Input references for dynamic validation
  const loginEmail = $('#login-email');
  const loginPassword = $('#login-password');
  const regName = $('#reg-name');
  const regEmail = $('#reg-email');
  const regPassword = $('#reg-password');

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

        if (loginEmail) loginEmail.required = true;
        if (loginPassword) loginPassword.required = true;
        if (regName) regName.required = false;
        if (regEmail) regEmail.required = false;
        if (regPassword) regPassword.required = false;
      } else {
        loginFields.classList.add('hidden');
        registerFields.classList.remove('hidden');
        btnText.textContent = 'Daftar';

        if (loginEmail) loginEmail.required = false;
        if (loginPassword) loginPassword.required = false;
        if (regName) regName.required = true;
        if (regEmail) regEmail.required = true;
        if (regPassword) regPassword.required = true;
      }

      errorEl.classList.add('hidden');
      successEl.classList.add('hidden');
      if (strengthContainer) strengthContainer.classList.add('hidden');
      if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
      }
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
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      errorTimeout = null;
    }
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
          const errMsg = data.message || data.error || '';
          if (res.status === 401 || res.status === 403 || errMsg.toLowerCase().includes('invalid email or password') || errMsg.toLowerCase().includes('credential') || errMsg.toLowerCase().includes('allowed_emails')) {
            throw new Error('Email atau Password salah ! Tolong periksa kembali ');
          }
          throw new Error(errMsg || 'Invalid email or password');
        }

        const data = await res.json();
        localStorage.setItem('damz_session', JSON.stringify({
          user: data.user || { email, name: email.split('@')[0] },
          token: data.session?.token || data.token || 'session',
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
          throw new Error(data.error || data.message || 'Registration failed');
        }

        const data = await res.json();

        if (res.status === 202 || data.pending) {
          showModalAlert('⚠️ Account anda akan kami tinjau terlebih dahulu, Terimakasih sudah mendaftar', () => {
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

            if (loginEmail) loginEmail.required = true;
            if (loginPassword) loginPassword.required = true;
            if (regName) regName.required = false;
            if (regEmail) regEmail.required = false;
            if (regPassword) regPassword.required = false;
          });
          return;
        }

        localStorage.setItem('damz_session', JSON.stringify({
          user: data.user || { email, name },
          token: data.session?.token || data.token || 'session',
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

      errorTimeout = setTimeout(() => {
        errorEl.classList.add('hidden');
        errorTimeout = null;
      }, 5000);
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = currentTab === 'login' ? 'Masuk' : 'Daftar';
      spinner.classList.add('hidden');
    }
  });

  // Toggle password visibility
  const toggleBtns = document.querySelectorAll('.toggle-password-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      const eyeIcon = btn.querySelector('.eye-icon');
      const eyeOffIcon = btn.querySelector('.eye-off-icon');

      if (input && eyeIcon && eyeOffIcon) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        eyeIcon.classList.toggle('hidden', isPassword);
        eyeOffIcon.classList.toggle('hidden', !isPassword);
      }
    });
  });
}

export function unmount() {
  if (errorTimeout) {
    clearTimeout(errorTimeout);
    errorTimeout = null;
  }
}

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
export async function logout() {
  try {
    await fetch('http://127.0.0.1:3001/api/model/unload', { method: 'POST' });
  } catch (err) {
    console.warn('[MODEL UNLOAD ERROR]', err.message);
  }
  localStorage.removeItem('damz_session');
  // Try to call better-auth logout
  fetch('http://127.0.0.1:3001/api/auth/sign-out', { method: 'POST', credentials: 'include' }).catch(() => {});
}

/** Display a premium dark themed modal dialog instead of browser alert() */
function showModalAlert(message, callback) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(10, 14, 20, 0.85);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.2s ease;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
    text-align: center;
    position: relative;
    overflow: hidden;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  // Top Yellow Status Bar
  const bar = document.createElement('div');
  bar.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--status-yellow);
  `;
  card.appendChild(bar);

  // App Title
  const title = document.createElement('div');
  title.style.cssText = `
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 18px;
    margin-top: 6px;
  `;
  title.textContent = '🤖 DAMZ AGENT';
  card.appendChild(title);

  // Message body
  const body = document.createElement('div');
  body.style.cssText = `
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.6;
    margin-bottom: 24px;
    text-align: center;
  `;
  body.textContent = message;
  card.appendChild(body);

  // Button Wrapper
  const btnWrapper = document.createElement('div');
  btnWrapper.style.cssText = `
    display: flex;
    justify-content: center;
  `;

  // OK Button
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.style.cssText = `
    padding: 8px 32px;
    font-size: 12px;
    min-width: 100px;
    justify-content: center;
  `;
  btn.textContent = 'OK';
  btnWrapper.appendChild(btn);
  card.appendChild(btnWrapper);

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Close overlay animation
  const close = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.15s ease';
    card.style.transform = 'translateY(12px)';
    card.style.transition = 'transform 0.15s ease';
    setTimeout(() => {
      document.body.removeChild(overlay);
      if (callback) callback();
    }, 150);
  };

  btn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
