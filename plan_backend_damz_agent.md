# Plan: Backend Implementation — Damz Agent v2.0
**Status**: Draft | Juni 2025  
**Scope**: core/ + tools/ + rag/ — semua backend Python

---

## Gambaran Besar

```
PHASE 1 — Foundation         PHASE 2 — Intelligence       PHASE 3 — Knowledge
─────────────────────        ──────────────────────        ───────────────────
core/config.py               core/agent.py                 rag/ingestor.py
core/ollama_client.py        core/memory.py                rag/retriever.py
core/stt.py                  tools/__init__.py             rag/watcher.py
core/tts.py                  tools/system_tools.py
core/wake_word.py            tools/web_tools.py
main.py                      tools/reminder_tools.py
                             tools/garmentmind_tools.py
```

**Estimasi total**: 4–6 minggu  
**Urutan wajib**: Phase 1 → Phase 2 → Phase 3 (tidak bisa dibalik)

---

## PHASE 1 — Foundation
*Target: Agent bisa jalan di terminal, voice in → text out → voice out*

---

### Step 1.1 — core/config.py
**Estimasi**: 1–2 jam

**Tujuan**: Load dan validasi `config.yaml`, satu sumber kebenaran untuk semua setting.

```python
# core/config.py

import yaml
from pathlib import Path
from dataclasses import dataclass

CONFIG_PATH = Path("C:/DamzAgent/config.yaml")

@dataclass
class LLMConfig:
    model: str
    base_url: str
    temperature: float

@dataclass
class STTConfig:
    model: str          # tiny | base | small | medium
    language: str       # id | en

@dataclass
class TTSConfig:
    piper_exe: str
    voice_id: str
    voices: dict        # { "id": "path.onnx", "en": "path.onnx" }

@dataclass
class AgentConfig:
    name: str
    system_prompt: str
    memory_max_turns: int

@dataclass
class AppConfig:
    llm: LLMConfig
    stt: STTConfig
    tts: TTSConfig
    agent: AgentConfig
    hotkey: str
    output_mode: str    # voice_and_text | text_only | voice_only

def load_config(path: Path = CONFIG_PATH) -> AppConfig:
    with open(path) as f:
        raw = yaml.safe_load(f)
    # parse & return AppConfig
    ...

def save_config(config: AppConfig, path: Path = CONFIG_PATH):
    # serialize AppConfig → yaml → tulis ke disk
    ...
```

**Test**:
```bash
python -c "from core.config import load_config; c = load_config(); print(c.llm.model)"
# Output: llama3.2:3b
```

---

### Step 1.2 — core/ollama_client.py
**Estimasi**: 2–3 jam

**Tujuan**: Semua komunikasi dengan Ollama server — health check, list model, switch model.

```python
# core/ollama_client.py

import requests
from dataclasses import dataclass

@dataclass
class ModelInfo:
    name: str
    size_gb: float
    family: str
    tags: list[str]     # ACTIVE, FAST, SMART, VISION, EMBEDDING
    is_active: bool

class OllamaClient:
    def __init__(self, base_url: str):
        self.base_url = base_url  # http://localhost:11434 atau remote IP

    def test_connection(self, timeout=5) -> dict:
        """
        Returns:
          { success: True, version: str, model_count: int }
          { success: False, error: str }
        Error messages spesifik:
          - "Connection refused" → Ollama tidak jalan
          - "Timeout" → server lambat / firewall
          - "Network unreachable" → IP salah
        """
        ...

    def get_models(self) -> list[ModelInfo]:
        """Fetch daftar model dari /api/tags, auto-tag tiap model."""
        ...

    def pull_model(self, model_name: str) -> bool:
        """Download model baru. Streaming progress via /api/pull."""
        ...

    def delete_model(self, model_name: str) -> bool:
        """Hapus model dari disk."""
        ...

    def set_base_url(self, url: str):
        """Ganti URL (remote switch) tanpa restart."""
        self.base_url = url
```

