# Plan: Settings Screen — Ollama Model Management
**Damz Agent v2.0**  
Status: Draft | Juni 2025

---

## 1. Tujuan Screen Settings

Screen Settings adalah pusat kendali konfigurasi Damz Agent yang dapat diubah secara real-time tanpa restart. Fokus utama: manajemen koneksi Ollama, pemilihan model, dan dynamic switching.

---

## 2. Layout & Sections

Settings dibagi menjadi **4 section** dalam satu halaman scroll:

```
┌─────────────────────────────────────────────────────┐
│  SETTINGS                                           │
│  SYSTEM CONFIGURATION                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [A] OLLAMA CONNECTION                              │
│      URL input + Port + Test Connection button      │
│      Status indicator (Connected / Failed)          │
│      Remote IP toggle                               │
│                                                     │
│  [B] MODEL SELECTION                                │
│      Dropdown/card model aktif                      │
│      List model ter-install                         │
│      Apply button (dynamic switch tanpa restart)    │
│                                                     │
│  [C] STT / TTS SETTINGS                             │
│      Whisper model size                             │
│      Language, Piper voice                          │
│                                                     │
│  [D] AGENT SETTINGS                                 │
│      Agent name, temperature, memory turns          │
│      Wake word phrase, hotkey                       │
│                                                     │
│  [SAVE CONFIG]  [RESET TO DEFAULT]                  │
└─────────────────────────────────────────────────────┘
```

---

## 3. Section A — Ollama Connection

### 3.1 UI Elements

| Element | Type | Default |
|---|---|---|
| Ollama Host URL | Text input | `http://localhost` |
| Port | Number input | `11434` |
| Remote Mode toggle | Toggle ON/OFF | OFF |
| Remote IP input | Text input (muncul jika Remote ON) | kosong |
| Test Connection button | Button | — |
| Connection status | Badge indicator | — |

### 3.2 Behavior — Test Connection

Saat tombol **Test Connection** diklik:

```
1. Disable tombol + tampilkan spinner "Testing..."
2. Fetch GET ke {host}:{port}
3. Jika sukses (200):
   - Badge hijau "CONNECTED"
   - Tampilkan: Ollama version, model count
4. Jika gagal (timeout/error):
   - Badge merah "FAILED"
   - Tampilkan pesan error spesifik:
     * "Connection refused" → Ollama tidak jalan
     * "Network error" → IP salah / tidak terjangkau
     * "Timeout" → Server lambat / firewall
5. Re-enable tombol
```

### 3.3 Behavior — Remote Mode

```
Remote Mode OFF:
  - Host terkunci ke "http://localhost"
  - Hanya port yang bisa diedit

Remote Mode ON:
  - Muncul input "Remote IP"
  - Host = "http://{remote_ip}"
  - Tampilkan catatan: "Pastikan OLLAMA_HOST=0.0.0.0 di server"
```

### 3.4 Code — health check function

```python
# core/ollama_client.py

import requests

def test_ollama_connection(base_url: str, timeout: int = 5) -> dict:
    """
    Test koneksi ke Ollama server.
    Returns: { success, version, model_count, error }
    """
    try:
        r = requests.get(base_url, timeout=timeout)
        if r.status_code == 200:
            # Ambil info tambahan
            models_r = requests.get(f"{base_url}/api/tags", timeout=timeout)
            models = models_r.json().get("models", []) if models_r.ok else []
            return {
                "success": True,
                "version": r.headers.get("x-ollama-version", "unknown"),
                "model_count": len(models),
                "error": None
            }
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Connection refused — pastikan Ollama berjalan"}
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Timeout — server tidak merespons"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## 4. Section B — Model Selection

### 4.1 UI Elements

| Element | Type | Keterangan |
|---|---|---|
| Active Model card | Card highlight | Model yang sedang dipakai |
| Model list | Card grid | Semua model ter-install di Ollama |
| Model badge | Badge | Tag: ACTIVE / FAST / SMART / VISION |
| Apply Model button | Button primary | Trigger dynamic switch |
| Refresh List button | Button secondary | Re-fetch dari Ollama API |
| Switch status | Toast notification | "Model switched to mistral:7b" |

### 4.2 Model Card Info

Setiap model card menampilkan:
```
┌─────────────────────────────┐
│ [ACTIVE]                    │
│ llama3.2:3b                 │
│                             │
│ Size   : 2.0 GB             │
│ Family : llama              │
│ VRAM   : ~3 GB              │
│                             │
│ [Select]                    │
└─────────────────────────────┘
```

### 4.3 Behavior — Dynamic Switch (tanpa restart)

```
1. User klik [Select] pada model card
2. Card ter-select di-highlight (border accent)
3. Apply button menjadi aktif
4. User klik [Apply Model]
5. Tampilkan: "Switching model..."
6. Panggil agent_core.switch_model(model_name)
7. Tampilkan toast: "✓ Model switched to {model_name}"
8. Update badge ACTIVE ke model baru
9. Dashboard header ikut update
```

### 4.4 Code — dynamic switch

```python
# core/agent.py

from langchain_ollama import ChatOllama
import yaml, requests

