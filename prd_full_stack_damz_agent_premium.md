# PRD: Damz Agent — Full-Stack Local AI Voice Assistant

## 1. Product Overview
**Damz Agent** is a premium, high-performance AI Voice Assistant for Windows 11. It operates 100% locally, ensuring absolute privacy. The system integrates advanced Speech-to-Text (STT), a Large Language Model (LLM) for reasoning, a Knowledge Base (RAG) for private data retrieval, and natural Text-to-Speech (TTS).

---

## 2. Full-Stack Architecture

### 2.1. Backend (Logic & AI)
- **Orchestration**: `LangChain` (ReAct Agent framework)
- **Inference Engine**: `Ollama` (Llama 3.2:3b or Mistral:7b)
- **STT (Speech-to-Text)**: `Faster-Whisper` via `RealtimeSTT`
- **TTS (Text-to-Speech)**: `Piper TTS` (Fast, natural, local)
- **RAG (Knowledge Base)**: `ChromaDB` (Vector Database) + `Nomic Embed Text` (Embeddings)
- **Wake Word**: `Picovoice Porcupine` ("Halo Damz")

### 2.2. Frontend (UI/UX)
- **Visual Language**: Obsidian Sentinel (High-fidelity Dark Mode)
- **Key Screens**: 
    - Dashboard (Real-time monitoring)
    - Interactive Chat (Multi-modal enabled)
    - Knowledge Base (RAG management)
    - Vision (Local image analysis)
    - Tools Configuration (Modular system hooks)
    - System Logs (Terminal aesthetic)
- **Framework Opsi**: Tkinter (Native) or Custom Modern Python UI Wrapper

---

## 3. Technical Requirements

### 3.1. Hardware Specifications
- **RAM**: 16GB (Recommended)
- **GPU**: NVIDIA with 4GB+ VRAM (CUDA enabled for STT/LLM acceleration)
- **OS**: Windows 11

### 3.2. Core Dependencies
```bash
pip install RealtimeSTT faster-whisper langchain langchain-community langchain-ollama chromadb pvporcupine pygame sounddevice psutil
```

---

## 4. Feature Specifications

### 4.1. Voice Interaction ("Halo Damz")
- Continuous background listening with low CPU overhead.
- Automatic transition from Wake Word detection to full STT transcription.
- Language: Bahasa Indonesia (Primary) & English.

### 4.2. Knowledge Base (RAG)
- Supports PDF, TXT, and DOCX ingestion.
- Local vector indexing via ChromaDB.
- Semantic search allows Damz to answer questions based on private user documents.

### 4.3. Vision (Multi-modal)
- Local image analysis using multi-modal LLMs (e.g., Llama 3.2 Vision).
- OCR capabilities to extract text from screenshots.
- Privacy-first: All analysis stays on-device.

### 4.4. System Tools
- **App Launcher**: Open Notepad, Chrome, VS Code, etc.
- **System Monitor**: Real-time CPU, RAM, and Disk telemetry.
- **Automation**: Google Search automation and local reminders.

---

## 5. Security & Privacy
- **Zero Cloud Leakage**: No voice data or documents are sent to external APIs.
- **Local Persistence**: All logs and model data are stored in `/users/admin/.ollama` and `/var/log/damz`.

---

## 6. Implementation Roadmap
1. **Phase 1 (Core)**: Setup Ollama, Whisper, and Piper integration.
2. **Phase 2 (Intelligence)**: Implement LangChain ReAct Agent and Tools.
3. **Phase 3 (Knowledge)**: Integrate ChromaDB for RAG functionality.
4. **Phase 4 (Visual)**: Build the High-Fidelity GUI and Vision module.
5. **Phase 5 (Activation)**: Fine-tune Wake Word for Bahasa Indonesia.