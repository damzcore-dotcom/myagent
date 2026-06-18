# PRD: Damz Agent v2.0 — Full-Stack Local AI Voice Assistant

**Version**: 2.0  
**Status**: Draft  
**Last Updated**: Juni 2025  
**Author**: Damz

---

## 1. Product Overview

**Damz Agent** adalah premium AI Voice Assistant yang berjalan 100% lokal di Windows 11, dirancang untuk privasi absolut dan performa tinggi. Sistem mengintegrasikan Speech-to-Text (STT) berbasis Whisper, Large Language Model (LLM) via Ollama, Knowledge Base dengan RAG (Retrieval-Augmented Generation), Vision multi-modal, dan Text-to-Speech (TTS) natural — semua tanpa koneksi cloud.

### 1.1. Tujuan Produk

- Memberikan pengalaman voice assistant setara asisten cloud (Jarvis/Alexa) namun 100% privat dan offline
- Menjadi platform agent yang dapat diperluas dengan plugin/tools custom (termasuk integrasi GarmentMind)
- Mendukung Bahasa Indonesia sebagai bahasa utama interaksi

### 1.2. Target Pengguna

Pengguna teknis (developer / power user) yang membutuhkan asisten AI pribadi dengan kontrol penuh atas data dan inferensi lokal.

---

## 2. Full-Stack Architecture

### 2.1. Backend (Logic & AI)

| Komponen | Teknologi | Keterangan |
|---|---|---|
| Orchestration | LangChain (ReAct Agent) | Framework agent & tool calling |
| Inference Engine | Ollama | Runtime LLM lokal |
| LLM Primary | Llama 3.2:3b | Ringan, cepat, cocok RAM 8–16GB |
| LLM Advanced | Mistral:7b | Lebih pintar, butuh RAM 16GB+ |
| STT | Faster-Whisper via RealtimeSTT | Speech-to-Text lokal |
| TTS | Piper TTS | Text-to-Speech lokal, natural |
| Wake Word | openWakeWord | Deteksi "Halo Damz" tanpa API key |
| RAG Vector DB | ChromaDB | Penyimpanan embedding lokal |
| Embeddings | Nomic Embed Text (via Ollama) | Model embedding lokal |
| Memory ST | LangChain ConversationBufferMemory | Memory dalam satu sesi |
| Memory LT | SQLite | Memory lintas sesi (persistent) |
| Config | config.yaml | Konfigurasi terpusat user-editable |

> **Catatan Wake Word**: Porcupine (Picovoice) diganti ke **openWakeWord** karena: (1) tidak memerlukan API key, (2) sepenuhnya offline, (3) mendukung custom wake word termasuk Bahasa Indonesia, konsisten dengan prinsip zero cloud leakage.

### 2.2. Frontend (UI/UX)

- **Visual Language**: Obsidian Sentinel — High-fidelity Dark Mode
- **UI Framework**: **CustomTkinter** (dipilih sebagai keputusan final)
  - Built on top of Tkinter (Python native, tidak perlu install runtime tambahan)
  - Tampilan modern dark mode native tanpa WebView dependency
  - Lebih ringan dari PyQt6, lebih modern dari Tkinter murni

**Key Screens**:

| Screen | Fungsi |
|---|---|
| Dashboard | Real-time monitoring (CPU/RAM, status agent, log ringkas) |
| Chat | Percakapan multi-modal (teks + voice + gambar) |
| Knowledge Base | Manajemen dokumen RAG (upload, index, hapus) |
| Vision | Analisis gambar/screenshot lokal |
| Tools Config | Konfigurasi dan toggle tools/plugin modular |
| System Logs | Terminal-aesthetic log viewer |

---

## 3. Technical Requirements

### 3.1. Hardware Specifications

| Komponen | Minimum | Rekomendasi |
|---|---|---|
| RAM | 8 GB | 16 GB |
| GPU | Tidak wajib | NVIDIA 4GB+ VRAM (CUDA) |
| CPU | Intel i5 / Ryzen 5 | Intel i7 / Ryzen 7 |
| Storage | 10 GB free | 20 GB free |
| Mikrofon | Built-in | Dedicated microphone |
| OS | Windows 11 | Windows 11 |

### 3.2. Core Dependencies

