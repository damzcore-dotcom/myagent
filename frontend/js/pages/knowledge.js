/**
 * DAMZ AGENT — Knowledge Base Page
 * Document upload, list, stats, and real keyword search.
 */

import { $, $$, formatBytes, formatDate, animateValue, debounce } from '../utils/helpers.js';

let docs = [];

export function render() {
  const totalDocs = docs.filter(d => d.status === 'indexed').length;
  const totalChunks = docs.reduce((sum, d) => sum + d.chunks, 0);
  const totalSize = docs.reduce((sum, d) => sum + d.size, 0);

  return `
    <div class="page page-knowledge">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Knowledge Base</h1>
          <div class="page-subtitle">RAG Document Management</div>
        </div>
        <div class="page-header-actions">
          <span class="badge badge--green" id="kb-header-badge">${totalDocs} Indexed</span>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="stats-bar">
        <div class="card stat-card">
          <div class="card-title">Documents</div>
          <div class="card-value" id="kb-stat-docs">0</div>
        </div>
        <div class="card stat-card">
          <div class="card-title">Total Chunks</div>
          <div class="card-value" id="kb-stat-chunks">0</div>
        </div>
        <div class="card stat-card">
          <div class="card-title">Storage Used</div>
          <div class="card-value" style="font-size:22px" id="kb-stat-size">${formatBytes(totalSize)}</div>
        </div>
      </div>

      <!-- Upload Zone -->
      <div class="card" style="margin-bottom:var(--space-4)">
        <div class="card-title" style="margin-bottom:var(--space-3)">Upload Documents</div>
        <div class="upload-zone" id="upload-zone">
          <div class="upload-zone-icon">📁</div>
          <div class="upload-zone-text">Drop PDF, TXT, or DOCX files here</div>
          <div class="upload-zone-hint">or click to browse</div>
          <input type="file" id="file-input" multiple accept=".pdf,.txt,.docx"
            style="display:none">
        </div>
      </div>

      <!-- Document Table -->
      <div class="card" style="margin-bottom:var(--space-4)">
        <div class="card-header">
          <div class="card-title">Indexed Documents</div>
        </div>
        <div class="card-body" style="overflow-x:auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Chunks</th>
                <th>Indexed</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="doc-table-body">
              ${renderDocRows()}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Search -->
      <div class="card search-section">
        <div class="card-title" style="margin-bottom:var(--space-3)">Semantic Search</div>
        <div class="input-group">
          <input type="text" class="input" id="kb-search"
            placeholder="Search your knowledge base...">
          <button class="btn btn-primary" id="kb-search-btn">Search</button>
        </div>
        <div class="search-results" id="kb-search-results"></div>
      </div>
    </div>
  `;
}

function renderDocRows() {
  if (docs.length === 0) {
    return `<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No documents indexed yet.</td></tr>`;
  }
  return docs.map(doc => {
    const typeClass = { pdf: 'badge--blue', txt: 'badge--green', docx: 'badge--yellow' }[doc.type] || 'badge--blue';
    const statusClass = { indexed: 'badge--green', pending: 'badge--yellow', indexing: 'badge--yellow', error: 'badge--red' }[doc.status] || 'badge--blue';
    const isIndexing = doc.status === 'indexing' || doc.status === 'pending';

    return `
      <tr id="row-${doc.id}">
        <td data-label="Name" class="truncate" style="max-width:200px" title="${doc.name}">${doc.name}</td>
        <td data-label="Type"><span class="badge ${typeClass}">${doc.type.toUpperCase()}</span></td>
        <td data-label="Size">${formatBytes(doc.size)}</td>
        <td data-label="Chunks" id="chunks-${doc.id}">${doc.chunks}</td>
        <td data-label="Indexed" id="date-${doc.id}">${doc.indexedAt ? formatDate(doc.indexedAt) : '—'}</td>
        <td data-label="Status">
          <div style="display:flex; flex-direction:column; gap:4px">
            <span class="badge ${statusClass}" id="status-${doc.id}">${doc.status}</span>
            ${isIndexing ? `
              <div class="progress-bar-container" id="progress-cont-${doc.id}" style="width: 80px; height: 4px; background: var(--surface-container); border-radius: var(--radius-sm); overflow: hidden;">
                <div class="progress-bar-fill" id="progress-${doc.id}" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.2s ease;"></div>
              </div>
            ` : ''}
          </div>
        </td>
        <td data-label="Actions">
          <div style="display:flex; gap:4px">
            <button class="btn btn-ghost btn-sm reindex-btn" data-doc-id="${doc.id}" title="Re-index" ${isIndexing ? 'disabled' : ''}>🔄</button>
            <button class="btn btn-ghost btn-sm delete-btn" data-doc-id="${doc.id}" title="Delete">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function fetchDocuments() {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/documents');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.documents) {
        docs = data.documents;
        
        const tbody = $('#doc-table-body');
        if (tbody) tbody.innerHTML = renderDocRows();
        
        updateStats();
      }
    }
  } catch (err) {
    console.error('[KNOWLEDGE] Gagal mengambil dokumen dari backend.', err);
  }
}

export function mount() {
  const uploadZone = $('#upload-zone');
  const fileInput = $('#file-input');
  const searchInput = $('#kb-search');
  const searchBtn = $('#kb-search-btn');

  // Load real documents from backend
  fetchDocuments();

  // Upload zone — click to browse
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());

    // Drag and drop
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
      handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
      handleFiles(fileInput.files);
      fileInput.value = '';
    });
  }

  // Search input and button
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      handleSearch(e.target.value.trim());
    }, 400));
  }
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      handleSearch(searchInput.value.trim());
    });
  }

  // Delete & Reindex (event delegation)
  const tbody = $('#doc-table-body');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      // Delete
      const deleteBtn = e.target.closest('.delete-btn');
      if (deleteBtn) {
        const docId = deleteBtn.dataset.docId;
        const doc = docs.find(d => d.id === docId);
        if (doc) {
          if (!confirm(`Hapus dokumen "${doc.name}" dari RAG?`)) return;
          fetch(`http://127.0.0.1:3001/api/documents/${encodeURIComponent(doc.name)}`, {
            method: 'DELETE'
          }).then(res => res.json()).then(data => {
            if (data.success) {
              docs = docs.filter(d => d.id !== docId);
              tbody.innerHTML = renderDocRows();
              updateStats();
            }
          }).catch(err => {
            console.error('Gagal menghapus dokumen dari backend:', err);
          });
        }
        return;
      }

      // Reindex
      const reindexBtn = e.target.closest('.reindex-btn');
      if (reindexBtn) {
        const docId = reindexBtn.dataset.docId;
        startIndexing(docId);
      }
    });
  }
}

