/**
 * DAMZ AGENT — Chat Page
 * Interactive chat with real voice input (Web Speech API), persistent history,
 * and Ollama chat proxy backend.
 */

import { $, $$, uid, formatTime, typeWriter, sleep } from '../utils/helpers.js';

let chatMessages = [];
let isRecording = false;
let selectedMicId = localStorage.getItem('damz_selected_mic') || 'default';
let isHoldToRecord = localStorage.getItem('damz_hold_to_record') === 'true';
let recognition = null;
let isTtsEnabled = localStorage.getItem('damz_output_mode') !== 'text'; // ON if mode is both/voice
let currentUtterance = null;
let currentAudio = null;

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
    const saved = localStorage.getItem('damz_chat_history');
    if (saved) {
      chatMessages = JSON.parse(saved);
      return;
    }
  } catch (e) {}
  
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
  localStorage.setItem('damz_chat_history', JSON.stringify(chatMessages));
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
      } catch (e) {}
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
    } catch(e) {}
  }

  return `
    <div class="page-chat">
      <div class="chat-header">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="chat-header-title">Interactive Chat</div>
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
      <div class="chat-container">
        <div class="chat-messages" id="chat-messages">
          ${renderMessages()}
        </div>
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
    </div>
  `;
}

function renderMessages() {
  return chatMessages.map(msg => {
    if (msg.role === 'user') {
      return `
        <div class="chat-msg chat-msg--user">
          <span class="chat-msg-prompt">&gt;_</span>
          <div class="chat-msg-content">${escapeHtml(msg.content)}</div>
        </div>
      `;
    }
    return `
      <div class="chat-msg chat-msg--agent">
        <div class="chat-msg-content">${escapeHtml(msg.content)}</div>
        <div class="chat-msg-meta">
          <span>${formatTime(msg.timestamp)}</span>
          ${msg.model ? `<span>${msg.model}</span>` : ''}
          ${msg.latency ? `<span>${msg.latency}ms</span>` : ''}
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
        ttsVoiceSetting = parsed.tts.voice; // e.g. 'id_ID-male-medium' or 'id_ID-female-medium'
      }
    } catch (e) {}
  }
  currentUtterance.lang = lang;
  currentUtterance.rate = 1.0;
  currentUtterance.pitch = 1.0;
  currentUtterance.volume = 1.0;

  // Select the best natural-sounding voice
  const voices = window.speechSynthesis.getVoices();
  let preferred = null;

  if (lang === 'id-ID') {
    // Try to map based on gender settings
    if (ttsVoiceSetting.includes('male')) {
      preferred = voices.find(v => v.lang === lang && v.name.includes('Ardi')); // Edge Online Male
    } else if (ttsVoiceSetting.includes('female')) {
      preferred = voices.find(v => v.lang === lang && v.name.includes('Gadis')); // Edge Online Female
    }

    // Fallbacks if not found:
    if (!preferred) {
      preferred = 
        voices.find(v => v.lang === lang && v.name.includes('Gadis')) || // Default female
        voices.find(v => v.lang === lang && v.name.includes('Ardi')) ||  // Default male
        voices.find(v => v.lang === lang && v.name.includes('Natural')) ||
        voices.find(v => v.lang === lang && v.name.includes('Online')) ||
        voices.find(v => v.lang === lang && !v.name.includes('Google')) ||
        voices.find(v => v.lang === lang) ||
        voices.find(v => v.lang.startsWith('id')) ||
        null;
    }
  } else {
    // English voice mapping
    preferred = 
      voices.find(v => v.lang === lang && v.name.includes('Natural')) ||
      voices.find(v => v.lang === lang && v.name.includes('Online')) ||
      voices.find(v => v.lang === lang && !v.name.includes('Google')) ||
      voices.find(v => v.lang === lang) ||
      null;
  }

  if (preferred) {
    currentUtterance.voice = preferred;
    console.log(`[TTS] Using Edge natural voice: ${preferred.name}`);
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
  currentUtterance.onerror = resetSpk;

  window.speechSynthesis.speak(currentUtterance);
}

export function mount() {
  const input = $('#chat-input');
  const sendBtn = $('#send-btn');
  const voiceBtn = $('#voice-btn');
  const settingsBtn = $('#mic-settings-btn');
  const popover = $('#mic-settings-popover');
  const holdToggle = $('#hold-to-record-toggle');
  const messagesEl = $('#chat-messages');

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
      } catch (e) {}
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

    const res = await fetch('http://localhost:3001/api/ollama/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        messages: recentMessages
      })
    });
    const data = await res.json();
    showTyping(false);
    if (data.success && data.content) {
      // Filter out any Chinese characters and punctuation (hallucinations) from the response text
      const cleanContent = data.content.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g, '').trim();
      await appendAgentMessage(cleanContent, activeModel, data.latency || 1000);
      // Speak the agent's response if TTS is enabled
      speakText(cleanContent);
    } else {
      await appendAgentMessage(`[ERROR] Gagal mendapatkan respons dari Ollama: ${data.error || 'Unknown error'}`, activeModel, 0);
    }
  } catch (err) {
    showTyping(false);
    console.error('[CHAT] Gagal menghubungi backend:', err);
    await appendAgentMessage('Terjadi kesalahan koneksi saat menghubungi backend Express server.', 'None', 0);
  }
}

async function sendMessage() {
  const input = $('#chat-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = '';

  // Add user message
  appendUserMessage(text);

  await handleChatResponse(text);
}

function appendUserMessage(content) {
  const messagesEl = $('#chat-messages');
  if (!messagesEl) return;

  const msg = { id: uid(), role: 'user', content, timestamp: new Date().toISOString() };
  chatMessages.push(msg);
  saveChatHistory();

  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg--user';
  div.innerHTML = `
    <span class="chat-msg-prompt">&gt;_</span>
    <div class="chat-msg-content">${escapeHtml(content)}</div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function appendAgentMessage(content, model, latency) {
  const messagesEl = $('#chat-messages');
  if (!messagesEl) return;

  const now = new Date().toISOString();
  const msg = { id: uid(), role: 'assistant', content, timestamp: now, model, latency };
  chatMessages.push(msg);
  saveChatHistory();

  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg--agent';
  div.innerHTML = `
    <div class="chat-msg-content" id="msg-${msg.id}"></div>
    <div class="chat-msg-meta">
      <span>${formatTime(now)}</span>
      <span>${model}</span>
      <span>${latency}ms</span>
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

export function unmount() {
  isRecording = false;
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
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
