/**
 * DAMZ AGENT — Settings Page
 * Ollama connection, model selection, STT/TTS settings, agent configuration.
 */

import { $, $$, sleep, showModalConfirm } from '../utils/helpers.js';
import { API_BASE } from '../utils/config.js';

const SETTINGS_DEFAULTS = {
  ollama: {
    host: 'http://localhost',
    port: 11434,
    remoteMode: false,
    remoteIp: '',
  },
  model: {
    active: 'qwen2.5:7b',
    advanced: 'mistral:7b',
  },
  stt: {
    modelSize: 'base',
    language: 'Bahasa Indonesia',
    device: 'cuda',
  },
  tts: {
    voice: 'id_ID-male-medium',
    speed: 1.0,
  },
  agent: {
    name: 'Damz',
    temperature: 0.7,
    memoryTurns: 10,
    wakePhrase: 'Halo Damz',
    wakeSensitivity: 0.5,
    hotkey: 'Ctrl+Space',
    outputMode: 'both',
  },
};

let ollamaModels = [
  { name: 'llama3.2:3b', size: 2.0, family: 'llama', quantization: 'Q4_0', parameterSize: '3B', tags: ['ACTIVE', 'FAST'] },
  { name: 'mistral:7b', size: 4.1, family: 'mistral', quantization: 'Q4_0', parameterSize: '7B', tags: ['SMART'] },
  { name: 'llama3.2-vision:11b', size: 7.9, family: 'llama', quantization: 'Q4_0', parameterSize: '11B', tags: ['VISION', 'SMART'] },
  { name: 'nomic-embed-text:latest', size: 0.27, family: 'nomic', quantization: 'F16', parameterSize: '137M', tags: ['EMBEDDING'] },
];

let settings = {};
let selectedModel = null;

function loadSettings() {
  const saved = localStorage.getItem('damz_settings');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { /* fallback */ }
  }
  return JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
}

function saveSettings() {
  localStorage.setItem('damz_settings', JSON.stringify(settings));
}