**Test**:
```bash
python -c "
from core.ollama_client import OllamaClient
c = OllamaClient('http://localhost:11434')
print(c.test_connection())
print([m.name for m in c.get_models()])
"
```

---

### Step 1.3 — core/tts.py
**Estimasi**: 2–3 jam

**Tujuan**: Text → audio via Piper TTS, dengan queue agar tidak overlap.

```python
# core/tts.py

import subprocess
import pygame
import threading
import queue

class TTSEngine:
    def __init__(self, config):
        self.config = config
        self._queue = queue.Queue()
        self._current_proc = None
        self._worker = threading.Thread(target=self._process_queue, daemon=True)
        self._worker.start()

    def speak(self, text: str, priority: bool = False):
        """
        Tambah teks ke antrian TTS.
        priority=True → interrupt TTS yang sedang jalan (misal saat user berbicara).
        """
        if priority:
            self.stop()
        self._queue.put(text)

    def stop(self):
        """Hentikan TTS yang sedang berjalan, kosongkan queue."""
        self._queue.queue.clear()
        if pygame.mixer.get_init():
            pygame.mixer.stop()
        if self._current_proc:
            self._current_proc.terminate()

    def _process_queue(self):
        """Worker thread — ambil teks dari queue, render Piper, putar."""
        while True:
            text = self._queue.get()
            self._render_and_play(text)

    def _render_and_play(self, text: str):
        """Jalankan Piper, simpan .wav, putar dengan pygame."""
        ...
```

**Test**:
```bash
python -c "
from core.tts import TTSEngine
from core.config import load_config
tts = TTSEngine(load_config().tts)
tts.speak('Halo, saya Damz. Sistem siap.')
import time; time.sleep(5)
"
```

---

### Step 1.4 — core/stt.py
**Estimasi**: 3–4 jam

**Tujuan**: Mikrofon → teks via Faster-Whisper, callback saat transkripsi selesai.

```python
# core/stt.py

from RealtimeSTT import AudioToTextRecorder

class STTEngine:
    def __init__(self, config, on_text_callback):
        """
        on_text_callback: function(text: str) dipanggil tiap kali
        ada transkripsi baru.
        """
        self.config = config
        self.on_text = on_text_callback
        self._recorder = None
        self._active = False

    def start(self):
        """Mulai listening loop di thread terpisah."""
        ...

    def stop(self):
        """Hentikan STT engine."""
        ...

    def pause(self):
        """Pause sementara (misal saat TTS sedang bicara)."""
        ...

    def resume(self):
        """Resume setelah TTS selesai."""
        ...
```

**Catatan penting**:
- STT harus di-pause saat TTS bicara agar tidak mentranskripsi suara agent sendiri
- Tambahkan noise gate: abaikan transkripsi < 2 karakter

**Test**:
```bash
python -c "
from core.stt import STTEngine
from core.config import load_config

def on_text(t): print('Transkripsi:', t)

stt = STTEngine(load_config().stt, on_text)
stt.start()
input('Tekan Enter untuk stop...')
stt.stop()
"
```

---

### Step 1.5 — core/wake_word.py
**Estimasi**: 2–3 jam

**Tujuan**: Background listener untuk kata "Halo Damz", trigger STT saat terdeteksi.

```python
# core/wake_word.py

import openwakeword
import sounddevice as sd
import numpy as np
import threading

class WakeWordDetector:
    def __init__(self, config, on_detected_callback):
        """
        on_detected_callback: dipanggil tanpa argumen saat wake word terdeteksi.
        """
        self.config = config
        self.on_detected = on_detected_callback
        self._model = None
        self._running = False

    def start(self):
        """Load model openWakeWord, mulai streaming audio."""
        ...

    def stop(self):
        ...

    def _audio_callback(self, indata, frames, time, status):
        """Callback dari sounddevice, feed ke openWakeWord model."""
        prediction = self._model.predict(indata)
        if prediction["hey_damz"] > self.config.sensitivity:
            self.on_detected()
```

