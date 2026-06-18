/**
 * DAMZ AGENT — Terminal Log Renderer
 * Terminal-style log component with line numbers and level coloring.
 */

import { $ } from '../utils/helpers.js';
import { formatTime } from '../utils/helpers.js';

const terminals = new Map();

/**
 * Create a terminal inside a container element.
 * @param {string} containerId
 * @param {{ maxLines?: number, showLineNumbers?: boolean, title?: string }} options
 */
export function createTerminal(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const config = {
    maxLines: options.maxLines || 200,
    showLineNumbers: options.showLineNumbers !== false,
    title: options.title || 'Terminal',
    lineCount: 0,
  };

  container.innerHTML = `
    <div class="terminal">
      <div class="terminal-header">
        <span class="terminal-title">${config.title}</span>
        <div class="terminal-dots">
          <span class="terminal-dot terminal-dot--red"></span>
          <span class="terminal-dot terminal-dot--yellow"></span>
          <span class="terminal-dot terminal-dot--green"></span>
        </div>
      </div>
      <div class="terminal-body" id="${containerId}-body"></div>
    </div>
  `;

  terminals.set(containerId, config);
}

/**
 * Add a line to the terminal.
 * @param {string} containerId
 * @param {string} text — The log text content
 * @param {'info'|'warn'|'error'|'debug'} level
 */
export function addTerminalLine(containerId, text, level = 'info') {
  const config = terminals.get(containerId);
  const body = document.getElementById(`${containerId}-body`);
  if (!config || !body) return;

  config.lineCount++;

  // Check if user is scrolled to bottom (auto-scroll only when pinned)
  const isAtBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 40;

  const line = document.createElement('div');
  line.className = `terminal-line terminal-line--${level}`;
  line.dataset.level = level;

  let html = '';
  if (config.showLineNumbers) {
    html += `<span class="terminal-line-number">${config.lineCount}</span>`;
  }
  html += `<span class="terminal-line-content">${escapeHtml(text)}</span>`;
  line.innerHTML = html;

  body.appendChild(line);

  // Remove oldest lines if exceeding maxLines
  while (body.children.length > config.maxLines) {
    body.removeChild(body.firstChild);
  }

  // Auto-scroll to bottom
  if (isAtBottom) {
    body.scrollTop = body.scrollHeight;
  }
}

/** Clear all lines from the terminal. */
export function clearTerminal(containerId) {
  const config = terminals.get(containerId);
  const body = document.getElementById(`${containerId}-body`);
  if (!config || !body) return;

  body.innerHTML = '';
  config.lineCount = 0;
}

/** Get the terminal body element. */
export function getTerminalBody(containerId) {
  return document.getElementById(`${containerId}-body`);
}

/** Escape HTML special characters. */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
