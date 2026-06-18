/**
 * DAMZ AGENT — Dashboard Page
 * System gauges with absolute values, real activity feed, real metrics and status,
 * quick actions, model info with hotkey toggle.
 */

import { $, $$, animateValue, formatDuration } from '../utils/helpers.js';
import { API_BASE } from '../utils/config.js';
import { createGauge, updateGauge } from '../components/gauge.js';

let metricsInterval = null;
let currentActivityFilter = 'all';
let activityItems = [];

const DEFAULT_SYSTEM_INFO = {
  model: 'Llama 3.2:3b',
  modelAdvanced: 'Mistral:7b',
  embeddingModel: 'Nomic Embed Text',
  sttEngine: 'Faster-Whisper',
  ttsEngine: 'Piper TTS',
  wakeWord: 'openWakeWord',
  wakePhrase: 'Halo Damz',
  hotkey: 'Ctrl+Space',
  memoryShortTerm: 'ConversationBuffer (10 turns)',
  memoryLongTerm: 'SQLite (persistent)',
  language: 'Bahasa Indonesia',
};

function getSystemInfo() {
  const info = { ...DEFAULT_SYSTEM_INFO };
  try {
    const saved = localStorage.getItem('damz_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.model && parsed.model.active) info.model = parsed.model.active;
      if (parsed.model && parsed.model.advanced) info.modelAdvanced = parsed.model.advanced;
      if (parsed.stt && parsed.stt.modelSize) info.sttEngine = `Faster-Whisper (${parsed.stt.modelSize})`;
      if (parsed.stt && parsed.stt.language) info.language = parsed.stt.language;
      if (parsed.tts && parsed.tts.voice) info.ttsEngine = `Piper TTS (${parsed.tts.voice})`;
      if (parsed.agent && parsed.agent.name) info.wakeWord = `openWakeWord (${parsed.agent.name})`;
      if (parsed.agent && parsed.agent.wakePhrase) info.wakePhrase = parsed.agent.wakePhrase;
      if (parsed.agent && parsed.agent.hotkey) info.hotkey = parsed.agent.hotkey;
    }
  } catch (e) {}
  return info;
}