**Catatan**:
- openWakeWord butuh model custom untuk "Halo Damz" — gunakan model bawaan dulu
  (`hey_jarvis` atau `alexa`) untuk testing, fine-tune nanti di Phase 5
- Sensitivity default: 0.5 (bisa diatur dari Settings UI)

**Test**:
```bash
python -c "
from core.wake_word import WakeWordDetector
from core.config import load_config

def on_detected(): print('Wake word terdeteksi!')

ww = WakeWordDetector(load_config(), on_detected)
ww.start()
input('Bicara wake word, tekan Enter untuk stop...')
ww.stop()
"
```

---

### Step 1.6 — main.py (Phase 1 version)
**Estimasi**: 2–3 jam

**Tujuan**: Integrasikan semua komponen Phase 1, voice loop berjalan di terminal.

```python
# main.py — Phase 1: terminal voice loop

from core.config import load_config
from core.ollama_client import OllamaClient
from core.tts import TTSEngine
from core.stt import STTEngine
from core.wake_word import WakeWordDetector

def main():
    config = load_config()

    # 1. Health check Ollama
    ollama = OllamaClient(config.llm.base_url)
    result = ollama.test_connection()
    if not result["success"]:
        print(f"[ERROR] Ollama tidak bisa dihubungi: {result['error']}")
        return

    # 2. Init TTS
    tts = TTSEngine(config.tts)

    # 3. State machine sederhana
    state = {"listening_for_command": False}

    # 4. Callback chain
    def on_wake_word():
        state["listening_for_command"] = True
        tts.stop()             # interrupt TTS jika sedang bicara
        print("[WAKE] Wake word terdeteksi, aktifkan STT...")

    def on_transcription(text: str):
        if not state["listening_for_command"]:
            return
        state["listening_for_command"] = False
        print(f"[STT] {text}")
        # Phase 2: ganti dengan agent.invoke(text)
        tts.speak(f"Kamu bilang: {text}")

    # 5. Start semua engine
    stt = STTEngine(config.stt, on_transcription)
    wake = WakeWordDetector(config, on_wake_word)

    tts.speak(f"Halo! Saya {config.agent.name}. Sistem siap.")
    wake.start()
    stt.start()

    print("Agent berjalan. Ctrl+C untuk stop.")
    try:
        import time
        while True: time.sleep(1)
    except KeyboardInterrupt:
        wake.stop()
        stt.stop()
        print("Agent dihentikan.")

if __name__ == "__main__":
    main()
```

**Milestone Phase 1 selesai jika**:
- [ ] Bicara "Halo Damz" → terdeteksi
- [ ] Setelah wake word, bicara kalimat → ter-transkripsi
- [ ] Teks transkripsi diucapkan kembali oleh TTS
- [ ] Tidak ada crash saat dijalankan 10 menit

---

## PHASE 2 — Intelligence
*Target: Agent bisa menjawab dengan LLM + menjalankan tools*

---

### Step 2.1 — core/memory.py
**Estimasi**: 2–3 jam

**Tujuan**: Short-term (dalam sesi) dan long-term (lintas sesi) memory.

