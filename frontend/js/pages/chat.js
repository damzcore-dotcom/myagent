/**
 * DAMZ AGENT — Chat Page
 * Interactive chat with real voice input (Web Speech API), persistent history,
 * and Ollama chat proxy backend.
 */

import { $, $$, uid, formatTime, typeWriter, sleep } from '../utils/helpers.js';
import { API_BASE } from '../utils/config.js';
import { getCurrentUser } from './login.js';

let chatMessages = [];
let attachedFiles = [];
let isRecording = false;
let selectedMicId = localStorage.getItem('damz_selected_mic') || 'default';
let isHoldToRecord = localStorage.getItem('damz_hold_to_record') === 'true';
let recognition = null;
let isTtsEnabled = localStorage.getItem('damz_output_mode') !== 'text'; // ON if mode is both/voice
let currentUtterance = null;
let currentAudio = null;

// Meeting Recorder State Variables
let currentChatMode = 'chat'; // 'chat' | 'recorder'
let recorderState = 'idle';   // 'idle' | 'recording' | 'paused' | 'processing' | 'done'
let mediaRecorder = null;
let audioChunks = [];
let recognitionContinuous = null; // SpeechRecognition for continuous transcript in recorder mode
let transcriptLines = [];     // Array of {timestamp, text}
let recordingStartTime = null;
let recordingDuration = 0;
let timerInterval = null;
let meetingInfo = { title: '', date: '', participants: '' };
let generatedMinutes = null;  // AI-generated meeting minutes
let recordingsList = [];
let audioContext = null;
let analyser = null;
let animationFrameId = null;
let stream = null;
let activeRecordingId = null; // Store currently selected/recorded recordingId
let sttRetryCount = 0;        // Retry counter for continuous STT auto-restart
const MAX_STT_RETRIES = 5;    // Max retry attempts before stopping

function handleTtsChange(e) {
  isTtsEnabled = e.detail.enabled;
  updateTtsToggleBtnUI();
  if (!isTtsEnabled && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function updateTtsToggleBtnUI() {
  const ttsToggleBtn = $('#tts-toggle-btn');
  if (!ttsToggleBtn) return;

  ttsToggleBtn.style.background = isTtsEnabled ? 'rgba(35,134,54,0.15)' : 'rgba(139,148,158,0.1)';
  ttsToggleBtn.style.borderColor = isTtsEnabled ? 'var(--primary-container)' : 'var(--border)';
  ttsToggleBtn.title = isTtsEnabled ? 'Matikan Suara Agen' : 'Aktifkan Suara Agen';

  const speakerIcon = ttsToggleBtn.querySelector('svg');
  const speakerLabel = ttsToggleBtn.querySelector('span');

  if (speakerIcon) {
    speakerIcon.setAttribute('stroke', isTtsEnabled ? 'var(--primary)' : 'var(--text-muted)');
    speakerIcon.innerHTML = isTtsEnabled
      ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>`
      : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`;
  }
  if (speakerLabel) {
    speakerLabel.style.color = isTtsEnabled ? 'var(--primary)' : 'var(--text-muted)';
    speakerLabel.textContent = isTtsEnabled ? 'Suara ON' : 'Suara OFF';
  }
}

const MIC_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

function loadChatHistory() {
  try {
    const user = getCurrentUser();
    const historyKey = user && user.email ? `damz_chat_history_${user.email.toLowerCase().trim()}` : 'damz_chat_history';
    const saved = localStorage.getItem(historyKey);
    if (saved) {
      chatMessages = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('[CHAT] Gagal memuat chat history:', e);
  }
  
  // Default welcome message
  chatMessages = [
    {
      id: 'msg-welcome',
      role: 'agent',
      content: 'Halo! Saya Damz Agent, asisten AI lokal Anda. Semua sistem berjalan normal. Ada yang bisa saya bantu hari ini?',
      timestamp: new Date().toISOString(),
      model: 'qwen2.5:7b',
      latency: 0
    }
  ];
  saveChatHistory();
}

function saveChatHistory() {
  const user = getCurrentUser();
  const historyKey = user && user.email ? `damz_chat_history_${user.email.toLowerCase().trim()}` : 'damz_chat_history';
  
  // Apply limit: keep only the last 50 messages
  const maxMessages = 50;
  if (chatMessages.length > maxMessages) {
    const welcome = chatMessages.find(m => m.id === 'msg-welcome');
    let trimmed = chatMessages.filter(m => m.id !== 'msg-welcome');
    if (trimmed.length > maxMessages - 1) {
      trimmed = trimmed.slice(trimmed.length - (maxMessages - 1));
    }
    chatMessages = welcome ? [welcome, ...trimmed] : trimmed;
  }

  // Sanitize attachments to prevent QuotaExceededError in localStorage
  const sanitized = chatMessages.map(msg => {
    if (msg.attachments && Array.isArray(msg.attachments)) {
      return {
        ...msg,
        attachments: msg.attachments.map(att => ({
          name: att.name,
          type: att.type,
          size: att.size
        }))
      };
    }
    return msg;
  });
  
  localStorage.setItem(historyKey, JSON.stringify(sanitized));
}

function initSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    // Get language
    const saved = localStorage.getItem('damz_settings');
    let lang = 'id-ID';
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.stt && parsed.stt.language) {
          lang = parsed.stt.language === 'English' ? 'en-US' : 'id-ID';
        }
      } catch (e) {
        console.warn('[CHAT] Gagal parse speech settings:', e);
      }
    }
    recognition.lang = lang;

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        appendUserMessage(transcript.trim());
        await handleChatResponse(transcript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        showChatToast(`Voice recognition error: ${event.error}`, 'error');
      }
      stopRecordingUI();
    };

    recognition.onend = () => {
      stopRecordingUI();
    };
  }
}

