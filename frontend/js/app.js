/**
 * DAMZ AGENT — Main Application
 * SPA router with auth guard, initialization, and global lifecycle.
 */

import { $, formatDuration, showModalConfirm } from './utils/helpers.js';
import { API_BASE } from './utils/config.js';
import { renderSidebar, mountSidebar, setActiveNavItem, updateSidebarStatus } from './components/sidebar.js';

// Page modules
import * as LoginPage from './pages/login.js';
import * as DashboardPage from './pages/dashboard.js';
import * as ChatPage from './pages/chat.js';
import * as KnowledgePage from './pages/knowledge.js';
import * as VisionPage from './pages/vision.js';
import * as ToolsPage from './pages/tools.js';
import * as LogsPage from './pages/logs.js';
import * as SettingsPage from './pages/settings.js';
import * as UsersPage from './pages/users.js';

/* ── Route Map ─────────────────────────────────────── */
const routes = {
  dashboard:  DashboardPage,
  chat:       ChatPage,
  knowledge:  KnowledgePage,
  vision:     VisionPage,
  tools:      ToolsPage,
  logs:       LogsPage,
  settings:   SettingsPage,
  users:      UsersPage,
};

// ── Global Fetch Interceptor ─────────────────────────
// Automatically attaches cookies and Bearer token for all requests to the backend API.
const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.toString() : '');
  
  if (urlStr.includes('/api/')) {
    options.credentials = 'include';
    
    try {
      const session = localStorage.getItem('damz_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.token) {
          options.headers = options.headers || {};
          if (options.headers instanceof Headers) {
            options.headers.set('Authorization', `Bearer ${parsed.token}`);
          } else if (Array.isArray(options.headers)) {
            const authExists = options.headers.some(h => h[0].toLowerCase() === 'authorization');
            if (!authExists) {
              options.headers.push(['Authorization', `Bearer ${parsed.token}`]);
            }
          } else {
            options.headers['Authorization'] = `Bearer ${parsed.token}`;
          }
        }
      }
    } catch (e) {
      console.warn('[FETCH INTERCEPTOR] Failed to append auth header:', e.message);
    }
  }
  
  return originalFetch(url, options).then(response => {
    if (response.status === 401 && !urlStr.includes('/api/auth/sign-in') && !urlStr.includes('/api/auth/sign-up')) {
      console.warn('[AUTH GUARD] Session invalid or expired (401). Force logging out...');
      localStorage.removeItem('damz_session');
      if (typeof showLogin === 'function' && currentPageName !== 'login') {
        showLogin();
      }
    }
    return response;
  });
};

let currentPage = null;
let currentPageName = null;
let statusInterval = null;
function getActiveModel() {
  try {
    const saved = localStorage.getItem('damz_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.model && parsed.model.active) return parsed.model.active;
    }
  } catch (e) {}
  return 'qwen2.5:7b';
}