```python
# core/memory.py

import sqlite3
from langchain.memory import ConversationBufferMemory
from datetime import datetime

class ShortTermMemory:
    """LangChain ConversationBufferMemory wrapper."""

    def __init__(self, max_turns: int = 10):
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            k=max_turns
        )

    def add(self, human: str, ai: str):
        self.memory.save_context({"input": human}, {"output": ai})

    def get(self) -> list:
        return self.memory.load_memory_variables({})["chat_history"]

    def clear(self):
        self.memory.clear()


class LongTermMemory:
    """SQLite-based persistent memory lintas sesi."""

    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self._init_db()

    def _init_db(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT,          -- 'fact' | 'preference' | 'summary'
                content TEXT,
                created_at TEXT,
                session_id TEXT
            )
        """)
        self.conn.commit()

    def save(self, content: str, type: str = "fact", session_id: str = ""):
        self.conn.execute(
            "INSERT INTO memories (type, content, created_at, session_id) VALUES (?,?,?,?)",
            (type, content, datetime.now().isoformat(), session_id)
        )
        self.conn.commit()

    def search(self, query: str, limit: int = 5) -> list[str]:
        """Simple keyword search — upgrade ke semantic search di Phase 3."""
        cursor = self.conn.execute(
            "SELECT content FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?",
            (f"%{query}%", limit)
        )
        return [row[0] for row in cursor.fetchall()]

    def get_recent(self, limit: int = 10) -> list[dict]:
        cursor = self.conn.execute(
            "SELECT type, content, created_at FROM memories ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
        return [{"type": r[0], "content": r[1], "at": r[2]} for r in cursor.fetchall()]
```

---

### Step 2.2 — core/agent.py
**Estimasi**: 4–5 jam

**Tujuan**: LangChain ReAct Agent, integrasikan LLM + memory + tools.

```python
# core/agent.py

from langchain_ollama import ChatOllama
from langchain.agents import AgentExecutor, create_react_agent
from langchain_core.prompts import PromptTemplate
import yaml, requests

class DamzAgent:
    def __init__(self, config, tools: list, memory):
        self.config = config
        self.tools = tools
        self.memory = memory
        self.ollama = OllamaClient(config.llm.base_url)
        self.llm = self._build_llm()
        self.executor = self._build_executor()

    def _build_llm(self) -> ChatOllama:
        return ChatOllama(
            model=self.config.llm.model,
            base_url=self.config.llm.base_url,
            temperature=self.config.llm.temperature,
        )

    def _build_executor(self) -> AgentExecutor:
        prompt = PromptTemplate.from_template("""
Kamu adalah {agent_name}, asisten AI pribadi yang berjalan 100% lokal.
Jawab singkat dan jelas — responsmu akan diucapkan via speaker.
Hindari markdown, bullet point, atau format panjang.

Tools tersedia:
{tools}

Riwayat percakapan:
{chat_history}

Format:
Thought: ...
Action: nama_tool
Action Input: ...
Observation: ...
Final Answer: ...

Tool names: {tool_names}
Input: {input}
{agent_scratchpad}
""")
        agent = create_react_agent(self.llm, self.tools, prompt)
        return AgentExecutor(
            agent=agent,
            tools=self.tools,
            verbose=True,
            max_iterations=5,
            handle_parsing_errors=True,
        )

    def invoke(self, user_input: str) -> str:
        """Proses input user, kembalikan respons teks."""
        result = self.executor.invoke({
            "input": user_input,
            "agent_name": self.config.agent.name,
            "chat_history": self.memory.short.get(),
        })
        answer = result.get("output", "Maaf, saya tidak bisa menjawab.")
        self.memory.short.add(user_input, answer)
        return answer

    def switch_model(self, model_name: str) -> dict:
        """Ganti model LLM tanpa restart. Update config.yaml."""
        models = self.ollama.get_models()
        if model_name not in [m.name for m in models]:
            return {"success": False, "error": f"Model '{model_name}' tidak ada"}
        self.config.llm.model = model_name
        self.llm = self._build_llm()
        self.executor = self._build_executor()
        # Persist ke config.yaml
        save_config(self.config)
        return {"success": True, "model": model_name}
```

---

### Step 2.3 — tools/system_tools.py
**Estimasi**: 3–4 jam