export function render() {
  loadChatHistory();
  initSpeechRecognition();

  // Get current active model name
  const savedSettings = localStorage.getItem('damz_settings');
  let activeModel = 'qwen2.5:7b';
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      if (parsed.model && parsed.model.active) {
        activeModel = parsed.model.active;
      }
    } catch(e) {
      console.warn('[CHAT] Gagal parse active model settings:', e);
    }
  }

  const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <div class="page-chat">
      <div class="chat-header">
        <div style="display:flex;align-items:center;gap:15px">
          <div class="chat-header-title" id="chat-header-title-text">${currentChatMode === 'chat' ? 'Interactive Chat' : 'Meeting Recorder'}</div>
          <!-- Mode Switcher Segmented Control -->
          <div class="chat-mode-switcher">
            <button class="${currentChatMode === 'chat' ? 'active' : ''}" id="switch-mode-chat">
              💬 Chat
            </button>
            <button class="${currentChatMode === 'recorder' ? 'active' : ''}" id="switch-mode-recorder">
              🎙️ Recorder
            </button>
          </div>
          <span class="badge badge--green">Online</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="status-indicator">
            <span class="status-dot status-dot--ready"></span>
            <span class="status-label">${activeModel}</span>
          </span>
          <!-- TTS Toggle Button -->
          <button id="tts-toggle-btn" title="${isTtsEnabled ? 'Matikan Suara Agen' : 'Aktifkan Suara Agen'}" style="
            display: flex; align-items: center; gap: 6px;
            background: ${isTtsEnabled ? 'rgba(35,134,54,0.15)' : 'rgba(139,148,158,0.1)'};
            border: 1px solid ${isTtsEnabled ? 'var(--primary-container)' : 'var(--border)'};
            border-radius: var(--radius-full);
            padding: 4px 10px 4px 8px;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            <svg viewBox="0 0 24 24" fill="none" stroke="${isTtsEnabled ? 'var(--primary)' : 'var(--text-muted)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;flex-shrink:0">
              ${isTtsEnabled
                ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>`
                : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`
              }
            </svg>
            <span style="font-family:var(--font-mono);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${isTtsEnabled ? 'var(--primary)' : 'var(--text-muted)'}">${isTtsEnabled ? 'Suara ON' : 'Suara OFF'}</span>
          </button>
        </div>
      </div>

      <!-- Chat Mode Container -->
      <div class="chat-container ${currentChatMode === 'chat' ? '' : 'hidden'}" id="chat-mode-container">
        <div class="chat-messages" id="chat-messages">
          ${renderMessages()}
        </div>
        <div id="chat-attachment-preview" class="chat-attachment-preview hidden"></div>
        <div class="chat-input-area" style="position: relative;">
          <div class="mic-controls-wrapper" style="display:flex; align-items:center; gap:4px">
            <button class="voice-btn" id="voice-btn" title="Voice Input">
              ${MIC_ICON}
              <span class="voice-btn-ring"></span>
            </button>
            <button class="btn btn-ghost" id="mic-settings-btn" style="padding: 2px 6px; height: 32px; border-radius: var(--radius-md); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center;" title="Microphone Settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px; color: var(--text-muted)"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
          <!-- Attachment controls -->
          <div style="display:flex; align-items:center; gap:4px">
            <button class="btn btn-ghost btn-icon" id="attach-file-btn" title="Lampirkan Dokumen/Gambar" style="width:36px; height:36px; border-radius:50%; flex-shrink:0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px; color: var(--text-muted)"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon" id="attach-camera-btn" title="Ambil Foto Kamera" style="width:36px; height:36px; border-radius:50%; flex-shrink:0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px; color: var(--text-muted)"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </button>
            <input type="file" id="file-input" style="display:none" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt">
            <input type="file" id="camera-input" style="display:none" accept="image/*" capture="environment">
          </div>
          <input type="text" class="input chat-input" id="chat-input"
            placeholder="${isHoldToRecord ? '> Hold the mic button to talk...' : '> Type a message or press the mic...'}" autocomplete="off">
          <button class="btn btn-primary btn-icon" id="send-btn" title="Send">
            ${SEND_ICON}
          </button>

          <!-- Mic Settings Popover -->
          <div class="mic-settings-popover hidden" id="mic-settings-popover" style="position: absolute; bottom: 70px; left: 16px; width: 320px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.5); font-family: var(--font-mono)">
            <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px; height:12px"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
              Input Microphone
            </div>
            <div class="mic-device-list" id="mic-device-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 150px; overflow-y: auto; margin-bottom: 12px;">
              <!-- Microphone items -->
            </div>
            <div class="divider" style="margin: 8px 0; border-top: 1px solid var(--border)"></div>
            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 4px;">
              <span style="font-size: 12px; color: var(--text-primary);">Hold to record</span>
              <button class="toggle ${isHoldToRecord ? 'active' : ''}" id="hold-to-record-toggle">
                <span class="toggle-knob"></span>
              </button>
            </div>
          </div>
          <div class="toast hidden" id="chat-toast" style="position: absolute; top: -50px; left: 50%; transform: translateX(-50%); z-index: 1000; font-family: var(--font-mono)"></div>
        </div>
      </div>

      <!-- Recorder Mode Container -->
      <div class="recorder-container ${currentChatMode === 'recorder' ? '' : 'hidden'}" id="recorder-mode-container">
        <div class="recorder-layout" id="recorder-layout-wrapper">
          <!-- Card 1: Perekam & Live Transcript -->
          <div class="recorder-card">
            <div class="recorder-card-title">
              <span style="display:flex;align-items:center;gap:6px">🎙️ Perekam Rapat</span>
              <span class="badge" id="recorder-status-badge" style="background:var(--surface-highest); border:1px solid var(--border)">Idle</span>
            </div>
            
            <!-- Meeting Info Form -->
            <div class="meeting-info-form" id="rec-info-form">
              <div class="form-group full-width">
                <label>Judul Rapat</label>
                <input type="text" id="rec-meeting-title" placeholder="Masukkan judul rapat...">
              </div>
              <div class="form-group">
                <label>Tanggal Rapat</label>
                <input type="date" id="rec-meeting-date" value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group">
                <label>Peserta (Opsional)</label>
                <input type="text" id="rec-meeting-participants" placeholder="Andi, Budi, Susi">
              </div>
            </div>

            <!-- Audio Visualizer and Controls -->
            <div class="recording-controls-wrapper">
              <div class="timer-display" id="rec-timer-display">
                <span class="rec-pulse-dot"></span>
                <span>00:00:00</span>
              </div>
              
              <div class="audio-level-container hidden" id="rec-audio-level-container">
                <div class="audio-level-bar" id="rec-audio-level-bar"></div>
              </div>
              
              <div class="control-buttons-row">
                <button class="btn btn-primary" id="rec-start-btn" style="display:flex;align-items:center;gap:6px">
                  <span style="width:10px;height:10px;border-radius:50%;background:red;display:inline-block"></span> Mulai Rekam
                </button>
                <button class="btn btn-secondary hidden" id="rec-pause-btn">⏸ Pause</button>
                <button class="btn btn-danger hidden" id="rec-stop-btn">⏹ Hentikan</button>
              </div>
            </div>
            
            <!-- Live Transcript Area -->
            <div class="form-group">
              <label>Transkrip Real-Time</label>
              <div class="transcript-area" id="rec-transcript-area">
                <div class="transcript-empty">Transkrip percakapan akan muncul di sini secara real-time saat Anda mulai merekam...</div>
              </div>
            </div>
          </div>

          <!-- Card 2: Hasil Notulensi AI -->
          <div class="recorder-card hidden" id="rec-results-card">
            <div class="recorder-card-title">
              <span>📄 Notulensi Rapat AI</span>
            </div>
            
            <div class="minutes-preview-area" id="rec-minutes-preview">
              Notulensi sedang diproses atau belum dibuat...
            </div>
            
            <div class="minutes-actions">
              <button class="btn btn-primary" id="rec-download-docx-btn" disabled>📄 Download DOCX</button>
              <button class="btn btn-secondary" id="rec-copy-btn" disabled>📋 Salin Notulensi</button>
              <button class="btn btn-secondary" id="rec-regenerate-btn" disabled>🔄 Regenerate AI</button>
              <button class="btn btn-secondary" id="rec-save-kb-btn" disabled>💾 Simpan ke RAG</button>
            </div>
          </div>

          <!-- Card 3: Riwayat Rekaman -->
          <div class="recorder-card" id="rec-history-card">
            <div class="recorder-card-title">
              <span>📜 Riwayat Rekaman</span>
            </div>
            <div class="recordings-history-list" id="rec-history-list">
              <div style="text-align:center;color:var(--text-muted);font-size:12px;padding:var(--space-4) 0;font-style:italic">Memuat riwayat rekaman...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMessages() {
  return chatMessages.map(msg => {
    if (msg.role === 'user') {
      const attachmentHtml = msg.attachments && msg.attachments.length > 0
        ? `<div class="chat-msg-attachments" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
            ${msg.attachments.map(att => {
              const isImg = ['png','jpg','jpeg','gif','webp'].includes(att.type.toLowerCase()) && att.base64;
              const icon = isImg 
                ? `<img src="${att.base64}" style="width:14px; height:14px; object-fit:cover; border-radius:2px">`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px; height:12px; color:var(--text-muted); flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
              return `
                <div class="attachment-chip" style="max-width:200px; padding:4px 8px; background:var(--surface-container); border:1px solid var(--border)">
                  ${icon}
                  <span class="attachment-chip-name" style="font-size:10px; margin-left:4px; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</span>
                </div>
              `;
            }).join('')}
           </div>`
        : '';

      return `
        <div class="chat-msg chat-msg--user">
          <span class="chat-msg-prompt">&gt;_</span>
          <div class="chat-msg-content">
            <div>${escapeHtml(msg.content || '(Attachment Only)')}</div>
            ${attachmentHtml}
          </div>
        </div>
      `;
    }
    const badgeHtml = msg.agent_name ? `
      <div class="agent-badge">
        <span class="agent-badge__icon">${escapeHtml(msg.icon || '🤖')}</span>
        <span class="agent-badge__name">${escapeHtml(msg.agent_name.toUpperCase())}</span>
        <span class="agent-badge__model">${escapeHtml(msg.provider_used ? msg.provider_used.toUpperCase() : '')} ${escapeHtml(msg.model_used || '')}</span>
      </div>
    ` : '';
    
    return `
      <div class="chat-msg chat-msg--agent">
        ${badgeHtml}
        <div class="chat-msg-content">${escapeHtml(msg.content)}</div>
        <div class="chat-msg-meta">
          <span>${formatTime(msg.timestamp)}</span>
          ${msg.agent_name ? '' : (msg.model ? `<span>${escapeHtml(msg.model)}</span>` : '')}
          ${msg.latency ? `<span>${msg.latency}ms</span>` : ''}
          ${msg.cost_usd > 0 ? `<span class="badge badge--green">$${msg.cost_usd.toFixed(4)}</span>` : ''}
          ${msg.is_fallback ? `<span class="badge badge--yellow">Local Fallback</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function showChatToast(message, type = 'success') {
  const toast = $('#chat-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast--${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

async function updateMicDevicesList() {
  const listContainer = $('#mic-device-list');
  if (!listContainer) return;

  try {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.warn('Microphone permission not granted yet:', e);
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');

    listContainer.innerHTML = '';
    if (audioInputs.length === 0) {
      listContainer.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); padding: 4px 8px;">No microphone found</div>`;
      return;
    }

    audioInputs.forEach((device, index) => {
      const isSelected = selectedMicId === device.deviceId || (selectedMicId === 'default' && index === 0);
      const label = device.label || `Microphone ${index + 1}`;
      const item = document.createElement('div');
      item.className = `mic-device-item ${isSelected ? 'active' : ''}`;
      
      const inlineStyle = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 12px;
        color: ${isSelected ? 'var(--primary)' : 'var(--text-primary)'};
        background: ${isSelected ? 'rgba(35, 134, 54, 0.12)' : 'transparent'};
        border: 1px solid ${isSelected ? 'var(--primary-container)' : 'transparent'};
        transition: background 0.15s ease, border-color 0.15s ease;
      `;
      item.setAttribute('style', inlineStyle);

      item.addEventListener('mouseenter', () => {
        if (!item.classList.contains('active')) {
          item.style.background = 'var(--surface-container)';
        }
      });
      item.addEventListener('mouseleave', () => {
        if (!item.classList.contains('active')) {
          item.style.background = 'transparent';
        }
      });

      item.innerHTML = `
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px;" title="${label}">${label}</span>
        ${isSelected ? `<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" style="width: 14px; height: 14px; flex-shrink: 0"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      `;

      item.addEventListener('click', () => {
        selectedMicId = device.deviceId;
        localStorage.setItem('damz_selected_mic', selectedMicId);
        updateMicDevicesList();
        showChatToast(`Microphone: ${label}`);
      });

      listContainer.appendChild(item);
    });

  } catch (err) {
    console.error('Error listing devices:', err);
    listContainer.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); padding: 4px 8px;">System Default Microphone</div>`;
  }
}

// ── Text-to-Speech (TTS) ─────────────────────────────
function speakText(text) {
  if (!isTtsEnabled) return;
  if (!('speechSynthesis' in window)) return;

  // Stop any currently playing speech
  window.speechSynthesis.cancel();

  // Clean the text: remove Chinese character hallucinations (including punctuation), markdown symbols, URLs, etc.
  const cleanText = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g, '') // Filter out Chinese characters and CJK/Fullwidth punctuation
    .replace(/```[\s\S]*?```/g, 'blok kode.')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#+\s/g, '')
    .replace(/https?:\/\/\S+/g, 'link URL.')
    .replace(/[-–—]{2,}/g, '.')
    .trim();

  if (!cleanText) return;

  currentUtterance = new SpeechSynthesisUtterance(cleanText);

  // Language & Voice settings: use saved setting
  const saved = localStorage.getItem('damz_settings');
  let lang = 'id-ID';
  let ttsVoiceSetting = '';
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.stt && parsed.stt.language) {
        lang = parsed.stt.language === 'English' ? 'en-US' : 'id-ID';
      }
      if (parsed.tts && parsed.tts.voice) {
        ttsVoiceSetting = parsed.tts.voice;
      }
    } catch (e) {
      console.warn('[CHAT] Gagal parse TTS voice settings:', e);
    }
  }
  currentUtterance.lang = lang;
  currentUtterance.rate = 1.0;
  currentUtterance.pitch = 1.0;
  currentUtterance.volume = 1.0;

  // Helper to match voice language code flexibly (e.g. id matches id-ID, id_ID, etc.)
  const langMatches = (voiceLang, targetLang) => {
    if (!voiceLang) return false;
    const v = voiceLang.toLowerCase().replace('_', '-');
    const t = targetLang.toLowerCase().replace('_', '-');
    return v === t || v.split('-')[0] === t.split('-')[0];
  };

  // Select the best natural-sounding voice
  const voices = window.speechSynthesis.getVoices();
  let preferred = null;

  if (lang === 'id-ID') {
    const isMalePref = ttsVoiceSetting.includes('male');
    if (isMalePref) {
      preferred = 
        voices.find(v => langMatches(v.lang, lang) && (v.name.includes('Ardi') || v.name.includes('Argana') || v.name.includes('Male') || v.name.includes('Pria') || v.name.includes('Harpo') || v.name.includes('David'))) ||
        voices.find(v => langMatches(v.lang, lang) && !v.name.toLowerCase().includes('gadis') && !v.name.toLowerCase().includes('siti') && !v.name.toLowerCase().includes('female') && !v.name.toLowerCase().includes('zira')) ||
        voices.find(v => langMatches(v.lang, lang));
    } else {
      preferred = 
        voices.find(v => langMatches(v.lang, lang) && (v.name.includes('Gadis') || v.name.includes('Siti') || v.name.includes('Female') || v.name.includes('Wanita') || v.name.includes('Google'))) ||
        voices.find(v => langMatches(v.lang, lang));
    }
  } else {
    // English voice mapping
    const isMalePref = ttsVoiceSetting.includes('male');
    if (isMalePref) {
      preferred = 
        voices.find(v => langMatches(v.lang, lang) && (v.name.includes('Ryan') || v.name.includes('Male') || v.name.includes('David') || v.name.includes('Mark') || v.name.includes('George') || v.name.includes('Google US English Male'))) ||
        voices.find(v => langMatches(v.lang, lang) && !v.name.toLowerCase().includes('lessac') && !v.name.toLowerCase().includes('female') && !v.name.toLowerCase().includes('zira') && !v.name.toLowerCase().includes('hazel') && !v.name.toLowerCase().includes('susan')) ||
        voices.find(v => langMatches(v.lang, lang));
    } else {
      preferred = 
        voices.find(v => langMatches(v.lang, lang) && (v.name.includes('Lessac') || v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Hazel') || v.name.includes('Google'))) ||
        voices.find(v => langMatches(v.lang, lang));
    }
  }

  if (preferred) {
    currentUtterance.voice = preferred;
    currentUtterance.lang = preferred.lang;
    console.log(`[TTS] Using voice: ${preferred.name} (${preferred.lang})`);
  } else {
    // Fallback to avoid language-unavailable error in Chrome
    const defaultVoice = voices.find(v => v.default) || voices[0];
    if (defaultVoice) {
      currentUtterance.voice = defaultVoice;
      currentUtterance.lang = defaultVoice.lang;
      console.warn(`[TTS] No preferred Indonesian/English voice found. Falling back to voice: ${defaultVoice.name} (${defaultVoice.lang})`);
    } else {
      currentUtterance.lang = lang;
      console.warn(`[TTS] No voices available yet in SpeechSynthesis.`);
    }
  }

  // Visual feedback helper
  const setSpeakerActive = (active) => {
    const spkDot = document.querySelector('[data-indicator="SPK"]');
    if (spkDot) {
      spkDot.style.background = active ? 'var(--status-green)' : '';
      spkDot.style.borderColor = active ? 'var(--status-green)' : '';
    }
    const spkStatus = document.getElementById('sidebar-spk-status');
    if (spkStatus) {
      spkStatus.textContent = active ? 'Speaking' : 'Idle';
    }
  };

  currentUtterance.onstart = () => {
    setSpeakerActive(true);
  };

  const resetSpk = () => {
    setSpeakerActive(false);
    currentUtterance = null;
  };

  currentUtterance.onend = resetSpk;
  currentUtterance.onerror = (e) => {
    console.error('[TTS] SpeechSynthesis error:', e.error, e);
    resetSpk();
  };

  // Add 100ms delay before speak to avoid Chrome's immediate cancel bug
  setTimeout(() => {
    window.speechSynthesis.speak(currentUtterance);
  }, 100);
}

export function mount() {
  const input = $('#chat-input');
  const sendBtn = $('#send-btn');
  const voiceBtn = $('#voice-btn');
  const settingsBtn = $('#mic-settings-btn');
  const popover = $('#mic-settings-popover');
  const holdToggle = $('#hold-to-record-toggle');
  const messagesEl = $('#chat-messages');

  // Trigger loading voices in Chrome/Safari early
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
  }

  // Register global TTS settings event listener
  window.addEventListener('damz_tts_changed', handleTtsChange);

  // Scroll to bottom
  if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;

  // Enter key to send
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    input.focus();
  }

  // Send button
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);

  // TTS Toggle
  const ttsToggleBtn = $('#tts-toggle-btn');
  if (ttsToggleBtn) {
    ttsToggleBtn.addEventListener('click', () => {
      isTtsEnabled = !isTtsEnabled;
      const newMode = isTtsEnabled ? 'both' : 'text';
      localStorage.setItem('damz_output_mode', newMode);
      localStorage.setItem('damz_tts_enabled', isTtsEnabled);

      // Stop any ongoing speech immediately
      if (!isTtsEnabled && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      // Update button appearance
      updateTtsToggleBtnUI();

      // Update sidebar output mode active button states
      const sidebarButtons = document.querySelectorAll('.output-mode-btn');
      sidebarButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === newMode));

      showChatToast(isTtsEnabled ? '🔊 Suara agen diaktifkan' : '🔇 Suara agen dimatikan');
    });
  }

  // Toggle mic settings popover
  if (settingsBtn && popover) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = popover.classList.contains('hidden');
      if (isHidden) {
        updateMicDevicesList();
        popover.classList.remove('hidden');
      } else {
        popover.classList.add('hidden');
      }
    });
  }

  // Handle hold-to-record toggle click
  if (holdToggle) {
    holdToggle.addEventListener('click', () => {
      isHoldToRecord = !isHoldToRecord;
      localStorage.setItem('damz_hold_to_record', isHoldToRecord);
      holdToggle.classList.toggle('active', isHoldToRecord);
      
      const input = $('#chat-input');
      if (input) {
        input.placeholder = isHoldToRecord 
          ? '> Hold the mic button to talk...' 
          : '> Type a message or press the mic...';
      }
      showChatToast(`Hold to record: ${isHoldToRecord ? 'ON' : 'OFF'}`);
    });
  }

  // Recording triggers
  function startRecording() {
    if (isRecording) return;
    isRecording = true;
    voiceBtn.classList.add('active');
    
    if (recognition) {
      try {
        recognition.start();
      } catch (e) {
        console.warn('Recognition already started:', e);
      }
    } else {
      showChatToast('Browser speech recognition not supported. Please type your message.', 'warning');
      stopRecordingUI();
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        console.warn('[CHAT] Gagal menghentikan recognition:', e);
      }
    }
    stopRecordingUI();
  }

  function stopRecordingUI() {
    isRecording = false;
    if (voiceBtn) voiceBtn.classList.remove('active');
  }

  // Mouse & Touch bindings for hold-to-record
  const handleRecStart = (e) => {
    e.preventDefault();
    if (isHoldToRecord) {
      startRecording();
    }
  };

  const handleRecEnd = (e) => {
    e.preventDefault();
    if (isHoldToRecord && isRecording) {
      stopRecording();
    }
  };

  voiceBtn.addEventListener('mousedown', handleRecStart);
  voiceBtn.addEventListener('mouseup', handleRecEnd);
  voiceBtn.addEventListener('mouseleave', handleRecEnd);

  voiceBtn.addEventListener('touchstart', handleRecStart, { passive: false });
  voiceBtn.addEventListener('touchend', handleRecEnd, { passive: false });

  // Standard click fallback for click-to-toggle mode
  voiceBtn.addEventListener('click', (e) => {
    if (!isHoldToRecord) {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  });

  // Close popover when clicking outside
  document.addEventListener('click', (e) => {
    if (popover && !popover.classList.contains('hidden')) {
      if (!popover.contains(e.target) && !settingsBtn.contains(e.target)) {
        popover.classList.add('hidden');
      }
    }
  });

  // Event listeners for file and camera attachments
  const attachFileBtn = $('#attach-file-btn');
  const attachCameraBtn = $('#attach-camera-btn');
  const fileInput = $('#file-input');
  const cameraInput = $('#camera-input');

  if (attachFileBtn && fileInput) {
    attachFileBtn.addEventListener('click', () => fileInput.click());
  }
  if (attachCameraBtn && cameraInput) {
    attachCameraBtn.addEventListener('click', () => cameraInput.click());
  }

  const handleFileSelection = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      // 10MB limit
      if (file.size > 10 * 1024 * 1024) {
        showChatToast(`File "${file.name}" terlalu besar (maksimal 10MB)`, 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const ext = file.name.split('.').pop() || '';
        attachedFiles.push({
          name: file.name,
          size: file.size,
          type: ext.toLowerCase(),
          base64: reader.result
        });
        renderAttachmentPreviews();
      };
      reader.onerror = () => {
        showChatToast(`Gagal membaca file: ${file.name}`, 'error');
      };
      reader.readAsDataURL(file);
    });
    // Reset so same file can be picked again
    e.target.value = '';
  };

  if (fileInput) fileInput.addEventListener('change', handleFileSelection);
  if (cameraInput) cameraInput.addEventListener('change', handleFileSelection);

  // Initial render of previews
  renderAttachmentPreviews();

  // ── Meeting Recorder Event Listeners ──
  const btnSwitchChat = $('#switch-mode-chat');
  const btnSwitchRecorder = $('#switch-mode-recorder');
  
  if (btnSwitchChat) {
    btnSwitchChat.addEventListener('click', () => switchChatMode('chat'));
  }
  if (btnSwitchRecorder) {
    btnSwitchRecorder.addEventListener('click', () => switchChatMode('recorder'));
  }
  
  // Recorder Control Buttons
  const btnStartRec = $('#rec-start-btn');
  const btnPauseRec = $('#rec-pause-btn');
  const btnStopRec = $('#rec-stop-btn');
  
  if (btnStartRec) {
    btnStartRec.addEventListener('click', startRecordingWorkflow);
  }
  if (btnPauseRec) {
    btnPauseRec.addEventListener('click', () => {
      if (recorderState === 'recording') {
        pauseRecordingWorkflow();
      } else if (recorderState === 'paused') {
        resumeRecordingWorkflow();
      }
    });
  }
  if (btnStopRec) {
    btnStopRec.addEventListener('click', stopRecordingWorkflow);
  }
  
  // Results Actions
  const btnDownloadDocx = $('#rec-download-docx-btn');
  const btnCopy = $('#rec-copy-btn');
  const btnRegen = $('#rec-regenerate-btn');
  const btnSaveKb = $('#rec-save-kb-btn');
  
  if (btnDownloadDocx) {
    btnDownloadDocx.addEventListener('click', () => downloadDocx());
  }
  if (btnCopy) {
    btnCopy.addEventListener('click', copyMinutesToClipboard);
  }
  if (btnRegen) {
    btnRegen.addEventListener('click', regenerateMinutes);
  }
  if (btnSaveKb) {
    btnSaveKb.addEventListener('click', saveMinutesToRAG);
  }
  
  // Initial mode setup on mount
  switchChatMode(currentChatMode);
}

