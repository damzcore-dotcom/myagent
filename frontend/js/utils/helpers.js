/**
 * DAMZ AGENT — Utility Helpers
 * DOM shortcuts, formatters, animation utilities.
 */

/** @param {string} sel @param {Element} parent */
export const $ = (sel, parent = document) => parent.querySelector(sel);
export const $$ = (sel, parent = document) => [...parent.querySelectorAll(sel)];

/**
 * Create a DOM element with optional class and innerHTML.
 */
export function createElement(tag, className = '', innerHTML = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (innerHTML) el.innerHTML = innerHTML;
  return el;
}

/** Format bytes to human readable string. */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Format a date/timestamp to HH:MM:SS (24h). */
export function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

/** Format a date to "Jun 18, 2026". */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

/** Format duration from milliseconds to "2h 34m". */
export function formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Debounce a function. */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Throttle a function. */
export function throttle(fn, limit = 100) {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

/** Random float between min and max. */
export function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Animate a numeric value in an element from start to end.
 * Uses easeOutQuad easing for smooth deceleration.
 */
export function animateValue(element, start, end, duration = 800) {
  if (!element) return;
  const startTime = performance.now();
  const diff = end - start;

  function easeOutQuad(t) {
    return t * (2 - t);
  }

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutQuad(progress);
    const current = Math.round(start + diff * easedProgress);
    element.textContent = current;
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

/**
 * Typewriter effect — types text character by character.
 * @returns {Promise<void>} Resolves when complete.
 */
export async function typeWriter(element, text, speed = 25, scrollContainer = null) {
  if (!element) return;
  element.textContent = '';
  for (let i = 0; i < text.length; i++) {
    element.textContent += text[i];
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
    await sleep(speed);
  }
}

/** Sleep for given milliseconds. */
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Generate a short unique ID. */
export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/** Clamp a number between min and max. */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Display a premium dark themed confirmation modal dialog instead of browser confirm() */
export function showModalConfirm(message, onConfirm, onCancel) {
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
    background: var(--primary);
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
    white-space: pre-line;
  `;
  body.textContent = message;
  card.appendChild(body);

  // Button Wrapper
  const btnWrapper = document.createElement('div');
  btnWrapper.style.cssText = `
    display: flex;
    justify-content: center;
    gap: 12px;
  `;

  // Cancel Button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.style.cssText = `
    padding: 8px 20px;
    font-size: 12px;
    min-width: 100px;
    justify-content: center;
  `;
  cancelBtn.textContent = 'Batal';
  btnWrapper.appendChild(cancelBtn);

  // Confirm Button
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.style.cssText = `
    padding: 8px 20px;
    font-size: 12px;
    min-width: 100px;
    justify-content: center;
  `;
  confirmBtn.textContent = 'Ya';
  btnWrapper.appendChild(confirmBtn);
  card.appendChild(btnWrapper);

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const close = (confirmed) => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.15s ease';
    card.style.transform = 'translateY(12px)';
    card.style.transition = 'transform 0.15s ease';
    setTimeout(() => {
      document.body.removeChild(overlay);
      if (confirmed) {
        if (onConfirm) onConfirm();
      } else {
        if (onCancel) onCancel();
      }
    }, 150);
  };

  confirmBtn.addEventListener('click', () => close(true));
  cancelBtn.addEventListener('click', () => close(false));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(false);
  });
}