```python
# tools/system_tools.py

from langchain.tools import tool
import psutil, subprocess, os, datetime, webbrowser, ctypes, threading, time

@tool
def get_current_time(dummy: str = "") -> str:
    """Dapatkan waktu dan tanggal saat ini."""
    now = datetime.datetime.now()
    return now.strftime("Sekarang hari %A, %d %B %Y, pukul %H:%M:%S")

@tool
def open_application(app_name: str) -> str:
    """
    Buka aplikasi Windows. 
    Contoh: notepad, chrome, vscode, calculator, explorer, word, excel
    """
    APP_MAP = {
        "notepad": "notepad.exe",
        "kalkulator": "calc.exe",
        "calculator": "calc.exe",
        "explorer": "explorer.exe",
        "chrome": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "vscode": r"%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe",
        "paint": "mspaint.exe",
        "cmd": "cmd.exe",
        "powershell": "powershell.exe",
    }
    exe = APP_MAP.get(app_name.lower())
    if exe:
        os.startfile(os.path.expandvars(exe))
        return f"Berhasil membuka {app_name}."
    return f"Aplikasi '{app_name}' tidak ditemukan."

@tool
def get_system_info(dummy: str = "") -> str:
    """Cek status sistem: CPU, RAM, Disk."""
    cpu = psutil.cpu_percent(interval=1)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage("C:/")
    return (
        f"CPU: {cpu}% | "
        f"RAM: {ram.used//(1024**3)}GB/{ram.total//(1024**3)}GB ({ram.percent}%) | "
        f"Disk C: {disk.used//(1024**3)}GB/{disk.total//(1024**3)}GB"
    )

@tool
def take_screenshot(filename: str = "") -> str:
    """Ambil screenshot layar, simpan ke folder Vision."""
    import pyautogui
    from pathlib import Path
    path = Path("C:/DamzAgent/data/vision")
    path.mkdir(exist_ok=True)
    name = filename or f"screenshot_{datetime.datetime.now().strftime('%H%M%S')}.png"
    pyautogui.screenshot(str(path / name))
    return f"Screenshot disimpan: {name}"

@tool
def set_reminder(input_str: str) -> str:
    """
    Set pengingat. Format: 'pesan|menit'
    Contoh: 'meeting zoom|30'
    """
    parts = input_str.split("|")
    message = parts[0].strip()
    minutes = int(parts[1].strip()) if len(parts) > 1 else 5

    def remind():
        time.sleep(minutes * 60)
        ctypes.windll.user32.MessageBoxW(0, message, "Pengingat Damz", 0x40)

    threading.Thread(target=remind, daemon=True).start()
    return f"Pengingat '{message}' diset {minutes} menit lagi."
```

---

### Step 2.4 — tools/web_tools.py
**Estimasi**: 1–2 jam

```python
# tools/web_tools.py

from langchain.tools import tool
import webbrowser

@tool
def search_web(query: str) -> str:
    """Buka Google Search di browser untuk query tertentu."""
    url = f"https://www.google.com/search?q={query.replace(' ', '+')}"
    webbrowser.open(url)
    return f"Membuka pencarian: {query}"

@tool
def open_url(url: str) -> str:
    """Buka URL tertentu di browser default."""
    if not url.startswith("http"):
        url = "https://" + url
    webbrowser.open(url)
    return f"Membuka: {url}"
```

---

### Step 2.5 — tools/garmentmind_tools.py
**Estimasi**: 2–3 jam (opsional, aktifkan jika GarmentMind API siap)

