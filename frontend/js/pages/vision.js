/**
 * DAMZ AGENT — Vision Page
 * Local image analysis with drag-drop, OCR, and analysis history.
 */

import { $, formatDate, sleep } from '../utils/helpers.js';

let visionHistory = [];

function loadVisionHistory() {
  try {
    const saved = localStorage.getItem('damz_vision_history');
    if (saved) {
      visionHistory = JSON.parse(saved);
      return;
    }
  } catch (e) {}
  visionHistory = [];
  saveVisionHistory();
}

function saveVisionHistory() {
  localStorage.setItem('damz_vision_history', JSON.stringify(visionHistory));
}

export function render() {
  loadVisionHistory();
  return `
    <div class="page page-vision">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Vision</h1>
          <div class="page-subtitle">Local Image Analysis</div>
        </div>
        <div class="page-header-actions">
          <span class="badge badge--green">🔒 100% Local</span>
        </div>
      </div>

      <div class="vision-grid">
        <!-- Left: Upload & Preview -->
        <div>
          <div class="card" style="margin-bottom:var(--space-4)">
            <div class="card-title" style="margin-bottom:var(--space-3)">Image Input</div>
            <div class="upload-zone" id="vision-upload">
              <div class="upload-zone-icon">👁️</div>
              <div class="upload-zone-text">Drop an image to analyze</div>
              <div class="upload-zone-hint">Supports PNG, JPG, WEBP</div>
              <input type="file" id="vision-file-input" accept="image/*" style="display:none">
            </div>
          </div>
          <div class="card hidden" id="vision-preview-card">
            <div class="card-title" style="margin-bottom:var(--space-3)">Preview</div>
            <div class="image-preview" id="vision-preview"></div>
            <div style="margin-top:var(--space-3);text-align:center">
              <button class="btn btn-primary" id="analyze-btn">Analyze Image</button>
            </div>
          </div>
        </div>

        <!-- Right: Analysis Results -->
        <div>
          <div class="card" id="vision-results-card">
            <div class="card-title" style="margin-bottom:var(--space-3)">Analysis Results</div>
            <div class="card-body" id="vision-results">
              <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-text">Drop an image to begin analysis</div>
                <div class="empty-state-hint">All processing happens locally on your device</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- History -->
      <div class="card" style="margin-top:var(--space-4)">
        <div class="card-header">
          <div class="card-title">Analysis History</div>
          <span class="badge badge--blue" id="vision-history-count">${visionHistory.length} Analyzed</span>
        </div>
        <div class="card-body">
          <div class="history-grid" id="vision-history-grid">
            ${renderHistoryGrid()}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderHistoryGrid() {
  if (visionHistory.length === 0) {
    return `<div style="padding:16px;color:var(--text-muted);font-family:var(--font-mono);font-size:12px">No analysis history found.</div>`;
  }
  return visionHistory.map(item => `
    <div class="card" style="padding:var(--space-3);cursor:pointer" data-vision-id="${item.id}">
      <div class="history-thumb">🖼️</div>
      <div style="font-family:var(--font-mono);font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:4px" class="truncate">
        ${item.filename}
      </div>
      <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">
        ${formatDate(item.analyzedAt)}
      </div>
      <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
        ${item.description}
      </div>
    </div>
  `).join('');
}

export function mount() {
  const uploadZone = $('#vision-upload');
  const fileInput = $('#vision-file-input');
  const analyzeBtn = $('#analyze-btn');

  // Upload zone
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('upload-zone--active');
    });
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('upload-zone--active');
    });
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('upload-zone--active');
      if (e.dataTransfer.files.length > 0) handleImageFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) handleImageFile(fileInput.files[0]);
      fileInput.value = '';
    });
  }

  // Analyze button
  if (analyzeBtn) analyzeBtn.addEventListener('click', runAnalysis);

  // History items click
  mountHistoryClickHandlers();
}

function mountHistoryClickHandlers() {
  const historyItems = document.querySelectorAll('[data-vision-id]');
  historyItems.forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.visionId;
      const entry = visionHistory.find(h => h.id === id);
      if (entry) showHistoryResult(entry);
    });
  });
}

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const previewCard = $('#vision-preview-card');
    const preview = $('#vision-preview');
    if (previewCard) previewCard.classList.remove('hidden');
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
      preview._filename = file.name;
      preview._base64 = e.target.result.split(',')[1];
    }
    // Automatically trigger local analysis
    runAnalysis();
  };
  reader.readAsDataURL(file);
}

async function runAnalysis() {
  const resultsEl = $('#vision-results');
  const btn = $('#analyze-btn');
  const preview = $('#vision-preview');
  if (!resultsEl || !btn || !preview || !preview._base64) return;

  btn.disabled = true;
  btn.textContent = 'Analyzing...';

  resultsEl.innerHTML = `
    <div style="text-align:center;padding:24px;color:var(--text-muted);font-family:var(--font-mono);font-size:13px">
      <div style="margin-bottom:12px">🔄 Processing image locally...</div>
      <div class="waveform-bars" style="justify-content:center">
        ${Array.from({length:7}, (_,i) => `<span style="--i:${i+1}"></span>`).join('')}
      </div>
    </div>
  `;

  const filename = preview._filename || 'image.png';
  const base64 = preview._base64;

  // Get active vision model if set in settings
  const savedSettings = localStorage.getItem('damz_settings');
  let visionModel = 'llama3.2-vision:11b';
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      if (parsed.model && parsed.model.active) {
        visionModel = parsed.model.active;
      }
    } catch (e) {}
  }

  try {
    const res = await fetch('http://localhost:3001/api/vision/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, base64, model: visionModel })
    });
    if (res.ok) {
      const data = await res.json();
      
      resultsEl.innerHTML = `
        <div style="margin-bottom:var(--space-4)">
          <div class="label-sm text-muted" style="margin-bottom:8px">AI Description</div>
          <div class="analysis-result">${escapeHtml(data.description)}</div>
        </div>
        <hr class="divider">
        <div>
          <div class="label-sm text-muted" style="margin-bottom:8px">OCR — Extracted Text</div>
          <div class="terminal" style="margin-top:8px">
            <div class="terminal-body" style="padding:12px 16px;max-height:150px">
              <pre style="margin:0;font-family:var(--font-mono);font-size:13px;color:var(--text-primary);white-space:pre-wrap;">${escapeHtml(data.ocrText)}</pre>
            </div>
          </div>
        </div>
        <div style="margin-top:var(--space-3)">
          <span class="badge badge--green">Analysis Complete</span>
        </div>
      `;

      // Save to history
      const historyItem = {
        id: 'vis-' + Math.random().toString(36).slice(2, 6),
        filename,
        analyzedAt: new Date().toISOString(),
        description: data.description,
        ocrText: data.ocrText
      };
      visionHistory.unshift(historyItem);
      if (visionHistory.length > 20) visionHistory.pop();
      saveVisionHistory();

      // Update history UI
      const countEl = $('#vision-history-count');
      if (countEl) countEl.textContent = `${visionHistory.length} Analyzed`;
      const grid = $('#vision-history-grid');
      if (grid) grid.innerHTML = renderHistoryGrid();
      mountHistoryClickHandlers();
    }
  } catch (err) {
    resultsEl.innerHTML = `<div style="font-size:12px;color:var(--status-red);font-family:var(--font-mono)">Analysis failed: ${err.message}</div>`;
  }

  btn.disabled = false;
  btn.textContent = 'Analyze Image';
}

function showHistoryResult(entry) {
  const resultsEl = $('#vision-results');
  if (!resultsEl) return;

  resultsEl.innerHTML = `
    <div style="margin-bottom:var(--space-4)">
      <div class="label-sm text-muted" style="margin-bottom:4px">${escapeHtml(entry.filename)}</div>
      <div class="label-sm text-muted" style="margin-bottom:12px;opacity:0.6">${formatDate(entry.analyzedAt)}</div>
      <div class="label-sm text-muted" style="margin-bottom:8px">AI Description</div>
      <div class="analysis-result">${escapeHtml(entry.description)}</div>
    </div>
    <hr class="divider">
    <div>
      <div class="label-sm text-muted" style="margin-bottom:8px">OCR — Extracted Text</div>
      <div class="terminal" style="margin-top:8px">
        <div class="terminal-body" style="padding:12px 16px;max-height:150px">
          <pre style="margin:0;font-family:var(--font-mono);font-size:13px;color:var(--text-primary);white-space:pre-wrap;">${escapeHtml(entry.ocrText)}</pre>
        </div>
      </div>
    </div>
    <div style="margin-top:var(--space-3)">
      <span class="badge badge--green">From History</span>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function unmount() {}