// Render attachment previews just above input box
function renderAttachmentPreviews() {
  const container = $('#chat-attachment-preview');
  if (!container) return;

  if (attachedFiles.length === 0) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = attachedFiles.map((file, idx) => {
    const isImg = ['png','jpg','jpeg','gif','webp'].includes(file.type.toLowerCase());
    const icon = isImg 
      ? `<img src="${file.base64}">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px; color: var(--text-muted); flex-shrink: 0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

    return `
      <div class="attachment-chip" data-index="${idx}">
        ${icon}
        <span class="attachment-chip-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <button class="attachment-chip-remove" data-index="${idx}" title="Hapus file">&times;</button>
      </div>
    `;
  }).join('');

  // Event listener for delete buttons
  container.querySelectorAll('.attachment-chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index, 10);
      attachedFiles.splice(index, 1);
      renderAttachmentPreviews();
    });
  });
}

async function handleChatResponse(text) {
  showTyping(true);
  try {
    const savedSettings = localStorage.getItem('damz_settings');
    let activeModel = 'qwen2.5:7b';
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.model && parsed.model.active) {
          activeModel = parsed.model.active;
        }
      } catch (e) {}
    }

    // Build chat history array for context
    const recentMessages = chatMessages.slice(-8).map(msg => ({
      role: msg.role === 'agent' ? 'assistant' : msg.role,
      content: msg.content
    }));

    // Attachments payload from user's last message
    const payload = {
      model: activeModel,
      messages: recentMessages
    };

    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg && lastMsg.role === 'user' && lastMsg.attachments && lastMsg.attachments.length > 0) {
      payload.attachments = lastMsg.attachments;
    }

    const res = await fetch(`${API_BASE}/api/ollama/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      showTyping(false);
      const statusText = res.status === 413 
        ? 'Payload terlalu besar. Coba kirim file yang lebih kecil.'
        : `HTTP Error ${res.status}: ${res.statusText}`;
      console.error('[CHAT] Server error:', statusText);
      await appendAgentMessage(`[ERROR] ${statusText}`, activeModel, 0);
      return;
    }

    const data = await res.json();
    showTyping(false);
    if (data.success && data.content) {
      // Filter out any Chinese characters and punctuation (hallucinations) from the response text
      const cleanContent = data.content.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g, '').trim();
      await appendAgentMessage(cleanContent, activeModel, data.latency || 1000, {
        agent_id: data.agent_id,
        agent_name: data.agent_name,
        icon: data.icon,
        provider_used: data.provider_used,
        model_used: data.model_used,
        cost_usd: data.cost_usd,
        is_fallback: data.is_fallback
      });
      // Speak the agent's response if TTS is enabled
      speakText(cleanContent);
    } else {
      await appendAgentMessage(`[ERROR] Gagal mendapatkan respons dari Ollama: ${data.error || 'Unknown error'}`, activeModel, 0);
    }
  } catch (err) {
    showTyping(false);
    console.error('[CHAT] Gagal menghubungi backend:', err);
    await appendAgentMessage(`Terjadi kesalahan koneksi saat menghubungi backend Express server: ${err.message || 'Unknown error'}`, 'None', 0);
  }
}

