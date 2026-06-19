# PRD: Multi-Agent Hybrid Orchestration
**Damz Agent — Extension Module v1.0**

**Version**: 1.1  
**Status**: Draft  
**Last Updated**: Juni 2026  
**Author**: Damz  
**Depends on**: Damz Agent v2.0 (PRD utama)

> 🔄 **Changelog v1.1**: Update nama model DeepSeek dari `deepseek-v3.2` (usang) ke `deepseek-v4-flash` sesuai lini model terbaru per April 2026. Tambah detail harga cache-hit/cache-miss, catatan deprecation alias model lama (24 Juli 2026), dan langkah pendaftaran API key per provider.

---

## 1. Product Overview

Modul ini memperluas Damz Agent dari **single-agent serba bisa** menjadi **sistem multi-agent terspesialisasi**, dengan kemampuan routing otomatis ke agent yang tepat berdasarkan jenis permintaan, dan dukungan **hybrid model** — kombinasi LLM lokal (Ollama, gratis & privat) dan LLM API berbayar (untuk tugas yang butuh kualitas lebih tinggi atau akses real-time).

### 1.1. Masalah yang Diselesaikan

Single-agent dengan satu system prompt generik punya keterbatasan:
- Kualitas jawaban tidak konsisten — sama baiknya untuk riset dan jadwal, padahal beda kebutuhan
- Tidak efisien — model besar dipakai untuk tugas simpel, model kecil dipaksa untuk tugas kompleks
- Sulit dikembangkan — menambah kemampuan baru berarti mengubah satu prompt besar untuk semua

### 1.2. Tujuan

- Setiap agent punya spesialisasi: prompt, tools, dan model yang dioptimalkan untuk tugasnya
- Routing otomatis — user tidak perlu tahu agent mana yang dipakai
- Cost-aware — agent sensitif privasi tetap lokal (gratis), agent yang butuh kualitas/akses internet pakai API murah
- Tetap konsisten dengan prinsip privacy-first dari Damz Agent v2.0 — hybrid bukan default-cloud

---

## 2. Arsitektur

### 2.1. Diagram Sistem

```
                         User Input (voice/text)
                                │
                                ▼
                    ┌───────────────────────┐
                    │   ORCHESTRATOR        │
                    │   (Intent Classifier) │
                    └───────────┬───────────┘
                                │
        ┌───────────┬───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
   │Agent-A  │ │Agent-B  │ │Agent-C  │ │Agent-D  │ │ (custom)│
   │Riset    │ │Penjawab │ │Schedule │ │Design   │ │  ...    │
   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
   DeepSeek V4 Flash  Ollama     Ollama    Claude Haiku   (configurable)
   (API)          (lokal)    (lokal)   (API)
        │           │           │           │
        └───────────┴─────┬─────┴───────────┘
                           ▼
                  ┌──────────────────┐
                  │  Shared Memory    │
                  │  (SQLite + RAG)   │
                  └──────────────────┘
                           │
                           ▼
                    Jawaban ke User
```

### 2.2. Komponen Baru

| Komponen | Fungsi | Lokasi File |
|---|---|---|
| Orchestrator | Klasifikasi intent, routing ke agent | `core/orchestrator.py` |
| Agent Registry | Daftar semua agent + konfigurasinya | `core/agent_registry.py` |
| Model Router | Pilih backend (Ollama lokal / API cloud) | `core/model_router.py` |
| API Clients | Koneksi ke provider eksternal | `core/providers/` |
| Cost Tracker | Hitung & log biaya token API | `core/cost_tracker.py` |
| Shared Memory | Memory yang diakses semua agent | `core/shared_memory.py` |

---

## 3. Spesifikasi Agent

### 3.1. Agent-A — Riset

| Atribut | Nilai |
|---|---|
| Nama | Agent Riset |
| Tugas | Cari informasi web, ringkas, sintesis dari berbagai sumber |
| Model default | DeepSeek V4 Flash (API) |
| Model fallback | `mistral:7b` (lokal, jika API gagal/limit) |
| Tools | `search_web`, `web_fetch`, `summarize_url` |
| Trigger keywords | "cari", "riset", "apa kabar terbaru", "tren", "berita" |
| System prompt fokus | Objektif, sitasi sumber, ringkas multi-sumber |