```python
# tools/garmentmind_tools.py

from langchain.tools import tool
import requests

GARMENTMIND_URL = "http://localhost:8000"   # ganti sesuai URL GarmentMind

@tool
def cek_status_produksi(dummy: str = "") -> str:
    """Cek status produksi terkini dari GarmentMind."""
    try:
        r = requests.get(f"{GARMENTMIND_URL}/api/production/status", timeout=5)
        data = r.json()
        return f"Produksi: {data.get('summary', 'tidak ada data')}"
    except:
        return "GarmentMind tidak dapat dijangkau."

@tool
def cek_absensi_hari_ini(dummy: str = "") -> str:
    """Cek data absensi hari ini dari HIRIS."""
    try:
        r = requests.get(f"{GARMENTMIND_URL}/api/attendance/today", timeout=5)
        data = r.json()
        return (
            f"Absensi hari ini: {data.get('present', 0)} hadir, "
            f"{data.get('absent', 0)} tidak hadir dari {data.get('total', 0)} karyawan."
        )
    except:
        return "HIRIS tidak dapat dijangkau."

@tool
def laporan_harian(dummy: str = "") -> str:
    """Buat ringkasan laporan operasional harian GarmentMind."""
    try:
        r = requests.get(f"{GARMENTMIND_URL}/api/reports/daily", timeout=5)
        data = r.json()
        return data.get("summary", "Tidak ada laporan hari ini.")
    except:
        return "Gagal mengambil laporan harian."
```

---

### Step 2.6 — tools/__init__.py
**Estimasi**: 30 menit

```python
# tools/__init__.py

from tools.system_tools import (
    get_current_time, open_application,
    get_system_info, take_screenshot, set_reminder
)
from tools.web_tools import search_web, open_url

# GarmentMind tools — aktifkan jika diperlukan
# from tools.garmentmind_tools import (
#     cek_status_produksi, cek_absensi_hari_ini, laporan_harian
# )

ALL_TOOLS = [
    get_current_time,
    open_application,
    get_system_info,
    take_screenshot,
    set_reminder,
    search_web,
    open_url,
]
```

**Milestone Phase 2 selesai jika**:
- [ ] `python main.py` → agent menjawab pertanyaan bebas via voice
- [ ] "Buka Chrome" → Chrome terbuka
- [ ] "Jam berapa sekarang?" → dijawab dengan benar
- [ ] "Status RAM" → dijawab dengan angka real
- [ ] Memory menyimpan konteks 10 turn terakhir
- [ ] Switch model via `agent.switch_model("mistral:7b")` berhasil

---

## PHASE 3 — Knowledge Base (RAG)
*Target: Agent bisa menjawab berdasarkan dokumen pribadi*

---

### Step 3.1 — rag/ingestor.py
**Estimasi**: 4–5 jam

**Tujuan**: Baca PDF/TXT/DOCX, chunk, embed, simpan ke ChromaDB.

```python
# rag/ingestor.py

import chromadb
from chromadb.utils.embedding_functions import OllamaEmbeddingFunction
from langchain.text_splitter import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from docx import Document as DocxDocument
from pathlib import Path
import hashlib

CHUNK_SIZE    = 512
CHUNK_OVERLAP = 64
COLLECTION    = "damz_docs"

class RAGIngestor:
    def __init__(self, config):
        self.client = chromadb.PersistentClient(
            path="C:/DamzAgent/data/chroma_db"
        )
        self.embed_fn = OllamaEmbeddingFunction(
            url=f"{config.llm.base_url}/api/embeddings",
            model_name="nomic-embed-text"
        )
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION,
            embedding_function=self.embed_fn
        )
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP
        )

    def ingest(self, file_path: str) -> dict:
        """
        Proses satu file: baca → chunk → embed → simpan ChromaDB.
        Returns: { success, chunks_added, file_hash }
        """
        path = Path(file_path)
        text = self._extract_text(path)
        if not text:
            return {"success": False, "error": "Gagal membaca file"}

        file_hash = hashlib.md5(path.read_bytes()).hexdigest()

        # Cek apakah sudah di-index dengan hash yang sama
        existing = self.collection.get(where={"file_hash": file_hash})
        if existing["ids"]:
            return {"success": True, "chunks_added": 0, "note": "Sudah ter-index"}

        # Hapus index lama jika ada (file diubah)
        old = self.collection.get(where={"filename": path.name})
        if old["ids"]:
            self.collection.delete(ids=old["ids"])

        # Chunk dan index
        chunks = self.splitter.split_text(text)
        ids = [f"{path.stem}_{i}" for i in range(len(chunks))]
        metadatas = [{"filename": path.name, "file_hash": file_hash, "chunk": i}
                     for i in range(len(chunks))]

        self.collection.add(documents=chunks, ids=ids, metadatas=metadatas)
        return {"success": True, "chunks_added": len(chunks)}

    def delete(self, filename: str) -> bool:
        """Hapus semua chunk dari dokumen tertentu."""
        result = self.collection.get(where={"filename": filename})
        if result["ids"]:
            self.collection.delete(ids=result["ids"])
            return True
        return False

    def get_stats(self) -> dict:
        """Total dokumen, chunk, storage."""
        count = self.collection.count()
        return {"total_chunks": count}

    def _extract_text(self, path: Path) -> str:
        """Ekstrak teks dari PDF, TXT, atau DOCX."""
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            return self._read_pdf(path)
        elif suffix == ".txt":
            return path.read_text(encoding="utf-8", errors="ignore")
        elif suffix == ".docx":
            return self._read_docx(path)
        return ""

    def _read_pdf(self, path: Path) -> str:
        reader = PdfReader(str(path))
        return "\n".join(p.extract_text() or "" for p in reader.pages)

    def _read_docx(self, path: Path) -> str:
        doc = DocxDocument(str(path))
        return "\n".join(p.text for p in doc.paragraphs)
```