async function sendMessage() {
  const input = $('#chat-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text && attachedFiles.length === 0) return;

  input.value = '';

  // Copy attached files, then clear them
  const filesToSend = [...attachedFiles];
  attachedFiles = [];
  renderAttachmentPreviews();

  // Add user message with attachments
  appendUserMessage(text, filesToSend);

  await handleChatResponse(text);
}

function appendUserMessage(content, attachments = []) {
  const messagesEl = $('#chat-messages');
  if (!messagesEl) return;

  const msg = { 
    id: uid(), 
    role: 'user', 
    content, 
    timestamp: new Date().toISOString(),
    attachments 
  };
  chatMessages.push(msg);
  saveChatHistory();

  const attachmentHtml = attachments.length > 0
    ? `<div class="chat-msg-attachments" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
        ${attachments.map(att => {
          const isImg = ['png','jpg','jpeg','gif','webp'].includes(att.type.toLowerCase()) && att.base64;
          const icon = isImg 
            ? `<img src="${att.base64}" style="width:14px; height:14px; object-fit:cover; border-radius:2px">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px; height:12px; color:var(--text-muted); flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
          return `
            <div class="attachment-chip" style="max-width:200px; padding:4px 8px; background:var(--surface-container); border:1px solid var(--border)">
              ${icon}
              <span class="attachment-chip-name" style="font-size:10px; margin-left:4px; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</span>
            </div>
          `;
        }).join('')}
       </div>`
    : '';

  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg--user';
  div.innerHTML = `
    <span class="chat-msg-prompt">&gt;_</span>
    <div class="chat-msg-content">
      <div>${escapeHtml(content || '(Attachment Only)')}</div>
      ${attachmentHtml}
    </div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function appendAgentMessage(content, model, latency, metadata = {}) {
  const messagesEl = $('#chat-messages');
  if (!messagesEl) return;

  const now = new Date().toISOString();
  const msg = { 
    id: uid(), 
    role: 'agent', 
    content, 
    timestamp: now, 
    model, 
    latency,
    agent_id: metadata.agent_id,
    agent_name: metadata.agent_name,
    icon: metadata.icon,
    provider_used: metadata.provider_used,
    model_used: metadata.model_used,
    cost_usd: metadata.cost_usd,
    is_fallback: metadata.is_fallback
  };
  chatMessages.push(msg);
  saveChatHistory();

  const badgeHtml = msg.agent_name ? `
    <div class="agent-badge">
      <span class="agent-badge__icon">${escapeHtml(msg.icon || '🤖')}</span>
      <span class="agent-badge__name">${escapeHtml(msg.agent_name.toUpperCase())}</span>
      <span class="agent-badge__model">${escapeHtml(msg.provider_used ? msg.provider_used.toUpperCase() : '')} ${escapeHtml(msg.model_used || '')}</span>
    </div>
  ` : '';

  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg--agent';
  div.innerHTML = `
    ${badgeHtml}
    <div class="chat-msg-content" id="msg-${msg.id}"></div>
    <div class="chat-msg-meta">
      <span>${formatTime(now)}</span>
      ${msg.agent_name ? '' : `<span>${escapeHtml(model)}</span>`}
      <span>${latency}ms</span>
      ${msg.cost_usd > 0 ? `<span class="badge badge--green">$${msg.cost_usd.toFixed(4)}</span>` : ''}
      ${msg.is_fallback ? `<span class="badge badge--yellow">Local Fallback</span>` : ''}
    </div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Typewriter effect with auto-scroll
  const contentEl = $(`#msg-${msg.id}`);
  if (contentEl) {
    await typeWriter(contentEl, content, 15, messagesEl);
    contentEl.style.whiteSpace = 'pre-wrap';
  }
}