### 3.2. Agent-B — Penjawab

| Atribut | Nilai |
|---|---|
| Nama | Agent Penjawab |
| Tugas | Chat umum, Q&A cepat, percakapan sehari-hari |
| Model default | `llama3.2:3b` (lokal) |
| Model fallback | Gemini Flash-Lite (API, jika butuh kualitas lebih) |
| Tools | `get_current_time`, `get_system_info`, `rag_query` |
| Trigger keywords | default / fallback jika tidak match agent lain |
| System prompt fokus | Ramah, singkat, percakapan natural |

### 3.3. Agent-C — Schedule

| Atribut | Nilai |
|---|---|
| Nama | Agent Schedule |
| Tugas | Reminder, jadwal, manajemen waktu |
| Model default | `llama3.2:3b` (lokal) |
| Model fallback | tidak perlu — tugas terstruktur, model kecil cukup |
| Tools | `set_reminder`, `create_event`, `list_reminders`, `cancel_reminder` |
| Trigger keywords | "ingatkan", "jadwal", "kapan", "atur waktu", "reminder" |
| System prompt fokus | Ekstraksi waktu & tugas presisi, format terstruktur |

### 3.4. Agent-D — Design

| Atribut | Nilai |
|---|---|
| Nama | Agent Design |
| Tugas | Brainstorming ide kreatif, konsep visual, copywriting |
| Model default | Claude Haiku 4.5 (API) |
| Model fallback | `mistral:7b` (lokal) |
| Tools | `image_search_reference`, `save_idea_to_notes` |
| Trigger keywords | "desain", "ide", "konsep", "buatkan caption", "kreatif" |
| System prompt fokus | Kreatif, banyak opsi, gaya bahasa hidup |

### 3.5. Menambah Agent Baru (Extensible)

Setiap agent didefinisikan sebagai entry di `agent_registry.py` — menambah agent baru tidak perlu mengubah orchestrator:

```yaml
# config_agents.yaml
agents:
  - id: research_agent
    name: "Agent Riset"
    model_provider: "deepseek"
    model_name: "deepseek-v4-flash"
    fallback_provider: "ollama"
    fallback_model: "mistral:7b"
    tools: [search_web, web_fetch, summarize_url]
    trigger_keywords: [cari, riset, tren, berita, "apa kabar terbaru"]
    system_prompt: |
      Kamu adalah Agent Riset Damz. Tugasmu mencari, memverifikasi,
      dan meringkas informasi dari web secara objektif...

  - id: answer_agent
    name: "Agent Penjawab"
    model_provider: "ollama"
    model_name: "llama3.2:3b"
    fallback_provider: "gemini"
    fallback_model: "gemini-3.1-flash-lite"
    tools: [get_current_time, get_system_info, rag_query]
    trigger_keywords: []   # default agent
    is_default: true
    system_prompt: |
      Kamu adalah Agent Penjawab Damz...

  - id: schedule_agent
    name: "Agent Schedule"
    model_provider: "ollama"
    model_name: "llama3.2:3b"
    tools: [set_reminder, create_event, list_reminders]
    trigger_keywords: [ingatkan, jadwal, kapan, reminder]
    system_prompt: |
      Kamu adalah Agent Schedule Damz...

  - id: design_agent
    name: "Agent Design"
    model_provider: "anthropic"
    model_name: "claude-haiku-4.5"
    fallback_provider: "ollama"
    fallback_model: "mistral:7b"
    tools: [image_search_reference, save_idea_to_notes]
    trigger_keywords: [desain, ide, konsep, kreatif, caption]
    system_prompt: |
      Kamu adalah Agent Design Damz...
```

---

## 4. Orchestrator — Intent Routing

### 4.1. Strategi Routing (2 Lapis)