```bash
# Core AI & Agent
pip install RealtimeSTT faster-whisper
pip install langchain langchain-community langchain-ollama
pip install chromadb
pip install openwakeword

# System & Tools
pip install pygame sounddevice soundfile
pip install psutil pywin32 requests

# UI
pip install customtkinter

# Document ingestion (RAG)
pip install pypdf python-docx

# Config management
pip install pyyaml python-dotenv
```

### 3.3. File & Folder Structure

```
C:\DamzAgent\
├── main.py                  ← Entry point
├── config.yaml              ← Konfigurasi user-editable
├── .env                     ← Secrets (jika ada)
│
├── core\
│   ├── agent.py             ← LangChain ReAct Agent setup
│   ├── memory.py            ← Short-term & long-term memory
│   ├── stt.py               ← Speech-to-Text (Whisper)
│   ├── tts.py               ← Text-to-Speech (Piper)
│   └── wake_word.py         ← openWakeWord listener
│
├── tools\
│   ├── __init__.py          ← Register semua tools
│   ├── system_tools.py      ← App launcher, system monitor
│   ├── web_tools.py         ← Browser & web search
│   ├── reminder_tools.py    ← Reminder & scheduler
│   └── garmentmind_tools.py ← Plugin GarmentMind (opsional)
│
├── rag\
│   ├── ingestor.py          ← PDF/TXT/DOCX ingestion pipeline
│   ├── retriever.py         ← ChromaDB query interface
│   └── documents\           ← Folder dokumen user (watched)
│
├── vision\
│   └── analyzer.py          ← Screenshot & image analysis
│
├── ui\
│   ├── app.py               ← CustomTkinter main window
│   ├── screens\
│   │   ├── dashboard.py
│   │   ├── chat.py
│   │   ├── knowledge_base.py
│   │   ├── vision.py
│   │   ├── tools_config.py
│   │   └── logs.py
│   └── assets\              ← Icons, fonts
│
├── data\
│   ├── damz_memory.db       ← SQLite long-term memory
│   ├── chroma_db\           ← ChromaDB vector store
│   └── logs\                ← Application logs
│       └── damz_agent.log
│
└── voices\                  ← Piper voice models
    ├── id_ID-argana-medium.onnx
    └── en_US-ryan-high.onnx
```

### 3.4. Config File (config.yaml)

```yaml
agent:
  name: "Damz"
  language: "id"              # id = Bahasa Indonesia, en = English

llm:
  model: "llama3.2:3b"        # Ganti ke mistral:7b jika RAM cukup
  base_url: "http://localhost:11434"
  temperature: 0.7

stt:
  model: "base"               # tiny | base | small | medium
  language: "id"

tts:
  engine: "piper"
  piper_exe: "C:/piper/piper.exe"
  voice_id: "id"              # id | en
  voices:
    id: "C:/DamzAgent/voices/id_ID-argana-medium.onnx"
    en: "C:/DamzAgent/voices/en_US-ryan-high.onnx"

wake_word:
  enabled: true
  keyword: "halo damz"
  sensitivity: 0.5

rag:
  chunk_size: 512
  chunk_overlap: 64
  auto_watch: true            # Auto-index jika ada file baru di documents/

memory:
  short_term_max_turns: 10
  long_term_enabled: true
  db_path: "C:/DamzAgent/data/damz_memory.db"

hotkey:
  enabled: true
  key: "ctrl+space"           # Aktifkan tanpa wake word

output_mode: "voice_and_text" # voice_and_text | text_only | voice_only

logging:
  level: "INFO"
  path: "C:/DamzAgent/data/logs/damz_agent.log"
```

---

## 4. Feature Specifications

### 4.1. Voice Interaction

- Wake word detection menggunakan **openWakeWord** dengan kata "Halo Damz"
- Background listening dengan overhead CPU rendah (<5% idle)
- Transisi otomatis: Wake Word → STT aktif → Transkripsi → LLM → TTS
- Hotkey global (`Ctrl+Space`) sebagai alternatif wake word
- **Output Mode Toggle**: voice + teks / teks saja / suara saja (bisa diset di config atau UI)

**Audio Pipeline Flow**:

