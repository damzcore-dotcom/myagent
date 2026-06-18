/**
 * DAMZ AGENT — Tools Configuration Page
 * Modular system hooks with editable config forms and localStorage persistence.
 */

import { $, $$ } from '../utils/helpers.js';

const DEFAULT_TOOLS = [
  { id: 'app-launcher', name: 'App Launcher', description: 'Launch applications like Notepad, Chrome, VS Code, and Explorer directly from voice commands.', icon: 'rocket', enabled: true, config: { apps: 'Notepad, Chrome, VS Code, Explorer, Calculator' } },
  { id: 'system-monitor', name: 'System Monitor', description: 'Real-time CPU, RAM, and Disk telemetry with threshold alerts and historical data.', icon: 'activity', enabled: true, config: { interval: 3, threshold: 85 } },
  { id: 'google-search', name: 'Google Search', description: 'Automated web search queries via browser automation with result summarization.', icon: 'search', enabled: true, config: { engine: 'Google Chrome', maxResults: 5 } },
  { id: 'reminders', name: 'Reminders', description: 'Set local reminders and system notifications with natural language scheduling.', icon: 'bell', enabled: false, config: { sound: 'Default', snooze: 5 } },
  { id: 'file-manager', name: 'File Manager', description: 'Browse, search, and organize local files with voice-controlled navigation.', icon: 'folder', enabled: false, config: { rootDir: 'C:\\Users', recursive: true } },
  { id: 'clipboard', name: 'Clipboard History', description: 'Track and manage clipboard contents with searchable paste history.', icon: 'clipboard', enabled: false, config: { maxHistory: 50, autoClear: 24 } },
];

let tools = [];

/** Load tools from localStorage or default configuration fallback */
function loadTools() {
  const saved = localStorage.getItem('damz_tools_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('[TOOLS] Failed to parse saved tools config, resetting.', e);
    }
  }

  saveTools(DEFAULT_TOOLS);
  return DEFAULT_TOOLS;
}

/** Save tools state to localStorage */
function saveTools(data) {
  localStorage.setItem('damz_tools_config', JSON.stringify(data));
}