**Lapis 1 — Keyword Matching (cepat, gratis)**
```python
def route_by_keyword(user_input: str, agents: list) -> str | None:
    text = user_input.lower()
    for agent in agents:
        if agent.is_default:
            continue
        if any(kw in text for kw in agent.trigger_keywords):
            return agent.id
    return None  # tidak match, lanjut ke Lapis 2
```

**Lapis 2 — LLM Classifier (fallback, jika keyword tidak match)**
```python
CLASSIFY_PROMPT = """
Klasifikasikan permintaan berikut ke salah satu kategori:
- research: mencari informasi, riset, tren
- schedule: jadwal, reminder, waktu
- design: ide kreatif, desain, copywriting
- general: percakapan umum, pertanyaan biasa

Permintaan: "{input}"
Kategori (satu kata saja):
"""

def route_by_llm(user_input: str, classifier_llm) -> str:
    result = classifier_llm.invoke(CLASSIFY_PROMPT.format(input=user_input))
    category = result.content.strip().lower()
    return CATEGORY_TO_AGENT.get(category, "answer_agent")
```

> **Catatan performa**: Lapis 2 pakai model lokal kecil (`llama3.2:1b` atau `phi3:mini`) khusus untuk klasifikasi — cepat dan tidak menambah biaya API.

### 4.2. Alur Lengkap

```
1. User input masuk
2. Orchestrator cek Lapis 1 (keyword match)
   ├── Match → langsung ke agent tsb
   └── Tidak match → Lapis 2 (LLM classifier lokal)
3. Agent terpilih dipanggil dengan:
   - System prompt khusus agent
   - Tools khusus agent
   - Model sesuai konfigurasi (lokal/API)
4. Model Router cek apakah perlu fallback
   (API gagal / limit / API key kosong → pakai fallback)
5. Agent proses → jawaban
6. Simpan ke Shared Memory (semua agent bisa akses histori ini)
7. Jawaban dikirim ke user (TTS/text)
```

---

## 5. Model Router — Hybrid Lokal/API

### 5.1. Tujuan

Abstraksi satu layer di atas semua provider (Ollama, DeepSeek, Gemini, Anthropic) sehingga agent tidak perlu tahu detail tiap API.

### 5.2. Provider yang Didukung

| Provider | Tipe | Model Contoh | Catatan |
|---|---|---|---|
| Ollama | Lokal | llama3.2:3b, mistral:7b | Gratis, privat, butuh server lokal/remote |
| DeepSeek | API | deepseek-v4-flash | $0.14 input (cache-miss) / $0.28 output per 1M token; $0.0028 jika cache-hit |
| Gemini | API | gemini-3.1-flash-lite | $0.10/$0.40 per 1M token |
| Anthropic | API | claude-haiku-4.5 | $1/$5 per 1M token |

> ⚠️ **Catatan deprecation DeepSeek**: nama model lama `deepseek-chat` dan `deepseek-reasoner` akan pensiun total **24 Juli 2026**. Gunakan nama model eksplisit `deepseek-v4-flash` (ekonomis, default) atau `deepseek-v4-pro` (lebih kuat, sedang diskon 75% s.d. 31 Mei 2026: $0.435 input/$0.87 output per 1M token).

### 5.3. Cara Mendapatkan API Key

**Gemini (Google AI Studio)**:
1. Buka `aistudio.google.com`, login dengan akun Google
2. Buka halaman **API Keys** → klik **Create Key** (tanpa kartu kredit untuk tier gratis)
3. Copy key (format `AIza...`)
4. Pastikan key berstatus "Auth key" / dibatasi ke Gemini API — sejak 19 Juni 2026, key "Standard" yang tidak dibatasi otomatis ditolak

**DeepSeek (DeepSeek Platform)**:
1. Buka `platform.deepseek.com`, daftar dengan email, verifikasi
2. Buka dashboard → menu **API Keys** → buat key baru dengan label jelas
3. Isi saldo (top-up) jika diperlukan untuk pemakaian produksi
4. Gunakan nama model eksplisit `deepseek-v4-flash` — alias lama `deepseek-chat`/`deepseek-reasoner` pensiun 24 Juli 2026