class AgentCore:
    def __init__(self, config_path="config.yaml"):
        with open(config_path) as f:
            self.config = yaml.safe_load(f)
        self.config_path = config_path
        self.llm = self._build_llm()

    def _build_llm(self) -> ChatOllama:
        return ChatOllama(
            model=self.config["llm"]["model"],
            base_url=self.config["llm"]["base_url"],
            temperature=self.config["llm"]["temperature"],
        )

    def switch_model(self, model_name: str) -> dict:
        """
        Ganti model LLM tanpa restart agent.
        Otomatis update config.yaml dan rebuild LLM instance.
        """
        try:
            # Validasi model tersedia di Ollama
            base_url = self.config["llm"]["base_url"]
            r = requests.get(f"{base_url}/api/tags", timeout=5)
            models = [m["name"] for m in r.json().get("models", [])]

            if model_name not in models:
                return {"success": False, "error": f"Model '{model_name}' tidak ditemukan di Ollama"}

            # Update config
            self.config["llm"]["model"] = model_name
            with open(self.config_path, "w") as f:
                yaml.dump(self.config, f, default_flow_style=False)

            # Rebuild LLM instance
            self.llm = self._build_llm()

            return {"success": True, "model": model_name}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_installed_models(self) -> list:
        """Ambil daftar model ter-install dari Ollama API."""
        try:
            base_url = self.config["llm"]["base_url"]
            r = requests.get(f"{base_url}/api/tags", timeout=5)
            return r.json().get("models", [])
        except:
            return []
```

### 4.5 Code — fetch model list untuk UI

```python
# Dipanggil saat Settings screen dibuka atau Refresh diklik

def get_models_for_ui(agent_core: AgentCore) -> list:
    """
    Format model list untuk ditampilkan di UI.
    Returns list of dict dengan info lengkap.
    """
    models = agent_core.get_installed_models()
    current = agent_core.config["llm"]["model"]

    result = []
    for m in models:
        name = m.get("name", "")
        size_bytes = m.get("size", 0)
        size_gb = round(size_bytes / (1024**3), 1)

        # Auto-tag
        tags = []
        if name == current:
            tags.append("ACTIVE")
        if "vision" in name:
            tags.append("VISION")
        if any(x in name for x in ["1b", "3b", "mini"]):
            tags.append("FAST")
        if any(x in name for x in ["7b", "8b", "13b"]):
            tags.append("SMART")

        result.append({
            "name": name,
            "size_gb": size_gb,
            "family": m.get("details", {}).get("family", "—"),
            "tags": tags,
            "is_active": name == current,
        })

    return result
```

---

## 5. Section C — STT / TTS Settings

### 5.1 UI Elements

| Setting | Type | Options |
|---|---|---|
| Whisper Model Size | Dropdown | tiny, base, small, medium |
| STT Language | Dropdown | Bahasa Indonesia, English, Auto |
| TTS Voice | Dropdown | ID - Argana Medium, EN - Ryan High |
| TTS Speed | Slider | 0.75x — 1.5x |
| Test TTS button | Button | Putar sample audio |

---

## 6. Section D — Agent Settings

### 6.1 UI Elements

| Setting | Type | Default |
|---|---|---|
| Agent Name | Text input | Damz |
| LLM Temperature | Slider 0.0–1.0 | 0.7 |
| Memory Max Turns | Number input | 10 |
| Wake Word Phrase | Text input | Halo Damz |
| Wake Word Sensitivity | Slider 0.1–1.0 | 0.5 |
| Hotkey | Key capture input | Ctrl+Space |
| Output Mode | Toggle group | Voice+Text / Text Only / Voice Only |

---

## 7. Save & Reset Behavior

```
[SAVE CONFIG]
  → Tulis semua perubahan ke config.yaml
  → Tampilkan toast: "Configuration saved"
  → Perubahan STT/TTS/Wake Word aktif setelah restart
  → Perubahan Model aktif langsung (dynamic switch)

[RESET TO DEFAULT]
  → Konfirmasi dialog: "Reset semua ke default?"
  → Tulis ulang config.yaml dengan nilai default
  → Reload Settings screen
```

---

## 8. File yang Perlu Dibuat / Dimodifikasi

| File | Action | Keterangan |
|---|---|---|
| `core/ollama_client.py` | CREATE | Health check & model fetch functions |
| `core/agent.py` | MODIFY | Tambah switch_model() & get_installed_models() |
| `ui/screens/settings.py` | CREATE | Settings screen CustomTkinter |
| `config.yaml` | MODIFY | Tambah field baru (tts speed, wake sensitivity) |

---

## 9. Urutan Implementasi

```
Step 1 — core/ollama_client.py
  Buat test_ollama_connection() dan get_installed_models()
  Test manual dari terminal Python

Step 2 — core/agent.py
  Tambah switch_model() dan integrasikan dengan ollama_client
  Test dynamic switch dari terminal

Step 3 — ui/screens/settings.py
  Bangun UI Section A (Connection) + Section B (Model) dulu
  Hubungkan tombol Test & Apply ke fungsi core

Step 4 — Section C & D
  Tambah STT/TTS dan Agent settings
  Hubungkan ke config.yaml

Step 5 — Save & Reset
  Implementasi write ke config.yaml
  Tambah toast notification
```

---

*Plan: Settings Screen — Damz Agent v2.0*  
*Covers: Ollama connection, model selection, dynamic switch, remote IP*