function startIndexing(docId) {
  const doc = docs.find(d => d.id === docId);
  if (!doc) return;

  doc.status = 'indexing';
  const tbody = $('#doc-table-body');
  if (tbody) tbody.innerHTML = renderDocRows();

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 15) + 10;
    const fillEl = document.getElementById(`progress-${docId}`);
    if (fillEl) fillEl.style.width = `${progress}%`;

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        doc.status = 'indexed';
        doc.chunks = Math.max(1, Math.round(doc.size / 512));
        doc.indexedAt = new Date().toISOString();
        if (tbody) tbody.innerHTML = renderDocRows();
        updateStats();
      }, 400);
    }
  }, 200);
}

function handleFiles(fileList) {
  if (!fileList || fileList.length === 0) return;
  Array.from(fileList).forEach(f => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const newId = 'doc-' + Math.random().toString(36).slice(2, 6);
      
      docs.push({
        id: newId,
        name: f.name,
        type: f.name.split('.').pop().toLowerCase(),
        size: f.size,
        chunks: 0,
        indexedAt: null,
        status: 'pending',
      });
      const tbody = $('#doc-table-body');
      if (tbody) tbody.innerHTML = renderDocRows();
      
      try {
        const res = await fetch('http://127.0.0.1:3001/api/documents/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: f.name, base64 })
        });
        const data = await res.json();
        if (data.success) {
          startIndexing(newId);
        } else {
          const doc = docs.find(d => d.id === newId);
          if (doc) {
            doc.status = 'error';
            if (tbody) tbody.innerHTML = renderDocRows();
          }
        }
      } catch (err) {
        console.error('Gagal mengupload file ke backend:', err);
        const doc = docs.find(d => d.id === newId);
        if (doc) {
          doc.status = 'error';
          if (tbody) tbody.innerHTML = renderDocRows();
        }
      }
    };
    reader.readAsDataURL(f);
  });
}

function updateStats() {
  const totalDocs = docs.filter(d => d.status === 'indexed').length;
  const totalChunks = docs.reduce((sum, d) => sum + d.chunks, 0);
  const totalSize = docs.reduce((sum, d) => sum + d.size, 0);

  const docsEl = $('#kb-stat-docs');
  const chunksEl = $('#kb-stat-chunks');
  const sizeEl = $('#kb-stat-size');
  const countBadge = $('#kb-header-badge');

  if (docsEl) docsEl.textContent = totalDocs;
  if (chunksEl) chunksEl.textContent = totalChunks;
  if (sizeEl) sizeEl.textContent = formatBytes(totalSize);
  if (countBadge) countBadge.textContent = `${totalDocs} Indexed`;
}

async function handleSearch(query) {
  const resultsEl = $('#kb-search-results');
  if (!resultsEl) return;

  if (!query) {
    resultsEl.innerHTML = '';
    return;
  }

  resultsEl.innerHTML = `<div style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono)">Searching...</div>`;

  try {
    const res = await fetch('http://127.0.0.1:3001/api/documents/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.results) {
        if (data.results.length === 0) {
          resultsEl.innerHTML = `<div style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);margin-top:8px">No matching documents found.</div>`;
          return;
        }
        resultsEl.innerHTML = `
          <div style="margin-top:12px">
            <div class="label-sm text-muted" style="margin-bottom:8px">Results for "${query}"</div>
            ${data.results.map(r => `
              <div class="card" style="margin-bottom:8px;padding:12px">
                <div style="font-size:13px;color:var(--text-primary);font-family:var(--font-mono)">
                  Found match in <strong>${r.filename}</strong> with score ${r.score}
                </div>
                <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-top:4px">
                  Matches: ${r.matchCount} occurrences
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }
  } catch (err) {
    resultsEl.innerHTML = `<div style="font-size:12px;color:var(--status-red);font-family:var(--font-mono)">Search failed: ${err.message}</div>`;
  }
}

export function unmount() {}
