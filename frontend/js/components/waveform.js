/**
 * DAMZ AGENT — Canvas Waveform Animation
 * Draws animated audio bars in a <canvas> element.
 */

const waveforms = new Map();

/**
 * Create a waveform animation on a canvas element.
 * @param {string} canvasId — ID of the <canvas>
 * @param {{ color?: string, barCount?: number, barWidth?: number, gap?: number }} options
 */
export function createWaveform(canvasId, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const state = {
    ctx,
    canvas,
    width: rect.width,
    height: rect.height,
    phase: 0,
    active: false,
    animId: null,
    options: {
      color: options.color || '#7bdb80',
      barCount: options.barCount || 32,
      barWidth: options.barWidth || 3,
      gap: options.gap || 2,
    },
  };

  waveforms.set(canvasId, state);
  animate(canvasId);
}

/** Start active waveform mode (energetic). */
export function startWaveform(canvasId) {
  const state = waveforms.get(canvasId);
  if (state) state.active = true;
}

/** Stop — return to idle mode (gentle). */
export function stopWaveform(canvasId) {
  const state = waveforms.get(canvasId);
  if (state) state.active = false;
}

/** Destroy the waveform and cancel animation. */
export function destroyWaveform(canvasId) {
  const state = waveforms.get(canvasId);
  if (state && state.animId) {
    cancelAnimationFrame(state.animId);
  }
  waveforms.delete(canvasId);
}

/** Internal animation loop. */
function animate(canvasId) {
  const state = waveforms.get(canvasId);
  if (!state) return;

  state.phase += state.active ? 0.08 : 0.02;
  drawBars(state);
  state.animId = requestAnimationFrame(() => animate(canvasId));
}

/** Draw the bar visualization. */
function drawBars(state) {
  const { ctx, width, height, phase, active, options } = state;
  const { barCount, barWidth, gap, color } = options;

  ctx.clearRect(0, 0, width, height);

  const totalWidth = barCount * (barWidth + gap);
  const startX = (width - totalWidth) / 2;

  for (let i = 0; i < barCount; i++) {
    const x = startX + i * (barWidth + gap);
    let barHeight;

    if (active) {
      // Active: energetic, multi-frequency
      barHeight = (Math.sin(phase + i * 0.3) * 0.4 + 0.5) * height * 0.75;
      barHeight += Math.sin(phase * 2.5 + i * 0.7) * height * 0.15;
      barHeight += Math.sin(phase * 4 + i * 0.15) * height * 0.08;
      barHeight = Math.max(barHeight, 3);
    } else {
      // Idle: gentle sine wave
      barHeight = (Math.sin(phase + i * 0.2) * 0.12 + 0.18) * height;
      barHeight = Math.max(barHeight, 2);
    }

    const y = (height - barHeight) / 2;
    const alpha = active ? (0.6 + Math.sin(phase + i * 0.4) * 0.4) : 0.35;

    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}