function showTyping(show) {
  const messagesEl = $('#chat-messages');
  if (!messagesEl) return;

  let thinkingEl = $('#chat-msg-thinking');
  if (show) {
    if (!thinkingEl) {
      thinkingEl = document.createElement('div');
      thinkingEl.className = 'chat-msg chat-msg--agent chat-msg--thinking';
      thinkingEl.id = 'chat-msg-thinking';
      thinkingEl.innerHTML = `
        <div class="chat-typing" style="padding:0; margin:0">
          <span class="chat-typing-text">Damz is thinking</span>
          <span class="chat-typing-dot"></span>
          <span class="chat-typing-dot"></span>
          <span class="chat-typing-dot"></span>
        </div>
      `;
      messagesEl.appendChild(thinkingEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  } else {
    if (thinkingEl) {
      thinkingEl.remove();
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Meeting Recorder Module Functions ─────────────────

function switchChatMode(mode) {
  currentChatMode = mode;
  
  const chatContainer = $('#chat-mode-container');
  const recorderContainer = $('#recorder-mode-container');
  const titleText = $('#chat-header-title-text');
  
  const btnChat = $('#switch-mode-chat');
  const btnRecorder = $('#switch-mode-recorder');
  
  if (mode === 'chat') {
    if (chatContainer) chatContainer.classList.remove('hidden');
    if (recorderContainer) recorderContainer.classList.add('hidden');
    if (titleText) titleText.textContent = 'Interactive Chat';
    if (btnChat) btnChat.classList.add('active');
    if (btnRecorder) btnRecorder.classList.remove('active');
  } else {
    if (chatContainer) chatContainer.classList.add('hidden');
    if (recorderContainer) recorderContainer.classList.remove('hidden');
    if (titleText) titleText.textContent = 'Meeting Recorder';
    if (btnChat) btnChat.classList.remove('active');
    if (btnRecorder) btnRecorder.classList.add('active');
    
    // Load history when entering recorder mode
    loadRecordingsHistory();
  }
}

async function loadRecordingsHistory() {
  const container = $('#rec-history-list');
  if (!container) return;
  
  try {
    const res = await fetch(`${API_BASE}/api/recorder/list`);
    const data = await res.json();
    if (data.success && data.recordings) {
      recordingsList = data.recordings;
      renderHistoryList();
    }
  } catch (e) {
    console.error('[RECORDER] Gagal memuat riwayat:', e);
    container.innerHTML = `<div style="text-align:center;color:var(--danger);font-size:12px;padding:var(--space-4) 0">Gagal memuat riwayat rekaman.</div>`;
  }
}

function renderHistoryList() {
  const container = $('#rec-history-list');
  if (!container) return;
  
  if (recordingsList.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:var(--space-4) 0;font-style:italic">Belum ada riwayat rekaman rapat.</div>`;
    return;
  }
  
  container.innerHTML = recordingsList.map(rec => {
    const min = Math.floor(rec.duration / 60);
    const sec = rec.duration % 60;
    const durStr = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
    
    return `
      <div class="history-item" data-id="${rec.id}">
        <div class="history-item-info">
          <div class="history-item-title">${escapeHtml(rec.title)}</div>
          <div class="history-item-meta">
            <span>📅 ${rec.date}</span>
            <span>⏱️ ${durStr}</span>
            <span>${rec.hasMinutes ? '📝 Notulensi' : '⏳ No Notulensi'}</span>
          </div>
        </div>
        <div class="history-item-actions">
          ${rec.hasMinutes ? `<button class="btn btn-sm btn-ghost view-minutes-btn" title="Lihat Notulensi">👁️</button>` : ''}
          ${rec.hasMinutes ? `<button class="btn btn-sm btn-ghost download-docx-btn" title="Download DOCX">📥</button>` : ''}
          <button class="btn btn-sm btn-ghost delete-rec-btn" title="Hapus" style="color:var(--danger)">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Bind events for dynamically rendered history list items
  container.querySelectorAll('.history-item').forEach(item => {
    const recId = item.dataset.id;
    
    const viewBtn = item.querySelector('.view-minutes-btn');
    const downloadBtn = item.querySelector('.download-docx-btn');
    const deleteBtn = item.querySelector('.delete-rec-btn');
    
    if (viewBtn) {
      viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        viewMinutesFromHistory(recId);
      });
    }
    
    if (downloadBtn) {
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadDocx(recId);
      });
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Apakah Anda yakin ingin menghapus rekaman rapat ini?')) {
          deleteRecording(recId);
        }
      });
    }
    
    // Clicking the item itself loads its minutes/transcript
    item.addEventListener('click', () => {
      viewMinutesFromHistory(recId);
    });
  });
}

async function viewMinutesFromHistory(recId) {
  activeRecordingId = recId;
  const rec = recordingsList.find(r => r.id === recId);
  if (!rec) return;
  
  const resultsCard = $('#rec-results-card');
  const previewArea = $('#rec-minutes-preview');
  
  if (resultsCard) resultsCard.classList.remove('hidden');
  if (previewArea) previewArea.innerHTML = `<div style="text-align:center;color:var(--text-muted)">Memuat notulensi...</div>`;
  
  // Set title in info form
  const titleInput = $('#rec-meeting-title');
  const dateInput = $('#rec-meeting-date');
  const participantsInput = $('#rec-meeting-participants');
  
  if (titleInput) titleInput.value = rec.title;
  if (dateInput) dateInput.value = rec.date;
  if (participantsInput) participantsInput.value = rec.participants || '';
  
  try {
    const res = await fetch(`${API_BASE}/api/recorder/minutes/${recId}`);
    const data = await res.json();
    if (data.success && data.minutes) {
      generatedMinutes = data.minutes;
      previewArea.innerHTML = formatMarkdown(data.minutes);
      
      // Enable buttons
      enableResultsButtons(true);
      
      // Reset save to RAG button status
      const saveBtn = $('#rec-save-kb-btn');
      if (saveBtn) {
        saveBtn.textContent = '💾 Simpan ke RAG';
        saveBtn.removeAttribute('disabled');
      }
    } else {
      // Fallback to generate-minutes if not found or failed
      const genRes = await fetch(`${API_BASE}/api/recorder/generate-minutes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId: recId })
      });
      const genData = await genRes.json();
      if (genData.success && genData.minutes) {
        generatedMinutes = genData.minutes;
        previewArea.innerHTML = formatMarkdown(genData.minutes);
        enableResultsButtons(true);
      } else {
        previewArea.innerHTML = `<div style="text-align:center;color:var(--danger)">Gagal memuat atau memproses notulensi: ${genData.error || data.error || 'Unknown error'}</div>`;
      }
    }
  } catch (err) {
    console.error(err);
    previewArea.innerHTML = `<div style="text-align:center;color:var(--danger)">Kesalahan jaringan saat memuat notulensi.</div>`;
  }
}

function enableResultsButtons(enabled) {
  const downloadBtn = $('#rec-download-docx-btn');
  const copyBtn = $('#rec-copy-btn');
  const regenBtn = $('#rec-regenerate-btn');
  const saveKbBtn = $('#rec-save-kb-btn');
  
  [downloadBtn, copyBtn, regenBtn, saveKbBtn].forEach(btn => {
    if (btn) {
      if (enabled) {
        btn.removeAttribute('disabled');
      } else {
        btn.setAttribute('disabled', 'true');
      }
    }
  });
}

async function deleteRecording(recId) {
  try {
    const res = await fetch(`${API_BASE}/api/recorder/${recId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showChatToast('Rekaman berhasil dihapus.');
      
      // Hide results if we deleted the currently active recording
      if (activeRecordingId === recId) {
        activeRecordingId = null;
        const resultsCard = $('#rec-results-card');
        if (resultsCard) resultsCard.classList.add('hidden');
      }
      
      loadRecordingsHistory();
    } else {
      showChatToast('Gagal menghapus rekaman: ' + data.error, 'error');
    }
  } catch (e) {
    showChatToast('Kesalahan koneksi saat menghapus rekaman.', 'error');
  }
}

function initContinuousSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionContinuous = new SpeechRecognition();
    recognitionContinuous.continuous = true;
    recognitionContinuous.interimResults = true;
    recognitionContinuous.lang = 'id-ID';

    recognitionContinuous.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        sttRetryCount = 0; // Reset retry count on successful transcription
        const timestampStr = formatRecordingTimestamp(recordingDuration * 1000);
        transcriptLines.push({
          timestamp: timestampStr,
          text: finalTranscript.trim()
        });
        renderLiveTranscript(interimTranscript);
      } else if (interimTranscript.trim()) {
        renderLiveTranscript(interimTranscript);
      }
    };

    recognitionContinuous.onerror = (event) => {
      console.warn('[RECORDER] Continuous recognition error:', event.error);
    };

    recognitionContinuous.onend = () => {
      if (recorderState === 'recording') {
        if (sttRetryCount >= MAX_STT_RETRIES) {
          console.warn(`[RECORDER] STT auto-restart exceeded max retries (${MAX_STT_RETRIES}). Stopping.`);
          showChatToast('Speech recognition berhenti setelah beberapa kali gagal restart.', 'warning');
          return;
        }
        sttRetryCount++;
        const delay = Math.min(500 * sttRetryCount, 3000); // backoff: 500ms, 1s, 1.5s, 2s, 2.5s
        setTimeout(() => {
          if (recorderState === 'recording') {
            try {
              recognitionContinuous.start();
            } catch (e) {
              console.warn('[RECORDER] Auto-restart failed:', e.message);
            }
          }
        }, delay);
      }
    };
  }
}

function renderLiveTranscript(interimText = '') {
  const container = $('#rec-transcript-area');
  if (!container) return;
  
  if (transcriptLines.length === 0 && !interimText) {
    container.innerHTML = `<div class="transcript-empty">Transkrip percakapan akan muncul di sini secara real-time saat Anda mulai merekam...</div>`;
    return;
  }
  
  let html = '';
  transcriptLines.forEach(line => {
    html += `
      <div class="transcript-line">
        <span class="transcript-timestamp">[${line.timestamp}]</span>
        <span class="transcript-text">${escapeHtml(line.text)}</span>
      </div>
    `;
  });
  
  if (interimText) {
    const timestampStr = formatRecordingTimestamp(recordingDuration * 1000);
    html += `
      <div class="transcript-line" style="opacity: 0.6;">
        <span class="transcript-timestamp">[${timestampStr}]</span>
        <span class="transcript-text">${escapeHtml(interimText)}...</span>
      </div>
    `;
  }
  
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function formatRecordingTimestamp(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatRecordingDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}

async function startAudioVisualization(streamObj) {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    const source = audioContext.createMediaStreamSource(streamObj);
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const progressBar = $('#rec-audio-level-bar');
    
    function draw() {
      if (recorderState !== 'recording') return;
      
      animationFrameId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      let values = 0;
      for (let i = 0; i < dataArray.length; i++) {
        values += dataArray[i];
      }
      const average = values / dataArray.length;
      const percent = Math.min(100, Math.round((average / 128) * 100));
      
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
    }
    
    draw();
  } catch (e) {
    console.warn('[RECORDER] Audio visualizer failed:', e);
  }
}

async function startRecordingWorkflow() {
  if (recorderState === 'recording') return;
  
  if (!recognitionContinuous) {
    initContinuousSpeechRecognition();
  }
  
  recorderState = 'recording';
  recordingStartTime = Date.now();
  recordingDuration = 0;
  transcriptLines = [];
  audioChunks = [];
  sttRetryCount = 0;
  
  // Show loading state on start button while requesting mic permission
  const startBtn = $('#rec-start-btn');
  if (startBtn) {
    startBtn.setAttribute('disabled', 'true');
    startBtn.innerHTML = '<span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span> Meminta akses mikrofon...';
  }
  
  const timerText = $('#rec-timer-display span:last-child');
  if (timerText) timerText.textContent = '00:00:00';
  
  const statusBadge = $('#recorder-status-badge');
  if (statusBadge) {
    statusBadge.textContent = 'Recording';
    statusBadge.style.borderColor = 'var(--danger)';
    statusBadge.style.color = 'var(--danger)';
  }
  
  const levelContainer = $('#rec-audio-level-container');
  if (levelContainer) levelContainer.classList.remove('hidden');
  
  $('#rec-start-btn').classList.add('hidden');
  $('#rec-start-btn').removeAttribute('disabled');
  $('#rec-start-btn').innerHTML = '<span style="width:10px;height:10px;border-radius:50%;background:red;display:inline-block"></span> Mulai Rekam';
  $('#rec-pause-btn').classList.remove('hidden');
  $('#rec-stop-btn').classList.remove('hidden');
  
  toggleFormInputs(true);
  
  if (recognitionContinuous) {
    try {
      recognitionContinuous.start();
    } catch(e) {
      console.warn('[RECORDER] Continuous recognition start error:', e);
    }
  }
  
  try {
    const constraints = {
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true
      }
    };
    
    if (selectedMicId && selectedMicId !== 'default') {
      constraints.audio.deviceId = { exact: selectedMicId };
    }
    
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
    const recorderOptions = mimeType ? { mimeType } : {};
    mediaRecorder = new MediaRecorder(stream, recorderOptions);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result;
        await saveRecordingData(base64Audio);
      };
    };
    
    mediaRecorder.start(1000);
    startAudioVisualization(stream);
  } catch (err) {
    console.error('[RECORDER] Failed to start audio recording:', err);
    showChatToast('Gagal mengakses mikrofon untuk merekam audio.', 'error');
    // Reset start button state
    const startBtn = $('#rec-start-btn');
    if (startBtn) {
      startBtn.removeAttribute('disabled');
      startBtn.innerHTML = '<span style="width:10px;height:10px;border-radius:50%;background:red;display:inline-block"></span> Mulai Rekam';
    }
    stopRecordingWorkflow();
    return;
  }
  
  timerInterval = setInterval(() => {
    if (recorderState === 'recording') {
      recordingDuration++;
      const display = $('#rec-timer-display span:last-child');
      if (display) {
        display.textContent = formatRecordingDuration(recordingDuration);
      }
    }
  }, 1000);
  
  const wrapper = $('.recording-controls-wrapper');
  if (wrapper) wrapper.classList.add('recording-active');
  
  renderLiveTranscript();
}

function toggleFormInputs(disabled) {
  const titleInput = $('#rec-meeting-title');
  const dateInput = $('#rec-meeting-date');
  const participantsInput = $('#rec-meeting-participants');
  
  [titleInput, dateInput, participantsInput].forEach(el => {
    if (el) {
      if (disabled) {
        el.setAttribute('disabled', 'true');
      } else {
        el.removeAttribute('disabled');
      }
    }
  });
}

function pauseRecordingWorkflow() {
  if (recorderState !== 'recording') return;
  
  recorderState = 'paused';
  
  const statusBadge = $('#recorder-status-badge');
  if (statusBadge) {
    statusBadge.textContent = 'Paused';
    statusBadge.style.borderColor = 'var(--warning)';
    statusBadge.style.color = 'var(--warning)';
  }
  
  const pauseBtn = $('#rec-pause-btn');
  if (pauseBtn) pauseBtn.textContent = '▶ Resume';
  
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
  }
  if (recognitionContinuous) {
    recognitionContinuous.stop();
  }
  
  const wrapper = $('.recording-controls-wrapper');
  if (wrapper) wrapper.classList.remove('recording-active');
}

function resumeRecordingWorkflow() {
  if (recorderState !== 'paused') return;
  
  recorderState = 'recording';
  
  const statusBadge = $('#recorder-status-badge');
  if (statusBadge) {
    statusBadge.textContent = 'Recording';
    statusBadge.style.borderColor = 'var(--danger)';
    statusBadge.style.color = 'var(--danger)';
  }
  
  const pauseBtn = $('#rec-pause-btn');
  if (pauseBtn) pauseBtn.textContent = '⏸ Pause';
  
  if (mediaRecorder && mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
  }
  if (recognitionContinuous) {
    try {
      recognitionContinuous.start();
    } catch(e) {
      console.warn('[RECORDER] Recognition restart failed on resume:', e.message);
    }
  }
  
  const wrapper = $('.recording-controls-wrapper');
  if (wrapper) wrapper.classList.add('recording-active');
}

function stopRecordingWorkflow() {
  if (recorderState !== 'recording' && recorderState !== 'paused') return;
  
  recorderState = 'processing';
  
  const statusBadge = $('#recorder-status-badge');
  if (statusBadge) {
    statusBadge.textContent = 'Processing...';
    statusBadge.style.borderColor = 'var(--primary)';
    statusBadge.style.color = 'var(--primary)';
  }
  
  if (timerInterval) clearInterval(timerInterval);
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  
  // Close AudioContext to prevent memory leak
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(() => {});
    audioContext = null;
    analyser = null;
  }
  
  $('#rec-start-btn').classList.remove('hidden');
  $('#rec-pause-btn').classList.add('hidden');
  $('#rec-pause-btn').textContent = '⏸ Pause';
  $('#rec-stop-btn').classList.add('hidden');
  
  const levelContainer = $('#rec-audio-level-container');
  if (levelContainer) levelContainer.classList.add('hidden');
  
  const wrapper = $('.recording-controls-wrapper');
  if (wrapper) wrapper.classList.remove('recording-active');
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  } else {
    saveRecordingData(null);
  }
}

async function saveRecordingData(base64Audio) {
  const titleVal = $('#rec-meeting-title').value.trim() || 'Rapat Tanpa Judul';
  const dateVal = $('#rec-meeting-date').value.trim() || new Date().toLocaleDateString('id-ID');
  const participantsVal = $('#rec-meeting-participants').value.trim() || '';
  
  const resultsCard = $('#rec-results-card');
  const previewArea = $('#rec-minutes-preview');
  
  if (resultsCard) resultsCard.classList.remove('hidden');
  if (previewArea) {
    previewArea.innerHTML = `
      <div style="text-align:center;padding:var(--space-4) 0">
        <div class="chat-typing" style="justify-content:center;margin-bottom:12px">
          <span class="chat-typing-text">AI sedang menyusun notulensi rapat</span>
          <span class="chat-typing-dot"></span>
          <span class="chat-typing-dot"></span>
          <span class="chat-typing-dot"></span>
        </div>
        <p style="color:var(--text-muted);font-size:12px">Sedang memproses transkrip (${transcriptLines.length} baris)...</p>
      </div>
    `;
  }
  
  try {
    const saveRes = await fetch(`${API_BASE}/api/recorder/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio: base64Audio,
        transcript: transcriptLines,
        meetingInfo: {
          title: titleVal,
          date: dateVal,
          participants: participantsVal,
          duration: recordingDuration
        }
      })
    });
    
    const saveData = await saveRes.json();
    if (!saveData.success) {
      throw new Error(saveData.error || 'Gagal menyimpan data ke server');
    }
    
    activeRecordingId = saveData.recordingId;
    
    const minutesRes = await fetch(`${API_BASE}/api/recorder/generate-minutes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId: activeRecordingId })
    });
    
    const minutesData = await minutesRes.json();
    if (!minutesData.success) {
      throw new Error(minutesData.error || 'AI gagal menyusun notulensi');
    }
    
    generatedMinutes = minutesData.minutes;
    if (previewArea) previewArea.innerHTML = formatMarkdown(minutesData.minutes);
    
    enableResultsButtons(true);
    
    // Reset save to RAG button status
    const saveBtn = $('#rec-save-kb-btn');
    if (saveBtn) {
      saveBtn.textContent = '💾 Simpan ke RAG';
      saveBtn.removeAttribute('disabled');
    }
    
    showChatToast('Notulensi rapat AI berhasil dibuat!');
    
    recorderState = 'idle';
    const statusBadge = $('#recorder-status-badge');
    if (statusBadge) {
      statusBadge.textContent = 'Idle';
      statusBadge.style.borderColor = 'var(--border)';
      statusBadge.style.color = 'var(--text-muted)';
    }
    toggleFormInputs(false);
    
    loadRecordingsHistory();
  } catch (err) {
    console.error(err);
    if (previewArea) {
      previewArea.innerHTML = `
        <div style="text-align:center;color:var(--danger);padding:var(--space-4) 0">
          <strong>Terjadi Kesalahan:</strong><br>
          ${err.message || 'Gagal menyelesaikan proses notulensi.'}
        </div>
      `;
    }
    recorderState = 'idle';
    const statusBadge = $('#recorder-status-badge');
    if (statusBadge) {
      statusBadge.textContent = 'Error';
      statusBadge.style.borderColor = 'var(--danger)';
      statusBadge.style.color = 'var(--danger)';
    }
    toggleFormInputs(false);
  }
}

async function regenerateMinutes() {
  if (!activeRecordingId) return;
  
  const previewArea = $('#rec-minutes-preview');
  if (previewArea) {
    previewArea.innerHTML = `
      <div style="text-align:center;padding:var(--space-4) 0">
        <div class="chat-typing" style="justify-content:center;margin-bottom:12px">
          <span class="chat-typing-text">AI sedang membuat ulang notulensi rapat</span>
          <span class="chat-typing-dot"></span>
          <span class="chat-typing-dot"></span>
          <span class="chat-typing-dot"></span>
        </div>
      </div>
    `;
  }
  
  enableResultsButtons(false);
  
  try {
    const res = await fetch(`${API_BASE}/api/recorder/generate-minutes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId: activeRecordingId, forceRegenerate: true })
    });
    const data = await res.json();
    if (data.success && data.minutes) {
      generatedMinutes = data.minutes;
      previewArea.innerHTML = formatMarkdown(data.minutes);
      showChatToast('Notulensi rapat berhasil dibuat ulang.');
    } else {
      previewArea.innerHTML = `<div style="text-align:center;color:var(--danger)">Gagal membuat ulang: ${data.error || 'Unknown error'}</div>`;
    }
  } catch (e) {
    if (previewArea) previewArea.innerHTML = `<div style="text-align:center;color:var(--danger)">Kesalahan jaringan saat membuat ulang.</div>`;
  } finally {
    enableResultsButtons(true);
  }
}