---

### Step 3.2 — rag/retriever.py
**Estimasi**: 2–3 jam

**Tujuan**: Query ChromaDB → kembalikan chunk relevan → inject ke konteks LLM.

```python
# rag/retriever.py

import chromadb
from chromadb.utils.embedding_functions import OllamaEmbeddingFunction

class RAGRetriever:
    def __init__(self, config):
        self.client = chromadb.PersistentClient(
            path="C:/DamzAgent/data/chroma_db"
        )
        self.embed_fn = OllamaEmbeddingFunction(
            url=f"{config.llm.base_url}/api/embeddings",
            model_name="nomic-embed-text"
        )
        self.collection = self.client.get_or_create_collection(
            name="damz_docs",
            embedding_function=self.embed_fn
        )

    def query(self, text: str, top_k: int = 3) -> list[dict]:
        """
        Semantic search, kembalikan top-k chunk paling relevan.
        Returns: [{ content, filename, score }]
        """
        results = self.collection.query(
            query_texts=[text],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )
        output = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0]
        ):
            output.append({
                "content": doc,
                "filename": meta.get("filename", ""),
                "score": round(1 - dist, 3)      # konversi distance → similarity
            })
        return output

    def build_context(self, query: str) -> str:
        """
        Query → format sebagai konteks siap inject ke LLM prompt.
        """
        chunks = self.query(query)
        if not chunks:
            return ""
        lines = ["Informasi dari dokumen yang relevan:"]
        for c in chunks:
            lines.append(f"[{c['filename']}] {c['content']}")
        return "\n\n".join(lines)
```

---

### Step 3.3 — rag/watcher.py
**Estimasi**: 1–2 jam

**Tujuan**: Auto-watch folder `documents/`, otomatis index file baru.

```python
# rag/watcher.py

import time
import threading
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

WATCH_DIR    = Path("C:/DamzAgent/rag/documents")
SUPPORTED    = {".pdf", ".txt", ".docx"}

class DocumentWatcher:
    def __init__(self, ingestor):
        self.ingestor = ingestor
        self.observer = Observer()

    def start(self):
        WATCH_DIR.mkdir(exist_ok=True)
        handler = _Handler(self.ingestor)
        self.observer.schedule(handler, str(WATCH_DIR), recursive=False)
        self.observer.start()
        print(f"[RAG] Watching: {WATCH_DIR}")

    def stop(self):
        self.observer.stop()
        self.observer.join()

class _Handler(FileSystemEventHandler):
    def __init__(self, ingestor):
        self.ingestor = ingestor

    def on_created(self, event):
        if not event.is_directory:
            path = Path(event.src_path)
            if path.suffix.lower() in SUPPORTED:
                print(f"[RAG] File baru: {path.name}, mulai indexing...")
                result = self.ingestor.ingest(str(path))
                print(f"[RAG] {path.name}: {result}")

    def on_modified(self, event):
        self.on_created(event)  # Re-index jika file diubah
```