```
Mikrofon
   │
   ▼
[openWakeWord]  ── tidak terdeteksi ──→ (lanjut listen)
   │ "Halo Damz" terdeteksi
   ▼
[Faster-Whisper STT]
   │ teks transkripsi
   ▼
[TTS Queue Manager]  ← interrupt jika agent sedang bicara
   │
   ▼
[LangChain ReAct Agent]
   │         │
   ▼         ▼
[Ollama]  [Tools]
   │
   ▼
[Piper TTS]  →  Speaker
   │
   ▼
[UI Chat Screen]
```

### 4.2. Conversation Memory

**Short-Term Memory (dalam sesi)**:
- Implementasi: `LangChain ConversationBufferMemory`
- Kapasitas: 10 turn terakhir (configurable)
- Reset saat agent dimatikan atau perintah "reset memory"

**Long-Term Memory (lintas sesi)**:
- Implementasi: SQLite database (`damz_memory.db`)
- Menyimpan: ringkasan sesi, preferensi pengguna, fakta penting
- Agent secara otomatis menyimpan informasi relevan di akhir sesi
- Query via semantic search sederhana

### 4.3. Knowledge Base (RAG)

- **Format yang didukung**: PDF, TXT, DOCX
- **Ingestion pipeline**:
  1. User drop file ke folder `documents/` atau via UI Knowledge Base screen
  2. File watcher otomatis mendeteksi file baru (jika `auto_watch: true`)
  3. Dokumen di-chunk (512 token, overlap 64 token)
  4. Di-embed menggunakan Nomic Embed Text (via Ollama)
  5. Disimpan ke ChromaDB
- **Re-indexing**: Otomatis jika file dimodifikasi (hash-based detection)
- **Retrieval**: Top-3 chunk paling relevan disertakan ke konteks LLM
- **UI**: Tampilkan daftar dokumen ter-index, status, tombol hapus/re-index

### 4.4. Vision Module

- Trigger: perintah "analisis gambar ini" atau "lihat screenshot"
- Ambil screenshot otomatis dengan `pyautogui` atau terima input gambar dari UI
- Analisis menggunakan **Llama 3.2 Vision** (via Ollama) atau **moondream2** (lebih ringan)
- OCR untuk ekstrak teks dari gambar menggunakan Tesseract

**Catatan Hardware Vision**:

| Model | VRAM | RAM | Kecepatan |
|---|---|---|---|
| llama3.2-vision:11b | 8GB+ | 16GB+ | Lambat di CPU |
| moondream2 | 2GB | 4GB+ | Lebih cepat |

Rekomendasi: **moondream2** untuk sistem tanpa GPU dedicated, **llama3.2-vision** untuk sistem dengan GPU NVIDIA 8GB+.

### 4.5. System Tools

| Tool | Fungsi |
|---|---|
| `open_application()` | Buka app Windows (Notepad, Chrome, VSCode, dll) |
| `get_system_info()` | CPU%, RAM%, Disk usage real-time |
| `set_reminder()` | Pengingat dengan Windows notification |
| `search_web()` | Buka browser ke Google Search |
| `read_file()` | Baca konten file teks |
| `take_screenshot()` | Ambil screenshot untuk Vision |
| `get_current_time()` | Waktu & tanggal sekarang |

### 4.6. Plugin System (Modular Tools)

Tools diorganisasi sebagai plugin yang dapat di-enable/disable via UI Tools Config screen tanpa restart agent.

```python
# Struktur plugin
class DamzTool:
    name: str
    description: str
    enabled: bool
    
    def execute(self, input: str) -> str: ...
```

**Plugin GarmentMind** (opsional, aktifkan jika diperlukan):
- `cek_status_produksi()` — Query production status dari GarmentMind API
- `cek_absensi()` — Query data absensi dari HIRIS
- `laporan_harian()` — Generate ringkasan operasional harian

### 4.7. TTS Queue Management

Untuk mencegah overlap audio ketika user interrupt agent yang sedang bicara:

- TTS dijalankan dalam thread terpisah dengan queue
- Jika wake word/hotkey terdeteksi saat TTS aktif → TTS dihentikan (`pygame.mixer.stop()`)
- Status indicator di UI menunjukkan: Listening / Thinking / Speaking

### 4.8. Error Handling & Fallback

