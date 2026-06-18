/**
 * DAMZ AGENT — Sidebar Component
 * Navigation, output mode toggle, system status, and shutdown.
 */

import { $, $$, formatDuration } from '../utils/helpers.js';
import { getCurrentUser } from '../pages/login.js';

/* ── SVG Icons (Lucide-style, 24x24 viewBox) ──────── */
const ICONS = {
  terminal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  wrench: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  logs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  bot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 3h-6l3-3z" fill="currentColor" fill-opacity="0.2"/><path d="M12 2v4"/><polygon points="8 9 11 10 10 12 7 11" fill="currentColor" fill-opacity="0.9"/><polygon points="16 9 13 10 14 12 17 11" fill="currentColor" fill-opacity="0.9"/><path d="M5 8h14"/><path d="M5 8l1.5 6.5L12 18l5.5-3.5L19 8"/><path d="M9 13.5l3 2 3-2"/><path d="M10 15.5l2 1.5 2-1.5"/><path d="M4 6l2 2M20 6l-2 2"/></svg>`,
  power: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
  volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: ICONS.grid },
  { id: 'chat',      label: 'Chat',      icon: ICONS.chat },
  { id: 'knowledge', label: 'Knowledge', icon: ICONS.book },
  { id: 'vision',    label: 'Vision',    icon: ICONS.eye },
  { id: 'tools',     label: 'Tools',     icon: ICONS.wrench },
  { id: 'logs',      label: 'Logs',      icon: ICONS.logs },
  { id: 'settings',  label: 'Settings',  icon: ICONS.settings },
];

/** Get saved output mode from localStorage. */
function getOutputMode() {
  return localStorage.getItem('damz_output_mode') || 'both';
}

/** Render the sidebar HTML. */
export function renderSidebar() {
  const outputMode = getOutputMode();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.email === 'damzcore@gmail.com';

  const navItems = [...NAV_ITEMS];
  if (isAdmin) {
    navItems.push({ id: 'users', label: 'Users', icon: ICONS.users });
  }

  return `
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">${ICONS.bot}</div>
      <div>
        <div class="sidebar-logo-text">DAMZ AGENT</div>
        <div class="sidebar-logo-version">v2.0.0</div>
      </div>
    </div>
    <div class="sidebar-section-label">Navigation</div>
    <nav class="sidebar-nav">
      ${navItems.map(item => `
        <a class="sidebar-nav-item" data-page="${item.id}" href="#/${item.id}">
          ${item.icon}
          <span>${item.label}</span>
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-section-label" style="padding-bottom:6px">Output Mode</div>
    <div class="output-mode-toggle">
      <button class="output-mode-btn ${outputMode === 'both' ? 'active' : ''}" data-mode="both" title="Voice + Text">${ICONS.mic}<span>+</span>${ICONS.text}</button>
      <button class="output-mode-btn ${outputMode === 'text' ? 'active' : ''}" data-mode="text" title="Text Only">${ICONS.text}</button>
      <button class="output-mode-btn ${outputMode === 'voice' ? 'active' : ''}" data-mode="voice" title="Voice Only">${ICONS.volume}</button>
    </div>

    <div class="sidebar-logout-area">
      <a class="sidebar-nav-item sidebar-logout-btn" id="sidebar-logout" href="#">
        ${ICONS.power}
        <span>Shutdown Agent</span>
      </a>
    </div>
    <div class="sidebar-status" id="sidebar-status">
      <div class="sidebar-status-row">
        <span class="sidebar-status-label">Status</span>
        <span class="status-indicator">
          <span class="status-dot status-dot--ready" id="sidebar-dot"></span>
          <span class="status-label" id="sidebar-agent-status">Ready</span>
        </span>
      </div>
      <div class="sidebar-status-row">
        <span class="sidebar-status-label">Speaker</span>
        <span class="status-indicator">
          <span class="status-dot" id="sidebar-spk-dot" data-indicator="SPK" style="background: rgba(139,148,158,0.2); transition: background 0.3s ease;"></span>
          <span class="status-label" id="sidebar-spk-status">Idle</span>
        </span>
      </div>
      <div class="sidebar-status-row">
        <span class="sidebar-status-label">Model</span>
        <span class="sidebar-status-value" id="sidebar-model">qwen2.5:7b</span>
      </div>
      <div class="sidebar-status-row">
        <span class="sidebar-status-label">Uptime</span>
        <span class="sidebar-status-value" id="sidebar-uptime">—</span>
      </div>
    </div>
  `;
}

/** Mount sidebar click handlers. */
export function mountSidebar(onNavigate) {
  $$('.sidebar-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = item.dataset.page;
      onNavigate(pageId);
    });
  });

  // Output mode toggle
  $$('.output-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      localStorage.setItem('damz_output_mode', mode);
      const isTts = mode !== 'text';
      localStorage.setItem('damz_tts_enabled', isTts);
      $$('.output-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      
      // Dispatch global event for chat.js (or other pages) to update their voice settings
      window.dispatchEvent(new CustomEvent('damz_tts_changed', { detail: { enabled: isTts } }));
    });
  });

}

/** Highlight the active nav item. */
export function setActiveNavItem(pageId) {
  $$('.sidebar-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });
}

/** Update the bottom status section. */
export function updateSidebarStatus(status) {
  const statusEl = $('#sidebar-agent-status');
  const dotEl = $('#sidebar-dot');
  const modelEl = $('#sidebar-model');
  const uptimeEl = $('#sidebar-uptime');

  if (statusEl && status.agent) {
    const labels = { ready: 'Ready', listening: 'Listening', processing: 'Processing', offline: 'Offline' };
    statusEl.textContent = labels[status.agent] || status.agent;
  }

  if (dotEl && status.agent) {
    dotEl.className = `status-dot status-dot--${status.agent}`;
  }

  if (modelEl && status.model) modelEl.textContent = status.model;
  if (uptimeEl && status.uptime) uptimeEl.textContent = formatDuration(status.uptime);
}