---

### Step 3.4 — Integrasi RAG ke Agent
**Estimasi**: 1–2 jam

Tambahkan RAG sebagai tool di `tools/__init__.py`:

```python
# Di core/agent.py — modifikasi invoke() untuk inject RAG context

def invoke(self, user_input: str) -> str:
    # Ambil konteks RAG dulu
    rag_context = self.retriever.build_context(user_input)

    # Inject ke input jika ada konteks relevan
    augmented_input = user_input
    if rag_context:
        augmented_input = f"{rag_context}\n\nPertanyaan: {user_input}"

    result = self.executor.invoke({
        "input": augmented_input,
        "agent_name": self.config.agent.name,
        "chat_history": self.memory.short.get(),
    })
    answer = result.get("output", "Maaf, saya tidak bisa menjawab.")
    self.memory.short.add(user_input, answer)
    return answer
```

**Milestone Phase 3 selesai jika**:
- [ ] Drop file PDF ke `documents/` → auto-index tanpa perintah manual
- [ ] "Ringkas project_requirements.pdf" → jawaban berdasarkan isi dokumen
- [ ] "Apa deadline MVP?" → agent menjawab dari knowledge base
- [ ] Re-index otomatis saat file diubah
- [ ] `rag/ingestor.py` mendeteksi duplikat via hash (tidak index ulang jika sama)

---

## Rangkuman Semua File yang Dibuat

```
core/
├── config.py           Phase 1.1  — Load/save config.yaml
├── ollama_client.py    Phase 1.2  — Health check, model list, switch
├── tts.py              Phase 1.3  — Piper TTS + queue manager
├── stt.py              Phase 1.4  — Whisper STT + pause/resume
├── wake_word.py        Phase 1.5  — openWakeWord listener
├── agent.py            Phase 2.2  — LangChain ReAct Agent
└── memory.py           Phase 2.1  — Short-term + long-term memory

tools/
├── __init__.py         Phase 2.6  — Register semua tools
├── system_tools.py     Phase 2.3  — App launcher, monitor, reminder, screenshot
├── web_tools.py        Phase 2.4  — Google search, open URL
└── garmentmind_tools.py Phase 2.5  — GarmentMind + HIRIS (opsional)

rag/
├── ingestor.py         Phase 3.1  — PDF/TXT/DOCX → ChromaDB
├── retriever.py        Phase 3.2  — Semantic search → context builder
└── watcher.py          Phase 3.3  — Auto-watch folder documents/

main.py                 Phase 1.6  — Entry point, integrasikan semua
```

---

## Timeline Estimasi

| Phase | Steps | Estimasi |
|---|---|---|
| Phase 1 — Foundation | 1.1 – 1.6 | 1–2 minggu |
| Phase 2 — Intelligence | 2.1 – 2.6 | 1–2 minggu |
| Phase 3 — Knowledge | 3.1 – 3.4 | 1 minggu |
| **Total** | | **3–5 minggu** |

---

## Urutan Install Dependencies

```bash
# Aktifkan venv dulu
cd C:\DamzAgent
venv\Scripts\activate

# Phase 1
pip install pyyaml requests RealtimeSTT faster-whisper
pip install pygame sounddevice soundfile openwakeword

# Phase 2
pip install langchain langchain-community langchain-ollama
pip install psutil pywin32 pyautogui

# Phase 3
pip install chromadb pypdf python-docx watchdog
```

---

*Plan: Backend Implementation — Damz Agent v2.0*  
*core/ + tools/ + rag/ — Full Python Backend*