export function render() {
  settings = loadSettings();
  selectedModel = null;

  return `
    <div class="page page-settings">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Settings</h1>
          <div class="page-subtitle">System Configuration</div>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" id="settings-reset-btn">Reset to Default</button>
          <button class="btn btn-primary" id="settings-save-btn">Save Config</button>
        </div>
      </div>

      <div class="settings-layout">
        <div class="settings-column">
          <!-- Section A: Ollama Connection -->
          <div class="card settings-section" style="margin-bottom:var(--space-4)">
            <div class="card-header">
              <div class="card-title">🔌 Ollama Connection</div>
              <span class="badge badge--gray" id="ollama-status-badge">Not Tested</span>
            </div>
            <div class="settings-form-grid">
              <div class="settings-field">
                <label class="settings-label">Host URL</label>
                <input type="text" class="input" id="ollama-host" value="${settings.ollama.host}" ${!settings.ollama.remoteMode ? 'readonly' : ''}>
              </div>
              <div class="settings-field">
                <label class="settings-label">Port</label>
                <input type="number" class="input" id="ollama-port" value="${settings.ollama.port}" min="1" max="65535">
              </div>
              <div class="settings-field" style="display:flex;align-items:center;gap:12px;padding-top:20px">
                <button class="toggle ${settings.ollama.remoteMode ? 'active' : ''}" id="remote-toggle">
                  <span class="toggle-knob"></span>
                </button>
                <span class="settings-label" style="margin:0">Remote Mode</span>
              </div>
            </div>
            <div class="settings-remote-hint" id="remote-section" style="display: ${settings.ollama.remoteMode ? 'block' : 'none'}">
              <div class="settings-field" style="margin-top:12px">
                <label class="settings-label">Remote IP</label>
                <input type="text" class="input" id="remote-ip" value="${settings.ollama.remoteIp || ''}" placeholder="192.168.1.100">
              </div>
              <div class="settings-hint">⚠️ Pastikan OLLAMA_HOST=0.0.0.0 di server remote</div>
            </div>
            <div style="margin-top:var(--space-3)">
              <button class="btn btn-secondary" id="test-connection-btn">Test Connection</button>
              <span class="settings-test-result" id="test-result"></span>
            </div>
          </div>

          <!-- Section B: Model Selection -->
          <div class="card settings-section" style="margin-bottom:var(--space-4)">
            <div class="card-header">
              <div class="card-title">🧠 Model Selection</div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-ghost btn-sm" id="refresh-models-btn">Refresh List</button>
                <button class="btn btn-primary btn-sm" id="apply-model-btn" disabled>Apply Model</button>
              </div>
            </div>
            <div class="models-grid" id="models-grid">
              ${renderModelCards()}
            </div>
            <div class="divider"></div>
            <div class="pull-model-section" style="margin-top:var(--space-3); display:flex; gap:12px; align-items:center; flex-wrap:wrap">
              <input type="text" class="input" id="pull-model-input" placeholder="Enter model name to pull (e.g. qwen2.5:1.5b)" style="max-width:280px">
              <button class="btn btn-secondary btn-sm" id="pull-model-btn">Pull Model</button>
              <div class="progress-bar-container hidden" id="pull-progress-container" style="display:flex; flex-direction:column; gap:4px; min-width:180px">
                <div class="label-sm text-muted" id="pull-progress-text" style="font-size:10px">Downloading... 0%</div>
                <div style="width:100%; height:6px; background:var(--surface-container); border-radius:3px; overflow:hidden">
                  <div id="pull-progress-bar" style="width:0%; height:100%; background:var(--primary); transition:width 0.2s ease"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-column">
          <!-- Section C: STT / TTS -->
          <div class="card settings-section" style="margin-bottom:var(--space-4)">
            <div class="card-header">
              <div class="card-title">🎤 STT / TTS Settings</div>
            </div>
            <div class="settings-form-grid">
              <div class="settings-field">
                <label class="settings-label">Whisper Model Size</label>
                <select class="input" id="stt-model-size">
                  ${['tiny', 'base', 'small', 'medium'].map(s => `<option value="${s}" ${settings.stt.modelSize === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>
              <div class="settings-field">
                <label class="settings-label">STT Language</label>
                <select class="input" id="stt-language">
                  ${['Bahasa Indonesia', 'English', 'Auto'].map(l => `<option value="${l}" ${settings.stt.language === l ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
              </div>
              <div class="settings-field">
                <label class="settings-label">TTS Voice</label>
                <select class="input" id="tts-voice">
                  ${[
                    { v: 'id_ID-male-medium', l: 'ID - Argana Medium' },
                    { v: 'id_ID-female-medium', l: 'ID - Siti Medium' },
                    { v: 'en_US-ryan-high', l: 'EN - Ryan High' },
                    { v: 'en_US-lessac-medium', l: 'EN - Lessac Medium' },
                  ].map(o => `<option value="${o.v}" ${settings.tts.voice === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
                </select>
              </div>
              <div class="settings-field">
                <label class="settings-label">TTS Speed: <span id="tts-speed-value">${settings.tts.speed}x</span></label>
                <input type="range" class="settings-slider" id="tts-speed" min="0.5" max="2.0" step="0.1" value="${settings.tts.speed}">
              </div>
            </div>
          </div>

          <!-- Section D: Agent Settings -->
          <div class="card settings-section">
            <div class="card-header">
              <div class="card-title">⚙️ Agent Settings</div>
            </div>
            <div class="settings-form-grid">
              <div class="settings-field">
                <label class="settings-label">Agent Name</label>
                <input type="text" class="input" id="agent-name" value="${settings.agent.name}">
              </div>
              <div class="settings-field">
                <label class="settings-label">Temperature: <span id="temp-value">${settings.agent.temperature}</span></label>
                <input type="range" class="settings-slider" id="agent-temp" min="0" max="1" step="0.1" value="${settings.agent.temperature}">
              </div>
              <div class="settings-field">
                <label class="settings-label">Memory Max Turns</label>
                <input type="number" class="input" id="agent-memory" value="${settings.agent.memoryTurns}" min="1" max="50">
              </div>
              <div class="settings-field">
                <label class="settings-label">Wake Word Phrase</label>
                <input type="text" class="input" id="agent-wake" value="${settings.agent.wakePhrase}">
              </div>
              <div class="settings-field">
                <label class="settings-label">Wake Sensitivity: <span id="wake-sens-value">${settings.agent.wakeSensitivity}</span></label>
                <input type="range" class="settings-slider" id="agent-wake-sens" min="0.1" max="1.0" step="0.1" value="${settings.agent.wakeSensitivity}">
              </div>
              <div class="settings-field">
                <label class="settings-label">Hotkey</label>
                <input type="text" class="input" id="agent-hotkey" value="${settings.agent.hotkey}" readonly style="cursor:pointer" title="Click to capture new hotkey">
              </div>
            </div>
          </div>

          <!-- Section E: Multi-Agent Configuration -->
          <div class="card settings-section" style="margin-top:var(--space-4)">
            <div class="card-header">
              <div class="card-title">🤖 Multi-Agent Settings</div>
            </div>
            <div class="settings-form-grid" id="settings-multi-agent-section">
              <div class="empty-state"><div class="empty-state-text">Loading multi-agent config...</div></div>
            </div>
          </div>
        </div>
      </div>


      <!-- Toast -->
      <div class="toast hidden" id="settings-toast"></div>
    </div>
  `;
}

function renderModelCards() {
  return ollamaModels.map(m => {
    const isActive = m.name === settings.model.active;
    const isSelected = selectedModel === m.name;
    return `
      <div class="model-card ${isActive ? 'model-card--active' : ''} ${isSelected ? 'model-card--selected' : ''}" data-model="${m.name}">
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${(m.tags || []).map(t => {
            const cls = { ACTIVE: 'badge--green', FAST: 'badge--blue', SMART: 'badge--yellow', VISION: 'badge--red', EMBEDDING: 'badge--blue' }[t] || 'badge--blue';
            return `<span class="badge ${cls}">${t}</span>`;
          }).join('')}
        </div>
        <div class="model-card-name">${m.name}</div>
        <div class="model-card-details">
          <span>Size: ${m.size} GB</span>
          <span>Family: ${m.family}</span>
          <span>Params: ${m.parameterSize}</span>
        </div>
        <button class="btn ${isActive ? 'btn-ghost' : 'btn-secondary'} btn-sm model-select-btn" data-model="${m.name}" ${isActive ? 'disabled' : ''}>
          ${isActive ? '✓ Active' : 'Select'}
        </button>
      </div>
    `;
  }).join('');
}

function showToast(message, type = 'success') {
  const toast = $('#settings-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast--${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

async function fetchConfigAndModels() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (res.ok) {
      const config = await res.json();
      
      if (config.llm) {
        settings.model.active = config.llm.model || settings.model.active;
        
        const baseUrl = config.llm.base_url || 'http://localhost:11434';
        try {
          const urlObj = new URL(baseUrl);
          settings.ollama.host = `${urlObj.protocol}//${urlObj.hostname}`;
          settings.ollama.port = urlObj.port ? parseInt(urlObj.port) : 11434;
          if (urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1' && urlObj.hostname !== '0.0.0.0') {
            settings.ollama.remoteMode = true;
            settings.ollama.remoteIp = urlObj.hostname;
          } else {
            settings.ollama.remoteMode = false;
            settings.ollama.remoteIp = '';
          }
        } catch (e) {
          const parts = baseUrl.split(':');
          if (parts.length >= 2) {
            settings.ollama.port = parseInt(parts[parts.length - 1]) || 11434;
            settings.ollama.host = parts.slice(0, -1).join(':');
          }
        }
      }
      
      if (config.agent) {
        settings.agent.name = config.agent.name || settings.agent.name;
        settings.agent.memoryTurns = parseInt(config.agent.memory_max_turns) || settings.agent.memoryTurns;
      }
      
      if (config.stt) {
        settings.stt.modelSize = config.stt.model || settings.stt.modelSize;
        if (config.stt.language === 'id') {
          settings.stt.language = 'Bahasa Indonesia';
        } else if (config.stt.language === 'en') {
          settings.stt.language = 'English';
        } else {
          settings.stt.language = 'Auto';
        }
      }
      
      if (config.output_mode) {
        settings.agent.outputMode = config.output_mode;
      }
      
      // Update UI fields if they exist
      const hostInput = $('#ollama-host');
      const portInput = $('#ollama-port');
      const remoteToggle = $('#remote-toggle');
      const remoteSection = $('#remote-section');
      const remoteIpInput = $('#remote-ip');
      const sttModelSize = $('#stt-model-size');
      const sttLanguage = $('#stt-language');
      const agentName = $('#agent-name');
      const agentMemory = $('#agent-memory');
      
      if (hostInput) hostInput.value = settings.ollama.host;
      if (portInput) portInput.value = settings.ollama.port;
      if (remoteToggle) remoteToggle.classList.toggle('active', settings.ollama.remoteMode);
      if (remoteSection) remoteSection.style.display = settings.ollama.remoteMode ? 'block' : 'none';
      if (remoteIpInput) remoteIpInput.value = settings.ollama.remoteIp;
      if (hostInput) hostInput.readOnly = !settings.ollama.remoteMode;
      
      if (sttModelSize) sttModelSize.value = settings.stt.modelSize;
      if (sttLanguage) sttLanguage.value = settings.stt.language;
      if (agentName) agentName.value = settings.agent.name;
      if (agentMemory) agentMemory.value = settings.agent.memoryTurns;
      
      saveSettings();
    }
  } catch (err) {
    console.warn('[SETTINGS] Gagal mengambil config dari backend, menggunakan local storage.', err);
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/ollama/models`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.models && data.models.length > 0) {
        const mappedModels = data.models.map(m => ({
          name: m.name,
          size: parseFloat(m.size_gb),
          family: m.family,
          quantization: m.quantization,
          parameterSize: m.parameter_size || 'unknown',
          tags: m.tags
        }));
        
        ollamaModels = mappedModels;
        
        const grid = $('#models-grid');
        if (grid) grid.innerHTML = renderModelCards();
        mountModelButtons();
      }
    }
  } catch (err) {
    console.warn('[SETTINGS] Gagal mengambil daftar model dari backend.', err);
  }
}

async function loadMultiAgentSettings() {
  try {
    const statusRes = await fetch(`${API_BASE}/api/providers/status`);
    let providersStatus = {};
    if (statusRes.ok) {
      providersStatus = await statusRes.json();
    }
    
    const agentsRes = await fetch(`${API_BASE}/api/agents`);
    if (agentsRes.ok) {
      const data = await agentsRes.json();
      const section = $('#settings-multi-agent-section');
      if (section) {
        if (!data.enabled) {
          section.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 20px 0;">
              <p class="text-muted" style="margin-bottom: 12px;">Multi-Agent System config_agents.yaml tidak ditemukan.</p>
              <div class="settings-hint">Aktifkan multi-agent dengan membuat file config_agents.yaml di root.</div>
            </div>
          `;
          return;
        }

        // Render providers keys status
        const providerHtml = Object.entries(providersStatus).map(([p, status]) => {
          const badgeClass = status.configured ? 'badge--green' : 'badge--red';
          const badgeText = status.configured ? 'Connected' : 'Missing Key';
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-glass); grid-column: 1 / -1">
              <span class="settings-label" style="margin:0">${p.toUpperCase()} API</span>
              <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
          `;
        }).join('');

        // Render agents
        const agentsHtml = data.agents.map(agent => `
          <div class="settings-field" style="border-bottom:1px solid var(--border-glass); padding-bottom:12px; margin-bottom:12px; grid-column: 1 / -1">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px">
              <span style="font-size:1.2rem">${agent.icon || '🤖'}</span>
              <span class="settings-label" style="margin:0; font-weight:bold">${agent.name}</span>
            </div>
            <div class="settings-hint" style="margin-bottom:8px">${agent.description}</div>
            <div style="display:flex; gap:12px; flex-wrap:wrap">
              <div style="flex:1; min-width:150px">
                <label class="settings-label" style="font-size:11px">Primary</label>
                <input type="text" class="input font-mono" value="${agent.primary.provider.toUpperCase()} : ${agent.primary.model}" readonly style="font-size:11px; background:var(--surface-container)">
              </div>
              <div style="flex:1; min-width:150px">
                <label class="settings-label" style="font-size:11px">Fallback</label>
                <input type="text" class="input font-mono" value="${agent.fallback.provider.toUpperCase()} : ${agent.fallback.model}" readonly style="font-size:11px; background:var(--surface-container)">
              </div>
            </div>
          </div>
        `).join('');

        // Render budget limit
        const budget = data.budget || { monthly_limit_usd: 5.0, alert_threshold_pct: 80 };
        const budgetHtml = `
          <div class="settings-field" style="grid-column: 1 / -1">
            <label class="settings-label">Monthly API Budget Limit: <span style="color:var(--primary); font-weight:bold">$${budget.monthly_limit_usd.toFixed(2)}</span></label>
            <div class="settings-hint" style="margin-bottom:8px">Limit maksimum penggunaan API Cloud DeepSeek/Gemini/Anthropic per bulan.</div>
            <div class="settings-field" style="display:flex; align-items:center; gap:12px">
              <input type="text" class="input font-mono" value="$${budget.monthly_limit_usd.toFixed(2)}" readonly style="max-width:100px; background:var(--surface-container)">
              <span class="badge badge--yellow">${budget.on_exceed === 'fallback_local' ? 'Local Fallback on Limit' : budget.on_exceed}</span>
            </div>
          </div>
        `;

        section.innerHTML = `
          <div style="grid-column: 1 / -1; margin-bottom:16px">
            <h4 style="margin:0 0 8px 0; font-size:13px; color:var(--text-primary)">Provider Keys Status</h4>
            ${providerHtml}
          </div>
          <div style="grid-column: 1 / -1; margin-bottom:16px">
            <h4 style="margin:0 0 12px 0; font-size:13px; color:var(--text-primary)">Specialized Agents</h4>
            ${agentsHtml}
          </div>
          <div style="grid-column: 1 / -1">
            <h4 style="margin:0 0 8px 0; font-size:13px; color:var(--text-primary)">Budget & Cost Control</h4>
            ${budgetHtml}
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Failed to load multi-agent settings:', err);
  }
}