**Anthropic (Claude Console)**:
1. Buka `console.anthropic.com`, daftar/login
2. Buka menu **API Keys** → **Create Key**
3. Top-up saldo prabayar minimum sesuai ketentuan console

### 5.4. Konfigurasi API Keys

```yaml
# config_agents.yaml — tambahan section
api_keys:
  deepseek: "${DEEPSEEK_API_KEY}"      # dari .env, jangan hardcode
  gemini: "${GEMINI_API_KEY}"
  anthropic: "${ANTHROPIC_API_KEY}"
```

```bash
# .env
DEEPSEEK_API_KEY=sk-xxxxxxxx
GEMINI_API_KEY=AIzaxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
```

> **Keamanan**: API key tidak pernah ditulis ke `config.yaml` langsung, tidak pernah dipanggil dari frontend/browser, dan selalu lewat `.env` yang di-gitignore. Semua request API harus melalui backend Damz Agent, bukan langsung dari UI.

### 5.5. Fallback Logic

```python
class ModelRouter:
    def invoke(self, agent_config, prompt: str) -> str:
        primary = self._get_client(agent_config.model_provider)
        try:
            return primary.invoke(prompt, agent_config.model_name)
        except (APIKeyMissing, RateLimitError, ConnectionError) as e:
            if agent_config.fallback_provider:
                log.warning(f"Primary gagal ({e}), pakai fallback")
                fallback = self._get_client(agent_config.fallback_provider)
                return fallback.invoke(prompt, agent_config.fallback_model)
            raise
```

**Skenario fallback otomatis**:
- API key tidak diset → langsung pakai fallback lokal
- Rate limit tercapai → fallback lokal
- Tidak ada koneksi internet → fallback lokal
- Server Ollama remote tidak terjangkau → fallback ke model API jika ada, atau error message

---

## 6. Cost Tracking

### 6.1. Tujuan

Karena ada model berbayar, perlu visibility biaya supaya tidak kebablasan.

### 6.2. Data yang Dilacak

```python
# core/cost_tracker.py

@dataclass
class UsageRecord:
    agent_id: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    timestamp: datetime
```

### 6.3. Storage

Tabel baru di SQLite yang sama dengan memory:

```sql
CREATE TABLE IF NOT EXISTS api_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT,
    provider TEXT,
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd REAL,
    timestamp TEXT
);
```

### 6.4. Harga per Provider (untuk kalkulasi, update berkala)

| Provider/Model | Input ($/1M token) | Output ($/1M token) |
|---|---|---|
| DeepSeek V4 Flash (cache-miss) | 0.14 | 0.28 |
| DeepSeek V4 Flash (cache-hit) | 0.0028 | — |
| DeepSeek V4 Pro (diskon s.d. 31 Mei 2026) | 0.435 | 0.87 |
| Gemini 3.1 Flash-Lite | 0.10 | 0.40 |
| Claude Haiku 4.5 | 1.00 | 5.00 |
| Ollama (lokal) | 0 | 0 |

> ⚠️ Harga berubah — sebelum production, verifikasi ulang ke halaman pricing resmi tiap provider.

### 6.5. UI — Dashboard Cost Widget

Tambahan card baru di Dashboard:

```
┌─────────────────────────┐
│ API COST (BULAN INI)    │
│                         │
│  $2.34                 │
│  ESTIMATED              │
│                         │
│  Riset:    $1.80        │
│  Design:   $0.54        │
│  Penjawab: $0.00 (lokal)│
│  Schedule: $0.00 (lokal)│
└─────────────────────────┘
```

### 6.6. Budget Limit (Opsional, Direkomendasikan)

```yaml
# config_agents.yaml
budget:
  monthly_limit_usd: 10.00
  alert_threshold_pct: 80      # peringatan di 80% budget
  action_on_exceed: "fallback_to_local"   # atau "block"
```

---

## 7. Shared Memory Antar Agent

### 7.1. Masalah

Jika tiap agent punya memory terpisah, user harus mengulang konteks saat pindah agent (misal: riset dulu, lalu minta dijadwalkan berdasarkan hasil riset).

### 7.2. Solusi

