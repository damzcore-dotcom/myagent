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