| Kondisi Error | Handling |
|---|---|
| Ollama tidak jalan | Auto-retry 3x, tampilkan notifikasi UI, log error |
| Mikrofon tidak terdeteksi | Fallback ke input teks, notifikasi user |
| STT gagal transkripsi | "Maaf, saya tidak mendengar dengan jelas. Bisa diulangi?" |
| LLM timeout (>30 detik) | Hentikan request, tampilkan pesan timeout |
| ChromaDB error | Fallback ke jawaban LLM tanpa RAG, log warning |
| Piper TTS gagal | Fallback ke print-only (text output), log error |

---

## 5. Security & Privacy

- **Zero Cloud Leakage**: Tidak ada data suara, teks, atau dokumen yang dikirim ke server eksternal
- **Local Persistence**:
  - Model Ollama: `C:\Users\%USERNAME%\.ollama\`
  - Database & logs: `C:\DamzAgent\data\`
  - Vector store: `C:\DamzAgent\data\chroma_db\`
- **Log Sanitization**: Log tidak menyimpan konten percakapan lengkap, hanya metadata (timestamp, tool used, duration)
- **File Permissions**: Folder `documents/` dan `data/` hanya accessible oleh user yang menjalankan agent

---

## 6. UI/UX Specification

### 6.1. Design Language: Obsidian Sentinel

| Token | Value |
|---|---|
| Background Primary | `#0d1117` |
| Background Secondary | `#161b22` |
| Background Tertiary | `#21262d` |
| Accent Blue | `#58a6ff` |
| Accent Green (status OK) | `#56d364` |
| Accent Red (status error) | `#f85149` |
| Accent Yellow (status warn) | `#e3b341` |
| Text Primary | `#e6edf3` |
| Text Muted | `#8b949e` |
| Font | Consolas / JetBrains Mono |

### 6.2. Status Indicators

Agent menampilkan status real-time di semua screen:
- 🟢 **Listening** — Menunggu wake word
- 🔵 **Processing** — STT / LLM sedang berjalan
- 🟡 **Speaking** — TTS aktif
- 🔴 **Error** — Ada masalah, lihat logs

---

## 7. Implementation Roadmap

### Phase 1 — Core Voice (Estimasi: 1–2 minggu)
- Setup Ollama + pull model
- Integrasi Faster-Whisper (STT)
- Integrasi Piper TTS
- Basic terminal voice loop (tanpa UI)
- Config via `config.yaml`

### Phase 2 — Intelligence (Estimasi: 1–2 minggu)
- Implementasi LangChain ReAct Agent
- Short-term & long-term memory (SQLite)
- Semua system tools (app launcher, monitor, reminder)
- Error handling & fallback logic
- TTS queue manager (interrupt handling)

### Phase 3 — Knowledge Base (Estimasi: 1 minggu)
- ChromaDB setup + Nomic Embed Text
- Document ingestion pipeline (PDF/TXT/DOCX)
- Auto-watch folder + re-indexing
- RAG retrieval terintegrasi ke agent

### Phase 4 — Visual & UI (Estimasi: 2 minggu)
- CustomTkinter UI (semua 6 screen)
- Integrasi voice loop ke UI
- Vision module (moondream2 / llama3.2-vision)
- Tools Config screen (enable/disable plugin)

### Phase 5 — Activation & Plugin (Estimasi: 1 minggu)
- openWakeWord setup + training/fine-tune "Halo Damz"
- Hotkey global (`Ctrl+Space`)
- Plugin GarmentMind & HIRIS (opsional)
- Performance tuning & testing end-to-end

---

## 8. Testing Checklist

### Per Phase

- [ ] Voice terdeteksi dan ditranskripsikan dengan akurasi >80%
- [ ] LLM merespons dalam <10 detik (model 3b, CPU)
- [ ] TTS menghasilkan audio tanpa artefak
- [ ] Wake word tidak false-positive lebih dari 1x per 10 menit idle
- [ ] Memory persist setelah restart agent
- [ ] RAG mengembalikan dokumen relevan dalam query test
- [ ] UI responsif tanpa freeze saat inferensi berjalan
- [ ] Semua tools berjalan tanpa error pada skenario normal
- [ ] Error handling tidak crash agent (graceful degradation)

---

*Damz Agent v2.0 — Full-Stack Local AI Voice Assistant*  
*100% Offline · Privacy-First · Extensible*
