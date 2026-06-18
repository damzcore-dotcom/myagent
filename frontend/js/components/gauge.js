/**
 * DAMZ AGENT — SVG Circular Gauge Component
 * Reusable gauge with animated fill, color thresholds, and subtitle.
 */

import { $ } from '../utils/helpers.js';

/**
 * Create a circular SVG gauge inside a container.
 * @param {string} containerId — ID of the container element
 * @param {{ value?: number, label?: string, subtitle?: string }} options
 */
export function createGauge(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { value = 0, label = '', subtitle = '' } = options;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = getGaugeColor(value);

  container.innerHTML = `
    <div class="gauge">
      <svg viewBox="0 0 120 120">
        <circle class="gauge-track" cx="60" cy="60" r="${radius}"/>
        <circle class="gauge-fill" cx="60" cy="60" r="${radius}"
          id="${containerId}-fill"
          stroke="${color}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
        />
      </svg>
      <div class="gauge-center">
        <div class="gauge-value" id="${containerId}-value">${Math.round(value)}%</div>
        <div class="gauge-label">${label}</div>
        ${subtitle ? `<div class="gauge-subtitle" id="${containerId}-subtitle">${subtitle}</div>` : `<div class="gauge-subtitle" id="${containerId}-subtitle"></div>`}
      </div>
    </div>
  `;

  // Store circumference on the container for updates
  container._circumference = circumference;
}

/**
 * Update a gauge to a new value with animation.
 * @param {string} containerId
 * @param {number} value — 0 to 100
 * @param {string} [subtitle] — optional subtitle text to update
 */
export function updateGauge(containerId, value, subtitle) {
  const container = document.getElementById(containerId);
  if (!container || !container._circumference) return;

  const circumference = container._circumference;
  const offset = circumference - (value / 100) * circumference;
  const color = getGaugeColor(value);

  const fill = document.getElementById(`${containerId}-fill`);
  const valueEl = document.getElementById(`${containerId}-value`);
  const subtitleEl = document.getElementById(`${containerId}-subtitle`);

  if (fill) {
    fill.style.strokeDashoffset = offset;
    fill.style.stroke = color;
  }

  if (valueEl) {
    valueEl.textContent = `${Math.round(value)}%`;
  }

  if (subtitleEl && subtitle !== undefined) {
    subtitleEl.textContent = subtitle;
  }
}

/**
 * Get gauge color based on threshold.
 * Green < 60, Yellow 60-80, Red > 80.
 */
function getGaugeColor(value) {
  if (value >= 80) return 'var(--status-red)';
  if (value >= 60) return 'var(--status-yellow)';
  return 'var(--status-green)';
}