async function updateStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/system/metrics`);
    if (res.ok) {
      const metrics = await res.json();
      updateSidebarStatus({
        agent: 'ready',
        model: getActiveModel(),
        uptime: metrics.uptime
      });
    } else {
      updateSidebarStatus({
        agent: 'offline',
        model: getActiveModel(),
        uptime: 0
      });
    }
  } catch (err) {
    updateSidebarStatus({
      agent: 'offline',
      model: getActiveModel(),
      uptime: 0
    });
  }
}


/* ── Auth Guard ────────────────────────────────────── */
function checkAuth() {
  return LoginPage.isAuthenticated();
}

function setupMobileDrawer() {
  const hamburger = $('#mobile-hamburger');
  const sidebar = $('#sidebar');
  if (!hamburger || !sidebar) return;

  // Ensure overlay exists
  let overlay = $('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay hidden';
    document.body.appendChild(overlay);
  }

  const toggleDrawer = () => {
    const isOpen = sidebar.classList.contains('open');
    sidebar.classList.toggle('open', !isOpen);
    overlay.classList.toggle('hidden', isOpen);
  };

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDrawer();
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.add('hidden');
  });

  const closeDrawer = () => {
    sidebar.classList.remove('open');
    overlay.classList.add('hidden');
  };

  // Close button inside sidebar logo area
  const closeBtn = $('#sidebar-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDrawer);
  }

  // Swipe left to close gesture
  let touchStartX = 0;
  let touchEndX = 0;
  sidebar.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  sidebar.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    if (touchStartX - touchEndX > 50) {
      closeDrawer();
    }
  }, { passive: true });

  window.addEventListener('hashchange', closeDrawer);
  
  const navItems = sidebar.querySelectorAll('.sidebar-nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', closeDrawer);
  });
}

function showLogin() {
  const sidebar = $('#sidebar');
  const main = $('#main-content');
  const mobileHeader = $('#mobile-header');

  // Hide sidebar and mobile header, show login full-screen
  if (sidebar) sidebar.style.display = 'none';
  if (mobileHeader) mobileHeader.style.display = 'none';
  if (main) {
    main.style.gridColumn = '1 / -1';
    main.innerHTML = LoginPage.render();
    LoginPage.mount(() => {
      // On successful login
      showApp();
    });
  }

  // Stop status updates
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }

  currentPage = LoginPage;
  currentPageName = 'login';
}

function showApp() {
  // Trigger loading model in background on server
  fetch(`${API_BASE}/api/model/load`, { method: 'POST' })
    .catch(e => console.warn('[MODEL LOAD ERROR]', e.message));

  const sidebar = $('#sidebar');
  const main = $('#main-content');
  const mobileHeader = $('#mobile-header');

  // Restore sidebar
  if (sidebar) {
    sidebar.style.display = '';
    sidebar.innerHTML = renderSidebar();
    mountSidebar(navigate);
    mountLogout();
  }
  if (mobileHeader) {
    mobileHeader.style.display = '';
    mobileHeader.innerHTML = `
      <div class="mobile-header-left">
        <button class="mobile-hamburger-btn" id="mobile-hamburger" title="Menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <span class="mobile-header-title">DAMZ AGENT</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="status-indicator">
          <span class="status-dot status-dot--ready"></span>
          <span class="status-label" style="font-size: 9px; font-weight: bold;">Ready</span>
        </span>
      </div>
    `;
    setupMobileDrawer();
  }
  if (main) {
    main.style.gridColumn = '';
  }

  // Start status updates
  updateStatus();
  statusInterval = setInterval(updateStatus, 3000);

  // Navigate to dashboard or hash
  navigate(getPageFromHash());
}

/* ── Shutdown / Logout ─────────────────────────────── */
function mountLogout() {
  const logoutBtn = $('#sidebar-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showModalConfirm('Shutdown Damz Agent?\n\nSemua sesi akan ditutup.', () => {
        LoginPage.logout();
        if (currentPage && currentPage.unmount) currentPage.unmount();
        currentPage = null;
        currentPageName = null;
        location.hash = '';
        showLogin();
      });
    });
  }
}

/* ── Navigation ────────────────────────────────────── */
function navigate(pageName) {
  if (!checkAuth()) {
    showLogin();
    return;
  }

  // Admin access control guard
  if (pageName === 'users') {
    const currentUser = LoginPage.getCurrentUser();
    if (currentUser?.email !== 'damzcore@gmail.com') {
      pageName = 'dashboard';
    }
  }

  // Default to dashboard
  if (!routes[pageName]) pageName = 'dashboard';

  // Don't re-render same page
  if (pageName === currentPageName) return;

  // Unmount current page
  if (currentPage && currentPage.unmount) {
    currentPage.unmount();
  }

  // Update hash
  location.hash = '#/' + pageName;

  // Get page module
  const page = routes[pageName];
  const main = $('#main-content');

  if (main && page) {
    main.innerHTML = page.render();
    if (page.mount) page.mount();
    setActiveNavItem(pageName);
  }

  currentPage = page;
  currentPageName = pageName;
}

/** Extract page name from URL hash. */
function getPageFromHash() {
  const hash = location.hash.replace('#/', '').replace('#', '');
  return routes[hash] ? hash : 'dashboard';
}

/* ── Initialization ────────────────────────────────── */
function init() {
  // Initialize theme mode
  const savedTheme = localStorage.getItem('damz_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const sidebar = $('#sidebar');
  const main = $('#main-content');

  if (!sidebar || !main) {
    console.error('[DAMZ] Missing #sidebar or #main-content elements.');
    return;
  }

  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    if (checkAuth()) {
      navigate(getPageFromHash());
    }
  });

  // Check auth and show login or app
  if (checkAuth()) {
    showApp();
    
    // Background validation of session token on startup
    fetch(`${API_BASE}/api/auth/get-session`)
      .then(res => {
        if (!res.ok) {
          localStorage.removeItem('damz_session');
          showLogin();
        }
      })
      .catch(() => {
        // Keep local session active if server is unreachable/offline
      });
  } else {
    showLogin();
  }

  console.log(
    '%c[DAMZ AGENT]%c v2.0.0 — All systems initialized.',
    'color: #238636; font-weight: bold;',
    'color: #8b949e;'
  );
}

/* ── Bootstrap ─────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