const TOOL_ICONS = {
  rocket: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
  activity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>`,
};

export function render() {
  tools = loadTools();
  const activeCount = tools.filter(t => t.enabled).length;

  return `
    <div class="page page-tools">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Tools</h1>
          <div class="page-subtitle">System Hooks Configuration</div>
        </div>
        <div class="page-header-actions">
          <span class="badge badge--green" id="tools-active-count">${activeCount} Active</span>
        </div>
      </div>

      <div class="tools-grid">
        ${tools.map(tool => `
          <div class="card" id="tool-card-${tool.id}">
            <div class="tool-card-header">
              <div class="tool-card-icon">
                ${TOOL_ICONS[tool.icon] || TOOL_ICONS.rocket}
              </div>
              <button class="toggle ${tool.enabled ? 'active' : ''}" data-tool-id="${tool.id}">
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="tool-card-name">${tool.name}</div>
            <div class="tool-card-desc">${tool.description}</div>
            
            <!-- Dynamic Config Form -->
            <div class="tool-card-config ${tool.enabled ? '' : 'hidden'}" id="config-${tool.id}">
              ${renderConfigForm(tool)}
            </div>

            <div class="tool-card-status">
              <span class="status-indicator">
                <span class="status-dot ${tool.enabled ? 'status-dot--ready' : 'status-dot--offline'}"></span>
                <span class="status-label">${tool.enabled ? 'Enabled' : 'Disabled'}</span>
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderConfigForm(tool) {
  const cfg = tool.config;
  if (tool.id === 'app-launcher') {
    return `
      <div class="config-field" style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
        <label class="label-sm" style="color:var(--text-muted)">Available Applications</label>
        <input type="text" class="input config-input" data-tool-id="${tool.id}" data-key="apps" value="${escapeHtml(cfg.apps)}">
      </div>
    `;
  }
  if (tool.id === 'system-monitor') {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div class="config-field" style="display:flex;flex-direction:column;gap:6px">
          <label class="label-sm" style="color:var(--text-muted)">Interval (seconds)</label>
          <input type="number" min="1" max="60" class="input config-input" data-tool-id="${tool.id}" data-key="interval" value="${cfg.interval}">
        </div>
        <div class="config-field" style="display:flex;flex-direction:column;gap:6px">
          <label class="label-sm" style="color:var(--text-muted)">Alert Threshold (%)</label>
          <input type="number" min="10" max="100" class="input config-input" data-tool-id="${tool.id}" data-key="threshold" value="${cfg.threshold}">
        </div>
      </div>
    `;
  }
  if (tool.id === 'google-search') {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div class="config-field" style="display:flex;flex-direction:column;gap:6px">
          <label class="label-sm" style="color:var(--text-muted)">Browser Engine</label>
          <select class="input config-input" data-tool-id="${tool.id}" data-key="engine" style="padding: 9px 12px; background: var(--bg-base); color: var(--text-primary); border-radius: var(--radius)">
            <option value="Google Chrome" ${cfg.engine === 'Google Chrome' ? 'selected' : ''}>Google Chrome</option>
            <option value="Mozilla Firefox" ${cfg.engine === 'Mozilla Firefox' ? 'selected' : ''}>Mozilla Firefox</option>
            <option value="Microsoft Edge" ${cfg.engine === 'Microsoft Edge' ? 'selected' : ''}>Microsoft Edge</option>
          </select>
        </div>
        <div class="config-field" style="display:flex;flex-direction:column;gap:6px">
          <label class="label-sm" style="color:var(--text-muted)">Max Results</label>
          <input type="number" min="1" max="20" class="input config-input" data-tool-id="${tool.id}" data-key="maxResults" value="${cfg.maxResults}">
        </div>
      </div>
    `;
  }
  if (tool.id === 'reminders') {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div class="config-field" style="display:flex;flex-direction:column;gap:6px">
          <label class="label-sm" style="color:var(--text-muted)">Sound Notification</label>
          <select class="input config-input" data-tool-id="${tool.id}" data-key="sound" style="padding: 9px 12px; background: var(--bg-base); color: var(--text-primary); border-radius: var(--radius)">
            <option value="Default" ${cfg.sound === 'Default' ? 'selected' : ''}>Default</option>
            <option value="Digital" ${cfg.sound === 'Digital' ? 'selected' : ''}>Digital</option>
            <option value="Beep" ${cfg.sound === 'Beep' ? 'selected' : ''}>Beep</option>
          </select>
        </div>
        <div class="config-field" style="display:flex;flex-direction:column;gap:6px">
          <label class="label-sm" style="color:var(--text-muted)">Snooze (minutes)</label>
          <input type="number" min="1" max="60" class="input config-input" data-tool-id="${tool.id}" data-key="snooze" value="${cfg.snooze}">
        </div>
      </div>
    `;
  }
  if (tool.id === 'file-manager') {
    return `
      <div style="display:grid;grid-template-columns:2.2fr 1fr;gap:12px;margin-top:8px">
        <div class="config-field" style="display:flex;flex-direction:column;gap:6px">
          <label class="label-sm" style="color:var(--text-muted)">Root Directory</label>
          <input type="text" class="input config-input" data-tool-id="${tool.id}" data-key="rootDir" value="${escapeHtml(cfg.rootDir)}">
        </div>
        <div class="config-field" style="display:flex;flex-direction:column;gap:6px;justify-content:center;align-items:center">
          <label class="label-sm" style="color:var(--text-muted);margin-bottom:4px;user-select:none">Recursive</label>
          <input type="checkbox" class="config-input-checkbox" data-tool-id="${tool.id}" data-key="recursive" ${cfg.recursive ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary-container);cursor:pointer">
        </div>
      </div>
    `;
  }
  if (tool.id === 'clipboard') {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div class="config-field" style="display:flex;flex-direction:column;gap:6px">
          <label class="label-sm" style="color:var(--text-muted)">Max History Items</label>
          <input type="number" min="10" max="200" class="input config-input" data-tool-id="${tool.id}" data-key="maxHistory" value="${cfg.maxHistory}">
        </div>
        <div class="config-field" style="display:flex;flex-direction:column;gap:6px">
          <label class="label-sm" style="color:var(--text-muted)">Auto-clear (hours)</label>
          <input type="number" min="1" max="168" class="input config-input" data-tool-id="${tool.id}" data-key="autoClear" value="${cfg.autoClear}">
        </div>
      </div>
    `;
  }
  return '';
}

export function mount() {
  // Toggle buttons
  $$('.toggle[data-tool-id]').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const toolId = toggle.dataset.toolId;
      const tool = tools.find(t => t.id === toolId);
      if (!tool) return;

      tool.enabled = !tool.enabled;
      toggle.classList.toggle('active', tool.enabled);

      // Show/hide config
      const configEl = $(`#config-${toolId}`);
      if (configEl) configEl.classList.toggle('hidden', !tool.enabled);

      // Update status
      const card = $(`#tool-card-${toolId}`);
      if (card) {
        const dot = $('.status-dot', card);
        const label = $('.status-label', card);
        if (dot) dot.className = `status-dot ${tool.enabled ? 'status-dot--ready' : 'status-dot--offline'}`;
        if (label) label.textContent = tool.enabled ? 'Enabled' : 'Disabled';
      }

      // Update count
      const countEl = $('#tools-active-count');
      const activeCount = tools.filter(t => t.enabled).length;
      if (countEl) countEl.textContent = `${activeCount} Active`;

      // Save to localStorage
      saveTools(tools);
    });
  });

  // Text, Number and Select input updates
  $$('.config-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const toolId = e.target.dataset.toolId;
      const key = e.target.dataset.key;
      const tool = tools.find(t => t.id === toolId);
      if (!tool) return;

      let value = e.target.value;
      if (e.target.type === 'number') {
        value = Number(value);
      }
      tool.config[key] = value;

      // Save to localStorage
      saveTools(tools);
    });
  });

  // Checkbox input updates
  $$('.config-input-checkbox').forEach(input => {
    input.addEventListener('change', (e) => {
      const toolId = e.target.dataset.toolId;
      const key = e.target.dataset.key;
      const tool = tools.find(t => t.id === toolId);
      if (!tool) return;

      tool.config[key] = e.target.checked;

      // Save to localStorage
      saveTools(tools);
    });
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function unmount() {
  tools = [];
}