export function mount() {
  // Fetch configuration and models from backend
  fetchConfigAndModels();
  loadMultiAgentSettings();


  // Remote toggle
  const remoteToggle = $('#remote-toggle');
  if (remoteToggle) {
    remoteToggle.addEventListener('click', () => {
      settings.ollama.remoteMode = !remoteToggle.classList.contains('active');
      remoteToggle.classList.toggle('active', settings.ollama.remoteMode);
      const hostInput = $('#ollama-host');
      const section = $('#remote-section');
      const ipInput = $('#remote-ip');
      if (hostInput) hostInput.readOnly = !settings.ollama.remoteMode;
      if (section) section.style.display = settings.ollama.remoteMode ? 'block' : 'none';
      if (settings.ollama.remoteMode && hostInput) {
        const ip = ipInput ? ipInput.value.trim() : '';
        hostInput.value = `http://${ip || '0.0.0.0'}`;
      } else if (hostInput) {
        hostInput.value = 'http://localhost';
      }
    });
  }

  // Remote IP input listener
  const remoteIpInput = $('#remote-ip');
  if (remoteIpInput) {
    remoteIpInput.addEventListener('input', (e) => {
      const ip = e.target.value.trim();
      settings.ollama.remoteIp = ip;
      const hostInput = $('#ollama-host');
      if (hostInput && settings.ollama.remoteMode) {
        hostInput.value = `http://${ip || '0.0.0.0'}`;
      }
    });
  }

  // Test connection
  const testBtn = $('#test-connection-btn');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const result = $('#test-result');
      const badge = $('#ollama-status-badge');
      testBtn.disabled = true;
      testBtn.textContent = 'Testing...';
      if (result) result.textContent = '';
      if (badge) {
        badge.className = 'badge badge--yellow';
        badge.textContent = '⏱ Testing';
      }

      const host = $('#ollama-host')?.value || 'http://localhost';
      const port = $('#ollama-port')?.value || '11434';
      let baseUrl = host;
      if (!host.includes(':', 5)) {
        baseUrl = `${host}:${port}`;
      }

      try {
        const res = await fetch(`${API_BASE}/api/ollama/test?url=${encodeURIComponent(baseUrl)}`);
        const data = await res.json();
        if (data.success) {
          if (badge) { badge.className = 'badge badge--green'; badge.textContent = '✓ Connected'; }
          if (result) result.innerHTML = `<span style="color:var(--primary)">✓ Connected · Ollama v${data.version} · ${data.model_count} models found</span>`;
        } else {
          if (badge) { badge.className = 'badge badge--red'; badge.textContent = '✕ Failed'; }
          if (result) result.innerHTML = `<span style="color:var(--status-red)">${data.error || 'Connection failed'}</span>`;
        }
      } catch (err) {
        if (badge) { badge.className = 'badge badge--red'; badge.textContent = '✕ Failed'; }
        if (result) result.innerHTML = `<span style="color:var(--status-red)">Gagal menghubungi server backend: ${err.message}</span>`;
      }

      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';
    });
  }

  // Model selection
  mountModelButtons();

  // Apply model
  const applyBtn = $('#apply-model-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
      if (!selectedModel) return;
      applyBtn.disabled = true;
      applyBtn.textContent = 'Switching...';
      
      // Update locally
      settings.model.active = selectedModel;
      saveSettings();

      // Apply model to backend config
      try {
        await fetch(`${API_BASE}/api/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            llm: {
              model: selectedModel
            }
          })
        });
      } catch (e) {
        console.warn('Gagal apply model ke backend:', e);
      }

      selectedModel = null;
      const grid = $('#models-grid');
      if (grid) grid.innerHTML = renderModelCards();
      mountModelButtons();
      applyBtn.textContent = 'Apply Model';
      applyBtn.disabled = true;
      showToast(`✓ Model switched to ${settings.model.active}`);
    });
  }

  // Refresh models
  const refreshBtn = $('#refresh-models-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.textContent = 'Refreshing...';
      refreshBtn.disabled = true;
      
      try {
        const res = await fetch(`${API_BASE}/api/ollama/models`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.models) {
            const mappedModels = data.models.map(m => ({
              name: m.name,
              size: parseFloat(m.size_gb),
              family: m.family,
              quantization: m.quantization,
              parameterSize: m.parameter_size || 'unknown',
              tags: m.tags
            }));
            
            ollamaModels = mappedModels;
            
            const grid = $('#models-grid');
            if (grid) grid.innerHTML = renderModelCards();
            mountModelButtons();
            showToast(`✓ Found ${ollamaModels.length} models from backend`);
          } else {
            showToast(`Gagal memuat model: ${data.error || 'Unknown error'}`, 'error');
          }
        } else {
          showToast('Gagal memuat model dari backend', 'error');
        }
      } catch (err) {
        showToast(`Gagal menghubungi server backend: ${err.message}`, 'error');
      }

      refreshBtn.textContent = 'Refresh List';
      refreshBtn.disabled = false;
    });
  }

  // Pull Model
  const pullBtn = $('#pull-model-btn');
  const pullInput = $('#pull-model-input');
  const pullProgressCont = $('#pull-progress-container');
  const pullProgressText = $('#pull-progress-text');
  const pullProgressBar = $('#pull-progress-bar');

  if (pullBtn && pullInput) {
    pullBtn.addEventListener('click', async () => {
      const modelName = pullInput.value.trim();
      if (!modelName) {
        showToast('Please enter a model name to pull', 'error');
        return;
      }

      pullBtn.disabled = true;
      pullInput.disabled = true;
      if (pullProgressCont) pullProgressCont.classList.remove('hidden');
      if (pullProgressBar) pullProgressBar.style.width = '20%';
      if (pullProgressText) pullProgressText.textContent = `Downloading ${modelName}... (mohon tunggu)`;

      try {
        const res = await fetch(`${API_BASE}/api/ollama/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelName })
        });
        const data = await res.json();
        if (data.success) {
          if (pullProgressBar) pullProgressBar.style.width = '100%';
          if (pullProgressText) pullProgressText.textContent = `Successfully downloaded ${modelName}!`;
          await sleep(1000);
          completePull(modelName);
        } else {
          showToast(`Gagal pull model: ${data.error || 'Unknown error'}`, 'error');
          if (pullBtn) pullBtn.disabled = false;
          if (pullInput) pullInput.disabled = false;
          if (pullProgressCont) pullProgressCont.classList.add('hidden');
        }
      } catch (err) {
        showToast(`Gagal menghubungi server backend: ${err.message}`, 'error');
        if (pullBtn) pullBtn.disabled = false;
        if (pullInput) pullInput.disabled = false;
        if (pullProgressCont) pullProgressCont.classList.add('hidden');
      }
    });
  }

  function completePull(modelName) {
    const exists = ollamaModels.find(m => m.name === modelName);
    if (!exists) {
      ollamaModels.push({
        name: modelName,
        size: 0,
        family: modelName.split(':')[0],
        quantization: 'Q4_0',
        parameterSize: modelName.includes('b') ? modelName.split(':').pop().toUpperCase() : '?',
        isActive: false,
        tags: ['NEW']
      });
    }

    if (pullBtn) pullBtn.disabled = false;
    if (pullInput) { pullInput.disabled = false; pullInput.value = ''; }
    if (pullProgressCont) pullProgressCont.classList.add('hidden');
    if (pullProgressBar) pullProgressBar.style.width = '0%';

    const grid = $('#models-grid');
    if (grid) grid.innerHTML = renderModelCards();
    mountModelButtons();

    showToast(`✓ Model ${modelName} pulled successfully!`);
  }

  // Sliders
  const ttsSpeed = $('#tts-speed');
  if (ttsSpeed) {
    ttsSpeed.addEventListener('input', () => {
      const v = $('#tts-speed-value');
      if (v) v.textContent = `${ttsSpeed.value}x`;
      settings.tts.speed = parseFloat(ttsSpeed.value);
    });
  }

  const tempSlider = $('#agent-temp');
  if (tempSlider) {
    tempSlider.addEventListener('input', () => {
      const v = $('#temp-value');
      if (v) v.textContent = tempSlider.value;
      settings.agent.temperature = parseFloat(tempSlider.value);
    });
  }

  const wakeSens = $('#agent-wake-sens');
  if (wakeSens) {
    wakeSens.addEventListener('input', () => {
      const v = $('#wake-sens-value');
      if (v) v.textContent = wakeSens.value;
      settings.agent.wakeSensitivity = parseFloat(wakeSens.value);
    });
  }

  // Save button
  const saveBtn = $('#settings-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      settings.ollama.host = $('#ollama-host')?.value || settings.ollama.host;
      settings.ollama.port = parseInt($('#ollama-port')?.value) || settings.ollama.port;
      settings.ollama.remoteIp = $('#remote-ip')?.value || '';
      settings.stt.modelSize = $('#stt-model-size')?.value || settings.stt.modelSize;
      settings.stt.language = $('#stt-language')?.value || settings.stt.language;
      settings.tts.voice = $('#tts-voice')?.value || settings.tts.voice;
      settings.agent.name = $('#agent-name')?.value || settings.agent.name;
      settings.agent.memoryTurns = parseInt($('#agent-memory')?.value) || settings.agent.memoryTurns;
      settings.agent.wakePhrase = $('#agent-wake')?.value || settings.agent.wakePhrase;
      settings.agent.hotkey = $('#agent-hotkey')?.value || settings.agent.hotkey;
      
      saveSettings();

      // Send to backend config endpoint
      let baseUrl = settings.ollama.host;
      if (!baseUrl.includes(':', 5)) {
        baseUrl = `${baseUrl}:${settings.ollama.port}`;
      }

      try {
        const res = await fetch(`${API_BASE}/api/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            llm: {
              base_url: baseUrl,
              model: settings.model.active
            },
            output_mode: settings.agent.outputMode,
            agent: {
              name: settings.agent.name,
              memory_max_turns: settings.agent.memoryTurns
            },
            stt: {
              model: settings.stt.modelSize,
              language: settings.stt.language === 'Bahasa Indonesia' ? 'id' : settings.stt.language === 'English' ? 'en' : 'auto'
            }
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('✓ Configuration saved & applied to backend');
        } else {
          showToast('⚠️ Local settings saved, but backend failed to update', 'warning');
        }
      } catch (err) {
        showToast('⚠️ Saved locally. Backend offline or unreachable.', 'warning');
      }
    });
  }

  // Reset button
  const resetBtn = $('#settings-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      showModalConfirm('Reset semua pengaturan ke default?', () => {
        localStorage.removeItem('damz_settings');
        settings = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
        saveSettings();
        const main = document.getElementById('main-content');
        if (main) {
          main.innerHTML = render();
          mount();
        }
        showToast('✓ Settings reset to default');
      });
    });
  }
}

function selectModel(modelName) {
  if (modelName === settings.model.active) return; // already active
  selectedModel = modelName;
  const grid = $('#models-grid');
  if (grid) grid.innerHTML = renderModelCards();
  mountModelButtons();
  const applyBtn = $('#apply-model-btn');
  if (applyBtn) applyBtn.disabled = false;
}

function mountModelButtons() {
  // Make SELECT buttons clickable
  $$('.model-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectModel(btn.dataset.model);
    });
  });

  // Make entire model card clickable too
  $$('.model-card').forEach(card => {
    card.addEventListener('click', () => {
      selectModel(card.dataset.model);
    });
  });
}

export function unmount() {
  selectedModel = null;
}