function downloadDocx(recId = null) {
  const targetId = recId || activeRecordingId;
  if (!targetId) return;
  
  window.open(`${API_BASE}/api/recorder/download/${targetId}`);
}

function copyMinutesToClipboard() {
  if (!generatedMinutes) return;
  
  navigator.clipboard.writeText(generatedMinutes)
    .then(() => showChatToast('Notulensi berhasil disalin ke clipboard.'))
    .catch(() => showChatToast('Gagal menyalin ke clipboard.', 'error'));
}

async function saveMinutesToRAG() {
  if (!activeRecordingId) return;
  
  const saveBtn = $('#rec-save-kb-btn');
  if (saveBtn) {
    saveBtn.setAttribute('disabled', 'true');
    saveBtn.textContent = 'Saving...';
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/recorder/save-to-knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId: activeRecordingId })
    });
    const data = await res.json();
    if (data.success) {
      showChatToast(`Tersimpan di Knowledge Base RAG: ${data.filename}`);
      if (saveBtn) saveBtn.textContent = '💾 Simpan ke RAG (Tersimpan)';
    } else {
      showChatToast('Gagal menyimpan ke Knowledge Base: ' + data.error, 'error');
      if (saveBtn) {
        saveBtn.removeAttribute('disabled');
        saveBtn.textContent = '💾 Simpan ke RAG';
      }
    }
  } catch (e) {
    showChatToast('Kesalahan koneksi saat menyimpan ke Knowledge Base RAG.', 'error');
    if (saveBtn) {
      saveBtn.removeAttribute('disabled');
      saveBtn.textContent = '💾 Simpan ke RAG';
    }
  }
}

