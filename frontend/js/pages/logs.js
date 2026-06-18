/**
 * DAMZ AGENT — System Logs Page
 * Terminal-style log viewer with real backend log polling, filters, and export.
 */

import { $, $$, debounce, formatTime } from '../utils/helpers.js';
import { createTerminal, addTerminalLine, clearTerminal, getTerminalBody } from '../components/terminal.js';

let autoLogInterval = null;
let currentFilter = 'all';
let currentSearch = '';
let loadedLogCount = 0;

export function render() {
  return `
    <div class="page page-logs">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">System Logs</h1>
          <div class="page-subtitle">Agent Operation Log</div>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" id="logs-export-btn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
          <button class="btn btn-danger" id="logs-clear-btn">Clear</button>
        </div>
      </div>

      <div class="logs-toolbar">
        <button class="log-filter-btn active" data-level="all">All</button>
        <button class="log-filter-btn" data-level="info">Info</button>
        <button class="log-filter-btn" data-level="warn">Warn</button>
        <button class="log-filter-btn" data-level="error">Error</button>
        <button class="log-filter-btn" data-level="debug">Debug</button>
        <input type="text" class="input logs-search" id="logs-search"
          placeholder="Grep logs...">
      </div>

      <div id="logs-terminal"></div>
    </div>
  `;
}

async function fetchLogs() {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/logs');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.logs) {
        const logs = data.logs;
        
        // If logs list got cleared or reset
        if (logs.length < loadedLogCount) {
          clearTerminal('logs-terminal');
          loadedLogCount = 0;
        }

        // Add new log lines
        const newLogs = logs.slice(loadedLogCount);
        newLogs.forEach(entry => {
          const line = formatLogLine(entry);
          addTerminalLine('logs-terminal', line, entry.level);
          
          // Apply current filter to the new line
          applyFilterToLastLine(entry.level);
        });

        loadedLogCount = logs.length;
      }
    }
  } catch (err) {
    console.error('[LOGS] Failed to fetch logs from backend:', err);
  }
}

export function mount() {
  loadedLogCount = 0;

  // Create terminal
  createTerminal('logs-terminal', {
    title: 'System Log',
    maxLines: 300,
    showLineNumbers: true,
  });

  // Initial fetch
  fetchLogs();

  // Poll for logs every 2 seconds
  autoLogInterval = setInterval(fetchLogs, 2000);

  // Filter buttons
  $$('.log-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.log-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.level;
      applyFilters();
    });
  });

  // Search
  const searchInput = $('#logs-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      currentSearch = e.target.value.trim().toLowerCase();
      applyFilters();
    }, 250));
  }

  // Export
  const exportBtn = $('#logs-export-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportLogs);

  // Clear
  const clearBtn = $('#logs-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearTerminal('logs-terminal');
      loadedLogCount = 0;
      addTerminalLine('logs-terminal', formatLogLine({
        timestamp: new Date().toISOString(),
        level: 'info',
        source: 'SYSTEM',
        message: 'Log buffer cleared',
      }), 'info');
    });
  }
}

function formatLogLine(entry) {
  const time = formatTime(entry.timestamp);
  const level = entry.level.toUpperCase().padEnd(5);
  return `[${time}] [${level}] [${entry.source}] ${entry.message}`;
}

function applyFilters() {
  const body = getTerminalBody('logs-terminal');
  if (!body) return;

  const lines = body.querySelectorAll('.terminal-line');
  lines.forEach(line => {
    const level = line.dataset.level || '';
    const content = line.textContent.toLowerCase();

    let show = true;
    if (currentFilter !== 'all' && level !== currentFilter) show = false;
    if (currentSearch && !content.includes(currentSearch)) show = false;

    line.style.display = show ? '' : 'none';
  });
}

function applyFilterToLastLine(level) {
  if (currentFilter !== 'all' && level !== currentFilter) {
    const body = getTerminalBody('logs-terminal');
    if (body && body.lastElementChild) {
      body.lastElementChild.style.display = 'none';
    }
  }
  if (currentSearch) {
    const body = getTerminalBody('logs-terminal');
    if (body && body.lastElementChild) {
      const content = body.lastElementChild.textContent.toLowerCase();
      if (!content.includes(currentSearch)) {
        body.lastElementChild.style.display = 'none';
      }
    }
  }
}

function exportLogs() {
  const body = getTerminalBody('logs-terminal');
  if (!body) return;

  const lines = body.querySelectorAll('.terminal-line-content');
  const text = Array.from(lines).map(l => l.textContent).join('\n');

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `damz_agent_logs_${date}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function unmount() {
  if (autoLogInterval) {
    clearInterval(autoLogInterval);
    autoLogInterval = null;
  }
  currentFilter = 'all';
  currentSearch = '';
}