Satu **Shared Memory** yang bisa diakses semua agent, dengan tagging agent asal:

```python
# core/shared_memory.py

class SharedMemory:
    def __init__(self, db_path: str):
        self.db = sqlite3.connect(db_path, check_same_thread=False)

    def add_turn(self, agent_id: str, user_input: str, agent_output: str):
        """Simpan giliran percakapan, tag dengan agent yang menjawab."""
        ...

    def get_recent_context(self, limit: int = 10) -> list[dict]:
        """
        Ambil histori lintas-agent terbaru.
        Berguna untuk continuity: Agent-C bisa tahu apa yang
        baru saja dibahas Agent-A.
        """
        ...

    def get_agent_specific(self, agent_id: str, limit: int = 10) -> list[dict]:
        """Histori khusus satu agent saja."""
        ...
```

### 7.3. Contoh Skenario Continuity

```
User → Agent-A (Riset): "Cari tren konten TikTok minggu ini"
Agent-A: [hasil riset 3 tren]

User → Agent-C (Schedule): "Jadwalkan posting untuk tren nomor 2 besok jam 10"
Agent-C: [baca shared memory, tahu konteks "tren nomor 2" dari Agent-A]
         "Baik, saya jadwalkan posting tentang [tren #2] besok 10:00"
```

---

## 8. UI Changes — Dashboard & Chat

### 8.1. Dashboard — Agent Status Multi-Card

```
┌──────────────────────────────────────────────────────┐
│ ACTIVE AGENTS                                         │
├──────────────┬──────────────┬──────────────┬─────────┤
│ 🔍 Riset     │ 💬 Penjawab  │ 📅 Schedule  │ 🎨 Design│
│ DeepSeek V4 Flash│ Llama3.2:3b  │ Llama3.2:3b  │ Haiku4.5│
│ ● API        │ ● Lokal      │ ● Lokal      │ ● API   │
│ 12 calls     │ 89 calls     │ 23 calls     │ 7 calls │
└──────────────┴──────────────┴──────────────┴─────────┘
```

### 8.2. Chat — Agent Badge per Pesan

```
>_ Cari tren konten TikTok minggu ini

┌────────────────────────────────────┐
│ [🔍 AGENT RISET · DeepSeek V4 Flash]    │
│                                    │
│ Saya menemukan 3 tren utama...    │
│                                    │
│ 16:15:34 · 2100ms · $0.002         │
└────────────────────────────────────┘
```

Setiap respons menampilkan **badge agent + model + estimasi biaya** (jika API) supaya user tahu siapa yang menjawab dan berapa biayanya.

### 8.3. Settings — Section Baru: Agent & Provider

```
▼ AGENT CONFIGURATION
──────────────────────────────────
[Agent Riset]      Model: DeepSeek V4 Flash ▾    [Edit Prompt]
[Agent Penjawab]   Model: Llama3.2:3b ▾      [Edit Prompt]
[Agent Schedule]   Model: Llama3.2:3b ▾      [Edit Prompt]
[Agent Design]     Model: Claude Haiku ▾     [Edit Prompt]
                                   [+ Add New Agent]

▼ API PROVIDERS
──────────────────────────────────
DeepSeek    [●●●●●●●●●●] Connected    [Test]
Gemini      [          ] Not configured [Add Key]
Anthropic   [●●●●●●●●●●] Connected    [Test]

▼ BUDGET CONTROL
──────────────────────────────────
Monthly Limit: [$10.00        ]
Current Usage: $2.34 (23%)
[████░░░░░░░░░░░░░░░░] 23%
Alert at: [80%        ]
On exceed: ( ) Block  (●) Fallback to local
```

---

## 9. File Structure (Tambahan dari Backend Plan)