function formatMarkdown(mdText) {
  if (!mdText) return '';
  
  let html = mdText;
  
  // Escape HTML first to prevent broken tags
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Blockquotes
  html = html.replace(/^&gt;\s+(.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/<\/blockquote>\s*<\/blockquote>/g, '<br>');
  
  // Code blocks and inline code
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Headers
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Lists
  html = html.replace(/^\s*[-*+]\s+(.*$)/gim, '<ul><li>$1</li></ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  
  html = html.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<ol><li>$2</li></ol>');
  html = html.replace(/<\/ol>\s*<ol>/g, '');
  
  // Paragraphs
  const blocks = html.split(/\n{2,}/);
  html = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^<(h1|h2|h3|h4|ul|ol|pre|blockquote|div)/i.test(trimmed)) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  
  return html;
}

export function unmount() {
  // Clean up Meeting Recorder resources
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch (e) {
      console.warn('[RECORDER] Gagal menghentikan MediaRecorder di unmount:', e);
    }
  }
  mediaRecorder = null;
  if (recognitionContinuous) {
    try { recognitionContinuous.stop(); } catch (e) {
      console.warn('[RECORDER] Gagal menghentikan STT di unmount:', e);
    }
    recognitionContinuous = null;
  }
  if (stream) {
    try {
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      console.warn('[RECORDER] Gagal menghentikan audio track di unmount:', e);
    }
    stream = null;
  }
  // Close AudioContext
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(() => {});
    audioContext = null;
    analyser = null;
  }
  
  // Reset all recorder state
  recorderState = 'idle';
  transcriptLines = [];
  recordingDuration = 0;
  recordingStartTime = null;
  generatedMinutes = null;
  recordingsList = [];
  activeRecordingId = null;
  audioChunks = [];
  sttRetryCount = 0;

  isRecording = false;
  if (recognition) {
    try { recognition.stop(); } catch (e) {
      console.warn('[CHAT] Gagal cleanup recognition di unmount:', e);
    }
  }

  // Unbind global TTS settings listener
  window.removeEventListener('damz_tts_changed', handleTtsChange);

  // Stop playing Piper audio if active
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  // Stop Web Speech synthesis if active
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;

  // Reset speaker visual indicator
  const spkDot = document.querySelector('[data-indicator="SPK"]');
  if (spkDot) {
    spkDot.style.background = '';
    spkDot.style.borderColor = '';
  }
  const spkStatus = document.getElementById('sidebar-spk-status');
  if (spkStatus) {
    spkStatus.textContent = 'Idle';
  }
}