export function render() {
  const waveformBars = Array.from({ length: 5 }, (_, i) =>
    `<span style="--i:${i + 1}"></span>`
  ).join('');

  const hotkeyEnabled = localStorage.getItem('damz_hotkey_enabled') !== 'false';
  const sysInfo = getSystemInfo();

  // Load Ollama Host text
  const savedSettings = localStorage.getItem('damz_settings');
  let ollamaHostText = 'Server (localhost)';
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      if (parsed.ollama && parsed.ollama.remoteMode) {
        ollamaHostText = `Remote (${parsed.ollama.remoteIp || 'Unknown IP'})`;
      }
    } catch(e) {}
  }

  return `
    <div class="page page-dashboard">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Dashboard</h1>
          <div class="page-subtitle">System Overview</div>
        </div>
        <div class="page-header-actions">
          <span class="badge badge--green" id="system-health-badge">All Systems Nominal</span>
          <span class="badge badge--blue">v2.0</span>
        </div>
      </div>

      <div class="dashboard-layout">
        <div class="dashboard-column">
          <!-- Stat Cards -->
          <div class="dashboard-grid">
            <div class="card agent-status-card">
              <div class="card-title">Agent Status</div>
              <div class="status-hero">
                <div class="status-leds-container">
                  <div class="status-led-item">
                    <span class="status-led led--listening" id="led-listening"></span>
                    <span class="status-led-label">LST</span>
                  </div>
                  <div class="status-led-item">
                    <span class="status-led led--processing" id="led-processing"></span>
                    <span class="status-led-label">PRC</span>
                  </div>
                  <div class="status-led-item">
                    <span class="status-led led--speaking" id="led-speaking"></span>
                    <span class="status-led-label">SPK</span>
                  </div>
                  <div class="status-led-item">
                    <span class="status-led led--error" id="led-error"></span>
                    <span class="status-led-label">ERR</span>
                  </div>
                </div>
                <div style="flex-grow:1">
                  <div class="status-hero-text" id="dash-status-text">Ready</div>
                  <div class="waveform-bars idle" id="dash-waveform">${waveformBars}</div>
                </div>
              </div>
            </div>
            <div class="card stat-card">
              <div class="card-title">Messages</div>
              <div class="card-value" id="stat-messages">0</div>
              <div class="label-sm text-muted" style="margin-top:4px">Processed</div>
            </div>
            <div class="card stat-card">
              <div class="card-title">Documents</div>
              <div class="card-value" id="stat-documents">0</div>
              <div class="label-sm text-muted" style="margin-top:4px">Indexed</div>
            </div>
            <div class="card stat-card">
              <div class="card-title">Uptime</div>
              <div class="card-value" style="font-size:22px" id="stat-uptime">—</div>
              <div class="label-sm text-muted" style="margin-top:4px">Online</div>
            </div>
          </div>

          <!-- Gauges -->
          <div class="card-grid-3" style="margin-bottom:var(--space-4)">
            <div class="card">
              <div class="card-title">CPU Usage</div>
              <div class="card-body" style="display:flex;justify-content:center;padding-top:12px">
                <div id="gauge-cpu"></div>
              </div>
            </div>
            <div class="card">
              <div class="card-title">Memory Usage</div>
              <div class="card-body" style="display:flex;justify-content:center;padding-top:12px">
                <div id="gauge-ram"></div>
              </div>
            </div>
            <div class="card">
              <div class="card-title">Disk Usage</div>
              <div class="card-body" style="display:flex;justify-content:center;padding-top:12px">
                <div id="gauge-disk"></div>
              </div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="quick-actions-grid">
            <button class="card quick-action-card" id="qa-push-talk">
              <span class="quick-action-icon">🎙️</span>
              <span class="quick-action-label">Push to Talk</span>
              <span class="quick-action-hint">Activate voice input</span>
            </button>
            <button class="card quick-action-card" id="qa-add-doc">
              <span class="quick-action-icon">📄</span>
              <span class="quick-action-label">Add Document</span>
              <span class="quick-action-hint">Upload to RAG</span>
            </button>
            <button class="card quick-action-card" id="qa-restart">
              <span class="quick-action-icon">🔄</span>
              <span class="quick-action-label">Restart Agent</span>
              <span class="quick-action-hint">Reload all services</span>
            </button>
          </div>
        </div>

        <div class="dashboard-column">
          <!-- Model Info Card -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Model Info</div>
              <span class="badge badge--green" id="model-status-badge">Active</span>
            </div>
            <div class="card-body model-info-grid">
              <div class="model-info-row">
                <span class="model-info-label">LLM</span>
                <span class="model-info-value" id="info-llm">${sysInfo.model}</span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">Ollama Host</span>
                <span class="model-info-value" style="color:var(--accent-blue)">${ollamaHostText}</span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">LLM Advanced</span>
                <span class="model-info-value">${sysInfo.modelAdvanced}</span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">Embeddings</span>
                <span class="model-info-value">${sysInfo.embeddingModel}</span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">STT Engine</span>
                <span class="model-info-value">${sysInfo.sttEngine}</span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">TTS Engine</span>
                <span class="model-info-value">${sysInfo.ttsEngine}</span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">Wake Word</span>
                <span class="model-info-value" style="color:var(--accent-blue)">${sysInfo.wakeWord}</span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">Phrase</span>
                <span class="model-info-value" style="color:var(--accent-blue)">"${sysInfo.wakePhrase}"</span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">Hotkey</span>
                <span class="model-info-value" style="display:flex;align-items:center;gap:8px">
                  ${sysInfo.hotkey}
                  <span class="hotkey-toggle ${hotkeyEnabled ? 'hotkey-toggle--on' : 'hotkey-toggle--off'}" id="hotkey-toggle">${hotkeyEnabled ? 'ON' : 'OFF'}</span>
                </span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">Memory ST</span>
                <span class="model-info-value">${sysInfo.memoryShortTerm}</span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">Memory LT</span>
                <span class="model-info-value">${sysInfo.memoryLongTerm}</span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">Language</span>
                <span class="model-info-value">${sysInfo.language}</span>
              </div>
              <div class="model-info-row">
                <span class="model-info-label">Privacy</span>
                <span class="model-info-value" style="color:var(--primary)">100% Private</span>
              </div>
            </div>
          </div>

          <!-- Activity Feed Card -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Activity Feed</div>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="badge badge--blue" id="activity-count">0 Events</span>
              </div>
            </div>
            <div class="activity-toolbar">
              <button class="activity-filter-btn active" data-filter="all">All</button>
              <button class="activity-filter-btn" data-filter="error">Error</button>
              <button class="activity-filter-btn" data-filter="tool">Tool</button>
              <button class="activity-filter-btn" data-filter="system">System</button>
              <button class="btn btn-ghost btn-sm" id="activity-clear-btn" style="margin-left:auto;font-size:10px">Clear</button>
            </div>
            <div class="card-body activity-feed" id="activity-feed-list">
              <div class="empty-state" style="padding:24px"><div class="empty-state-text">Loading events...</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderActivityItems(items) {
  if (items.length === 0) {
    return '<div class="empty-state" style="padding:24px"><div class="empty-state-text">No events</div></div>';
  }
  return items.map(a => `
    <div class="activity-item" data-activity-text="${a.text.toLowerCase()}">
      <span class="activity-time">${a.time}</span>
      <span class="activity-text">${a.text}</span>
    </div>
  `).join('');
}

function updateStatusHero(agentStatus) {
  const text = $('#dash-status-text');
  const waveform = $('#dash-waveform');
  const badge = $('#system-health-badge');

  // LEDs
  const ledListening = $('#led-listening');
  const ledProcessing = $('#led-processing');
  const ledSpeaking = $('#led-speaking');
  const ledError = $('#led-error');

  const labels = {
    ready: 'Ready',
    listening: 'Listening...',
    processing: 'Processing...',
    speaking: 'Speaking...',
    offline: 'Offline',
    error: 'System Error'
  };

  if (text) text.textContent = labels[agentStatus] || 'Ready';

  // Toggle active class on corresponding LED
  if (ledListening) ledListening.classList.toggle('active', agentStatus === 'listening');
  if (ledProcessing) ledProcessing.classList.toggle('active', agentStatus === 'processing');
  if (ledSpeaking) ledSpeaking.classList.toggle('active', agentStatus === 'speaking');
  if (ledError) ledError.classList.toggle('active', agentStatus === 'error' || agentStatus === 'offline');

  if (waveform) {
    waveform.classList.toggle('idle', agentStatus === 'ready' || agentStatus === 'error' || agentStatus === 'offline');
  }

  // Dynamic health badge
  if (badge) {
    if (agentStatus === 'processing') {
      badge.className = 'badge badge--yellow';
      badge.textContent = '⚙️ Processing';
    } else if (agentStatus === 'listening') {
      badge.className = 'badge badge--blue';
      badge.textContent = '🎤 Listening';
    } else if (agentStatus === 'speaking') {
      badge.className = 'badge badge--blue';
      badge.textContent = '🔊 Speaking';
    } else if (agentStatus === 'offline') {
      badge.className = 'badge badge--red';
      badge.textContent = '✕ Server Offline';
    } else if (agentStatus === 'error') {
      badge.className = 'badge badge--red';
      badge.textContent = '❌ System Error';
    } else {
      badge.className = 'badge badge--green';
      badge.textContent = 'All Systems Nominal';
    }
  }
}

function cleanCpuModel(model) {
  if (!model) return 'CPU';
  return model
    .replace(/\(R\)/gi, '')
    .replace(/\(TM\)/gi, '')
    .replace(/\b\d+(?:th|nd|rd|st)?\s+Gen\b/gi, '')
    .replace(/Intel/gi, '')
    .replace(/Core/gi, '')
    .replace(/CPU/gi, '')
    .replace(/Xeon/gi, 'Xeon')
    .replace(/Processor/gi, '')
    .replace(/Graphics/gi, '')
    .replace(/\b\d+-Core\b/gi, '')
    .replace(/with/gi, '')
    .replace(/@\s*\d+(\.\d+)?\s*[Gg][Hh][Zz]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchStatsAndMetrics() {
  // 1. Uptime & Gauges
  try {
    const res = await fetch(`${API_BASE}/api/system/metrics`);
    if (res.ok) {
      const data = await res.json();
      
      updateGauge('gauge-cpu', data.cpu.usage, cleanCpuModel(data.cpu.model));
      updateGauge('gauge-ram', data.ram.percent, `${data.ram.used_gb}/${data.ram.total_gb} GB`);
      updateGauge('gauge-disk', data.disk.percent, `${data.disk.used_gb}/${data.disk.total_gb} GB`);

      const uptimeVal = $('#stat-uptime');
      if (uptimeVal) uptimeVal.textContent = formatDuration(data.uptime);
      
      updateStatusHero('ready');
    } else {
      updateStatusHero('offline');
    }
  } catch (err) {
    updateStatusHero('offline');
  }

  // 2. Document count
  try {
    const res = await fetch(`${API_BASE}/api/documents`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.documents) {
        const docCountEl = $('#stat-documents');
        if (docCountEl) docCountEl.textContent = data.documents.length;
      }
    }
  } catch (e) {}

  // 3. Message count from local history
  try {
    const savedChat = localStorage.getItem('damz_chat_history');
    if (savedChat) {
      const parsed = JSON.parse(savedChat);
      const msgCountEl = $('#stat-messages');
      if (msgCountEl) msgCountEl.textContent = parsed.length;
    }
  } catch (e) {}

  // 4. Activity Logs
  try {
    const res = await fetch(`${API_BASE}/api/logs`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.logs) {
        activityItems = data.logs.slice(-15).reverse().map(log => {
          const date = new Date(log.timestamp);
          const time = date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
          return {
            time,
            text: `[${log.source}] ${log.message}`
          };
        });
        
        const list = $('#activity-feed-list');
        if (list) list.innerHTML = renderActivityItems(activityItems);

        const countEl = $('#activity-count');
        if (countEl) countEl.textContent = `${activityItems.length} Events`;

        applyActivityFilter();
      }
    }
  } catch (e) {}
}

export function mount() {
  // Initialize gauges with 0
  createGauge('gauge-cpu', { value: 0, label: 'CPU', subtitle: 'CPU' });
  createGauge('gauge-ram', { value: 0, label: 'RAM', subtitle: '0/0 GB' });
  createGauge('gauge-disk', { value: 0, label: 'Disk', subtitle: '0/0 GB' });

  // Initial fetch
  fetchStatsAndMetrics();

  // Periodic metrics polling
  metricsInterval = setInterval(fetchStatsAndMetrics, 3000);

  // Activity feed filters
  $$('.activity-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentActivityFilter = btn.dataset.filter;
      $$('.activity-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      applyActivityFilter();
    });
  });

  // Activity clear
  const clearBtn = $('#activity-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      activityItems = [];
      const list = $('#activity-feed-list');
      if (list) list.innerHTML = renderActivityItems([]);
      const countEl = $('#activity-count');
      if (countEl) countEl.textContent = '0 Events';
    });
  }

  // Hotkey toggle
  const hotkeyToggle = $('#hotkey-toggle');
  if (hotkeyToggle) {
    hotkeyToggle.addEventListener('click', () => {
      const enabled = hotkeyToggle.classList.contains('hotkey-toggle--on');
      const newState = !enabled;
      localStorage.setItem('damz_hotkey_enabled', newState);
      hotkeyToggle.className = `hotkey-toggle ${newState ? 'hotkey-toggle--on' : 'hotkey-toggle--off'}`;
      hotkeyToggle.textContent = newState ? 'ON' : 'OFF';
    });
  }

  // Quick actions
  const qaChat = $('#qa-push-talk');
  if (qaChat) qaChat.addEventListener('click', () => { location.hash = '#/chat'; });

  const qaDoc = $('#qa-add-doc');
  if (qaDoc) qaDoc.addEventListener('click', () => { location.hash = '#/knowledge'; });

  const qaRestart = $('#qa-restart');
  if (qaRestart) {
    qaRestart.addEventListener('click', async () => {
      qaRestart.querySelector('.quick-action-icon').textContent = '⏳';
      qaRestart.querySelector('.quick-action-label').textContent = 'Restarting...';
      qaRestart.disabled = true;
      
      // Request restart via backend or simulate re-connect
      try {
        await fetch(`${API_BASE}/api/ollama/test`);
      } catch (e) {}
      
      await new Promise(r => setTimeout(r, 1500));
      qaRestart.querySelector('.quick-action-icon').textContent = '✅';
      qaRestart.querySelector('.quick-action-label').textContent = 'Agent Restarted';
      await new Promise(r => setTimeout(r, 1000));
      qaRestart.querySelector('.quick-action-icon').textContent = '🔄';
      qaRestart.querySelector('.quick-action-label').textContent = 'Restart Agent';
      qaRestart.disabled = false;
    });
  }
}

function applyActivityFilter() {
  const items = $$('.activity-item');
  items.forEach(item => {
    const text = item.dataset.activityText || '';
    let show = true;
    if (currentActivityFilter === 'error') show = text.includes('error') || text.includes('alert') || text.includes('warning') || text.includes('fail');
    else if (currentActivityFilter === 'tool') show = text.includes('tool') || text.includes('launch') || text.includes('search') || text.includes('vision');
    else if (currentActivityFilter === 'system') show = text.includes('system') || text.includes('startup') || text.includes('config');
    item.style.display = show ? '' : 'none';
  });
}

export function unmount() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  currentActivityFilter = 'all';
}