```
core/
├── orchestrator.py          NEW — Routing logic (keyword + LLM classifier)
├── agent_registry.py        NEW — Load & manage agent configs
├── model_router.py          NEW — Abstraksi provider + fallback logic
├── cost_tracker.py          NEW — Log & hitung biaya API
├── shared_memory.py         NEW — Memory lintas agent
│
└── providers/
    ├── __init__.py          NEW
    ├── base.py               NEW — Interface umum semua provider
    ├── ollama_provider.py    NEW — Wrapper Ollama (reuse ollama_client.py)
    ├── deepseek_provider.py  NEW — DeepSeek API client
    ├── gemini_provider.py    NEW — Gemini API client
    └── anthropic_provider.py NEW — Anthropic API client

config_agents.yaml            NEW — Definisi semua agent
.env                          NEW — API keys (gitignored)
```

---

## 10. Implementation Roadmap

### Phase 1 — Single Provider Abstraction (3-4 hari)
- [ ] `core/providers/base.py` — interface umum
- [ ] `core/providers/ollama_provider.py` — wrap existing ollama_client
- [ ] `core/model_router.py` — routing dasar tanpa fallback dulu
- [ ] Test: 1 agent bisa pakai provider abstraction

### Phase 2 — Multi-Agent Registry (2-3 hari)
- [ ] `config_agents.yaml` schema + loader
- [ ] `core/agent_registry.py`
- [ ] Refactor `core/agent.py` jadi instantiable per agent config
- [ ] Test: 4 agent terdaftar dengan system prompt berbeda

### Phase 3 — Orchestrator Routing (2-3 hari)
- [ ] `core/orchestrator.py` — Lapis 1 keyword matching
- [ ] Lapis 2 LLM classifier (pakai model lokal kecil)
- [ ] Test: input random ter-route ke agent yang benar >85% akurasi

### Phase 4 — API Providers Berbayar (3-4 hari)
- [ ] `deepseek_provider.py`
- [ ] `gemini_provider.py`
- [ ] `anthropic_provider.py`
- [ ] Fallback logic di `model_router.py`
- [ ] Test: matikan internet → otomatis fallback ke lokal

### Phase 5 — Cost Tracking (1-2 hari)
- [ ] `core/cost_tracker.py`
- [ ] Tabel `api_usage` di SQLite
- [ ] Budget limit + alert logic

### Phase 6 — Shared Memory (1-2 hari)
- [ ] `core/shared_memory.py`
- [ ] Integrasi ke semua agent
- [ ] Test: continuity antar agent (skenario riset → schedule)

### Phase 7 — UI Integration (3-4 hari)
- [ ] Dashboard: Active Agents card
- [ ] Chat: agent badge per pesan
- [ ] Settings: Agent Configuration section
- [ ] Settings: API Providers section
- [ ] Settings: Budget Control section

**Total estimasi**: 3-4 minggu

---

## 11. Testing Checklist

- [ ] Keyword routing akurat untuk kalimat jelas ("ingatkan saya..." → Agent Schedule)
- [ ] LLM classifier fallback bekerja untuk kalimat ambigu
- [ ] Setiap agent menjawab dengan system prompt yang sesuai (tidak tercampur)
- [ ] Fallback lokal aktif otomatis saat API key kosong
- [ ] Fallback lokal aktif otomatis saat tidak ada internet
- [ ] Cost tracker mencatat token & biaya dengan akurat
- [ ] Budget limit memicu alert di 80%
- [ ] Budget exceed memicu fallback (bukan block, sesuai default config)
- [ ] Shared memory: Agent-C bisa mengakses konteks dari Agent-A
- [ ] UI menampilkan agent badge + model + cost per respons
- [ ] Settings bisa tambah agent baru tanpa edit kode

---

## 12. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| API key bocor jika ter-commit ke git | `.env` di `.gitignore`, validasi sebelum commit |
| Biaya API membengkak tanpa sadar | Budget limit + alert + fallback otomatis |
| Routing salah ke agent yang tidak tepat | Lapis 2 LLM classifier sebagai fallback keyword |
| Provider API down | Fallback ke Ollama lokal otomatis |
| Privacy — data riset terkirim ke API eksternal | Hanya Agent-A (Riset) yang default ke API, karena memang butuh akses web; agent lain tetap lokal by default |

---

*PRD: Multi-Agent Hybrid Orchestration — Damz Agent Extension v1.1*  
*Dikembangkan di atas: Damz Agent v2.0 (PRD utama)*
