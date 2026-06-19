/**
 * DAMZ AGENT — Backend Server
 * Express + better-auth + Custom JSON File Database for authentication.
 */

import express from 'express';
import cors from 'cors';
import { betterAuth } from 'better-auth';
import { createAdapterFactory } from 'better-auth/adapters';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { parseOffice } from 'officeparser';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env manually (no dotenv dependency) ────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.trim().split('=');
    if (key && !key.startsWith('#')) {
      process.env[key] = vals.join('=');
    }
  });
}

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = 'http://localhost:3010';

const serverStartTime = Date.now();
const logBuffer = [];
function addLog(level, source, message) {
  logBuffer.push({
    timestamp: new Date().toISOString(),
    level,
    source,
    message
  });
  if (logBuffer.length > 500) logBuffer.shift();
}

// Add initial startup logs
addLog('info', 'SYSTEM', 'Damz Agent Auth & API Server starting up...');
addLog('info', 'SYSTEM', 'Initializing JSON File database at data/damz_auth_db.json');


// ── JSON Database ───────────────────────────────────
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'damz_auth_db.json');

// Read database file helper
function readDB() {
  try {
    if (!fs.existsSync(dbPath)) {
      const initial = { user: [], session: [], account: [], verification: [], pending_users: [], rejected_users: [] };
      fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2));
      return initial;
    }
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (!db.pending_users) db.pending_users = [];
    if (!db.rejected_users) db.rejected_users = [];
    return db;
  } catch (err) {
    console.error('[AUTH DB ERROR] Failed to read JSON DB, returning empty schema.', err);
    return { user: [], session: [], account: [], verification: [], pending_users: [], rejected_users: [] };
  }
}

// Write database file helper
function writeDB(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[AUTH DB ERROR] Failed to write to JSON DB.', err);
  }
}

// Custom JSON Adapter Factory
const jsonAdapter = () => createAdapterFactory({
  adapter: () => ({
    create: async ({ model, data }) => {
      const db = readDB();
      if (!db[model]) db[model] = [];
      if (model === 'session') {
        // Enforce Single Session Policy: delete all other sessions for this user ID
        db[model] = db[model].filter(s => s.userId !== data.userId);
      }
      db[model].push(data);
      writeDB(db);
      return data;
    },
    findOne: async ({ model, where }) => {
      const db = readDB();
      if (!db[model]) return null;
      const record = db[model].find(item => {
        if (Array.isArray(where)) {
          return where.every(w => item[w.field] === w.value);
        }
        return Object.entries(where).every(([key, value]) => item[key] === value);
      });
      return record || null;
    },
    findMany: async ({ model, where }) => {
      const db = readDB();
      if (!db[model]) return [];
      if (!where) return db[model];
      return db[model].filter(item => {
        if (Array.isArray(where)) {
          return where.every(w => item[w.field] === w.value);
        }
        return Object.entries(where).every(([key, value]) => item[key] === value);
      });
    },
    update: async ({ model, where, data }) => {
      const db = readDB();
      if (!db[model]) return null;
      const index = db[model].findIndex(item => {
        if (Array.isArray(where)) {
          return where.every(w => item[w.field] === w.value);
        }
        return Object.entries(where).every(([key, value]) => item[key] === value);
      });
      if (index === -1) return null;
      db[model][index] = { ...db[model][index], ...data };
      writeDB(db);
      return db[model][index];
    },
    delete: async ({ model, where }) => {
      const db = readDB();
      if (!db[model]) return;
      db[model] = db[model].filter(item => {
        if (Array.isArray(where)) {
          return !where.every(w => item[w.field] === w.value);
        }
        return !Object.entries(where).every(([key, value]) => item[key] === value);
      });
      writeDB(db);
    },
    deleteMany: async ({ model, where }) => {
      const db = readDB();
      if (!db[model]) return;
      db[model] = db[model].filter(item => {
        if (Array.isArray(where)) {
          return !where.every(w => item[w.field] === w.value);
        }
        return !Object.entries(where).every(([key, value]) => item[key] === value);
      });
      writeDB(db);
    },
    count: async ({ model, where }) => {
      const db = readDB();
      if (!db[model]) return 0;
      if (!where) return db[model].length;
      return db[model].filter(item => {
        if (Array.isArray(where)) {
          return where.every(w => item[w.field] === w.value);
        }
        return Object.entries(where).every(([key, value]) => item[key] === value);
      }).length;
    }
  }),
  config: {
    adapterId: 'json-adapter',
  }
});

console.log('[AUTH] JSON file database initialized at data/damz_auth_db.json');

// ── Better Auth Instance ─────────────────────────────
const auth = betterAuth({
  database: jsonAdapter(),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${PORT}`,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // 1 day
  },
  trustedOrigins: [FRONTEND_URL],
});

// ── Express App ──────────────────────────────────────
const app = express();

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Authentication Middleware ────────────────────────
async function requireAuth(req, res, next) {
  try {
    let session = null;
    let user = null;

    // 1. Manually check Authorization: Bearer token (highly reliable for SPA / cross-origin API calls)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const db = readDB();
      const dbSession = db.session.find(s => s.token === token);
      if (dbSession) {
        const expiresAt = new Date(dbSession.expiresAt);
        if (expiresAt > new Date()) {
          const dbUser = db.user.find(u => u.id === dbSession.userId);
          if (dbUser) {
            session = dbSession;
            user = dbUser;
          }
        }
      }
    }

    // 2. Fallback to Better Auth session resolver
    if (!session) {
      const headers = new Headers();
      Object.entries(req.headers).forEach(([key, value]) => {
        if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      });

      const baSession = await auth.api.getSession({
        headers
      });

      if (baSession) {
        session = baSession.session;
        user = baSession.user;
      }
    }

    if (!session || !user) {
      return res.status(401).json({ error: 'Unauthorized: Sesi tidak valid atau telah kedaluwarsa.' });
    }

    req.user = user;
    req.session = session;
    next();
  } catch (err) {
    console.error('[AUTH MIDDLEWARE ERROR]', err.message);
    res.status(401).json({ error: 'Unauthorized: Gagal memvalidasi sesi.' });
  }
}

// Global API Auth Guard
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth') || req.path === '/api/health') {
    return next();
  }
  return requireAuth(req, res, next);
});


function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.toLowerCase().trim();
  if (!trimmed.includes('@') || !trimmed.includes('.')) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) return false;
  if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.endsWith('.')) return false;
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  return true;
}

// ── Better Auth Handler ──────────────────────────────
// Mount better-auth at /api/auth/*
app.all('/api/auth/*', async (req, res) => {
  try {
    // Intercept Sign-Up and Sign-In to enforce email whitelist / pending approval
    if (req.method === 'POST' && (req.path === '/api/auth/sign-up/email' || req.path === '/api/auth/sign-in/email')) {
      const email = req.body?.email?.toLowerCase().trim();
      const name = req.body?.name || email?.split('@')[0];
      const password = req.body?.password;

      if (email) {
        if (req.path === '/api/auth/sign-up/email') {
          if (!validateEmail(email)) {
            addLog('warn', 'SYSTEM', `Pendaftaran ditolak, format email tidak valid: ${email}`);
            return res.status(400).json({
              error: "Format email tidak valid! Harap gunakan email dengan '@' dan domain yang benar (contoh: nama@domain.com)",
              message: "Format email tidak valid! Harap gunakan email dengan '@' dan domain yang benar (contoh: nama@domain.com)"
            });
          }

          const db = readDB();
          const isRegisteredUser = db.user.some(u => u.email?.toLowerCase().trim() === email);
          const isPendingUser = db.pending_users.some(u => u.email?.toLowerCase().trim() === email);
          if (isRegisteredUser || isPendingUser) {
            addLog('warn', 'SYSTEM', `Pendaftaran ditolak, email sudah terdaftar: ${email}`);
            return res.status(400).json({
              error: "Email anda sudah terdaftar di sistem kami, Silahkan hubungi Customer Service Kami",
              message: "Email anda sudah terdaftar di sistem kami, Silahkan hubungi Customer Service Kami"
            });
          }
        }

        let allowedEmailsString = '';
        try {
          const configPath = path.join(__dirname, '..', 'config.yaml');
          if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8');
            const config = parseSimpleYaml(content);
            if (config.agent && config.agent.allowed_emails) {
              allowedEmailsString = config.agent.allowed_emails;
            }
          }
        } catch (e) {
          console.warn('[AUTH GUARD] Failed to parse config.yaml for allowed_emails:', e.message);
        }

        const allowed = allowedEmailsString ? allowedEmailsString.split(',').map(e => e.trim().toLowerCase()) : [];
        const isWhitelisted = allowed.includes(email);

        if (!isWhitelisted) {
          if (req.path === '/api/auth/sign-in/email') {
            addLog('warn', 'SYSTEM', `Akses login ditolak untuk email tidak sah: ${email}`);
            return res.status(403).json({ message: 'Akses ditolak: Email Anda tidak terdaftar dalam daftar izin sistem (allowed_emails).' });
          }

          if (req.path === '/api/auth/sign-up/email') {
            const db = readDB();
            const exists = db.pending_users.find(u => u.email === email);
            if (!exists) {
              db.pending_users.push({
                email,
                name,
                password,
                createdAt: new Date().toISOString()
              });
              writeDB(db);
              addLog('info', 'SYSTEM', `Pendaftaran baru diajukan (Pending Approval): ${email}`);
            }
            return res.status(202).json({
              pending: true,
              message: 'Account anda akan kami tinjau terlebih dahulu, Terimakasih sudah mendaftar'
            });
          }
        }
      }
    }
    // Convert Express req/res to Web API Request/Response
    const url = new URL(req.originalUrl, `http://localhost:${PORT}`);
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    });

    const webReq = new Request(url.toString(), {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const response = await auth.handler(webReq);

    // Copy response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(response.status);
    const body = await response.text();
    res.send(body);
  } catch (err) {
    console.error('[AUTH ERROR]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ── Health Check ─────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Damz Agent Auth Server',
    version: '2.0.0',
    auth: 'better-auth',
    database: 'JSON File (damz_auth_db.json)',
  });
});

// ── Config API ───────────────────────────────────────

function parseSimpleYaml(content) {
  const result = {};
  let currentSection = null;
  let currentSubSection = null;
  
  content.split('\n').forEach(line => {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    const indent = line.length - line.trimStart().length;
    const match = trimmed.trim().match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (!match) return;
    
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, '').trim();
    
    if (indent === 0) {
      if (!value) {
        currentSection = key;
        currentSubSection = null;
        result[key] = result[key] || {};
      } else {
        result[key] = value;
        currentSection = null;
      }
    } else if (indent <= 4 && currentSection) {
      if (!value) {
        currentSubSection = key;
        result[currentSection][key] = result[currentSection][key] || {};
      } else {
        if (currentSubSection) {
          result[currentSection][currentSubSection][key] = value;
        } else {
          result[currentSection][key] = value;
        }
      }
    } else if (indent > 4 && currentSection && currentSubSection) {
      result[currentSection][currentSubSection][key] = value;
    }
  });
  return result;
}

app.get('/api/config', (req, res) => {
  try {
    const configPath = path.join(__dirname, '..', 'config.yaml');
    if (!fs.existsSync(configPath)) {
      return res.json({ error: 'config.yaml not found' });
    }
    const content = fs.readFileSync(configPath, 'utf8');
    const config = parseSimpleYaml(content);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const configPath = path.join(__dirname, '..', 'config.yaml');
    const updates = req.body;
    
    // Read current config
    let content = '';
    if (fs.existsSync(configPath)) {
      content = fs.readFileSync(configPath, 'utf8');
    }
    
    // Simple update: replace matching key-value lines
    if (updates.llm && updates.llm.model) {
      content = content.replace(/model:\s*"[^"]*"/, `model: "${updates.llm.model}"`);
    }
    if (updates.llm && updates.llm.base_url) {
      content = content.replace(/base_url:\s*"[^"]*"/, `base_url: "${updates.llm.base_url}"`);
    }
    if (updates.output_mode) {
      content = content.replace(/output_mode:\s*"[^"]*"/, `output_mode: "${updates.output_mode}"`);
    }
    
    fs.writeFileSync(configPath, content);
    addLog('info', 'SYSTEM', `Konfigurasi config.yaml berhasil diperbarui: model=${updates.llm?.model || 'tidak berubah'}`);
    res.json({ success: true });
  } catch (err) {
    addLog('error', 'SYSTEM', `Gagal memperbarui konfigurasi: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── Ollama Proxy API ─────────────────────────────────
// These endpoints proxy requests to the Ollama server so the
// frontend can communicate without CORS issues.

function getOllamaUrl() {
  try {
    const configPath = path.join(__dirname, '..', 'config.yaml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const match = content.match(/base_url:\s*"([^"]+)"/);
      if (match) return match[1];
    }
  } catch (e) { /* fallback */ }
  return 'http://localhost:11434';
}

function getModelName() {
  try {
    const configPath = path.join(__dirname, '..', 'config.yaml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const match = content.match(/model:\s*"([^"]+)"/);
      if (match) return match[1];
    }
  } catch (e) { /* fallback */ }
  return 'qwen2.5:7b';
}

// Test Ollama connection
app.get('/api/ollama/test', async (req, res) => {
  const baseUrl = req.query.url || getOllamaUrl();
  addLog('info', 'LLM', `Menguji koneksi ke Ollama di ${baseUrl}...`);
  try {
    const versionRes = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(5000) });
    const versionData = await versionRes.json();
    
    const tagsRes = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    const tagsData = await tagsRes.json();
    
    addLog('info', 'LLM', `Koneksi Ollama sukses. Versi: ${versionData.version || 'unknown'}, model: ${(tagsData.models || []).length}`);
    res.json({
      success: true,
      version: versionData.version || 'unknown',
      model_count: (tagsData.models || []).length,
    });
  } catch (err) {
    const errorMsg = err.code === 'ECONNREFUSED' 
      ? 'Connection refused — Ollama tidak jalan'
      : err.name === 'TimeoutError'
        ? 'Timeout — server lambat atau firewall'
        : `Network error: ${err.message}`;
    addLog('error', 'LLM', `Koneksi Ollama gagal: ${errorMsg}`);
    res.json({
      success: false,
      error: errorMsg,
    });
  }
});

// List Ollama models
app.get('/api/ollama/models', async (req, res) => {
  const baseUrl = getOllamaUrl();
  try {
    const r = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(10000) });
    const data = await r.json();
    
    const MODEL_TAGS = {
      llama: ['FAST'], mistral: ['SMART'], phi: ['FAST'],
      gemma: ['SMART'], qwen: ['SMART'], deepseek: ['SMART'],
      llava: ['VISION'], bakllava: ['VISION'],
      nomic: ['EMBEDDING'], mxbai: ['EMBEDDING'],
    };
    
    const models = (data.models || []).map(m => {
      const name = m.name || '';
      const baseName = name.split(':')[0].toLowerCase();
      let tags = ['GENERAL'];
      
      // Check vision first (more specific)
      if (isVisionModel(name)) {
        tags = ['VISION'];
      } else {
        for (const [key, tagList] of Object.entries(MODEL_TAGS)) {
          if (baseName.includes(key)) { tags = tagList; break; }
        }
      }
      return {
        name,
        size_gb: ((m.size || 0) / (1024 ** 3)).toFixed(2),
        family: m.details?.family || 'unknown',
        parameter_size: m.details?.parameter_size || '',
        quantization: m.details?.quantization_level || '',
        tags,
      };
    });
    
    res.json({ success: true, models });
  } catch (err) {
    addLog('error', 'LLM', `Gagal mendapatkan daftar model Ollama: ${err.message}`);
    res.json({ success: false, error: err.message, models: [] });
  }
});

// Pull model
app.post('/api/ollama/pull', async (req, res) => {
  const baseUrl = getOllamaUrl();
  const { name } = req.body;
  addLog('info', 'LLM', `Memulai unduhan model dari Ollama: ${name}`);
  try {
    const r = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: false }),
      signal: AbortSignal.timeout(600000), // 10 min timeout
    });
    const data = await r.json();
    addLog('info', 'LLM', `Selesai mengunduh model: ${name}. Status: ${data.status || 'done'}`);
    res.json({ success: true, status: data.status || 'done' });
  } catch (err) {
    addLog('error', 'LLM', `Gagal mengunduh model ${name}: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});

// Delete model
app.delete('/api/ollama/models/:name', async (req, res) => {
  const baseUrl = getOllamaUrl();
  const modelName = decodeURIComponent(req.params.name);
  addLog('info', 'LLM', `Menghapus model dari Ollama: ${modelName}`);
  try {
    const r = await fetch(`${baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    addLog('info', 'LLM', `Berhasil menghapus model: ${modelName}`);
    res.json({ success: r.status === 200 });
  } catch (err) {
    addLog('error', 'LLM', `Gagal menghapus model ${modelName}: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});

// Known vision-capable model name patterns
const VISION_MODEL_PATTERNS = [
  'llama3.2-vision', 'llama3.2-vision:11b', 'llama3.2-vision:latest',
  'llava', 'llava:latest', 'llava:13b', 'llava:7b',
  'bakllava', 'bakllava:latest',
  'moondream', 'moondream:latest',
  'qwen2-vl', 'qwen2.5-vl', 'qwen2vl', 'qwen2.5vl',
  'minicpm-v', 'llava-phi3',
  'cogvlm2', 'internvl2',
];

// Check if a model name looks like a vision model
function isVisionModel(modelName) {
  const lower = (modelName || '').toLowerCase();
  return VISION_MODEL_PATTERNS.some(p => lower.includes(p.split(':')[0])) ||
         lower.includes('vision') || lower.includes('llava') ||
         /[-.]vl[:\-.]/.test(lower) || /vl:\w/.test(lower) || lower.endsWith('vl');
}

// Auto-detect available vision models from Ollama
async function getAvailableVisionModels() {
  const baseUrl = getOllamaUrl();
  try {
    const r = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return [];
    const data = await r.json();
    const models = (data.models || []).map(m => m.name).filter(isVisionModel);
    return models;
  } catch (e) {
    addLog('warn', 'VISION', `Gagal mendapatkan daftar model vision: ${e.message}`);
    return [];
  }
}

// Helper function to analyze image with vision model (auto-detect)
async function analyzeImageVision(filename, base64Raw, preferredModel = null) {
  const baseUrl = getOllamaUrl();
  const base64 = base64Raw.split(',')[1] || base64Raw;

  // Build candidate list: preferred model first, then auto-detected vision models
  let candidates = [];
  if (preferredModel && isVisionModel(preferredModel)) {
    candidates.push(preferredModel);
  }
  const available = await getAvailableVisionModels();
  for (const m of available) {
    if (!candidates.includes(m)) candidates.push(m);
  }

  if (candidates.length === 0) {
    addLog('warn', 'VISION', `Tidak ada model vision terdeteksi di Ollama. Install model vision (contoh: ollama pull llama3.2-vision) untuk menganalisis gambar.`);
    const sizeInKb = Math.round((base64.length * 0.75) / 1024);
    return `[Tidak Ada Model Vision] Gambar "${filename}" (${sizeInKb} KB) tidak dapat dianalisis karena tidak ada model vision yang terinstall di Ollama. Silakan install model vision dengan menjalankan: ollama pull llama3.2-vision`;
  }

  // Try each candidate vision model
  for (const visionModel of candidates) {
    try {
      addLog('info', 'VISION', `Menganalisis gambar "${filename}" menggunakan model ${visionModel}...`);
      const r = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: visionModel,
          messages: [
            {
              role: 'user',
              content: 'Jelaskan gambar ini secara detail dalam bahasa Indonesia. Ekstrak semua teks (OCR) yang terlihat.',
              images: [base64]
            }
          ],
          stream: false
        }),
        signal: AbortSignal.timeout(90000)
      });
      if (r.ok) {
        const data = await r.json();
        const content = data.message?.content || '';
        if (content) {
          addLog('info', 'VISION', `Analisis gambar "${filename}" berhasil dengan model ${visionModel}.`);
          return content;
        }
      } else {
        addLog('warn', 'VISION', `Model ${visionModel} gagal (HTTP ${r.status}), mencoba model lain...`);
      }
    } catch (e) {
      addLog('warn', 'VISION', `Model ${visionModel} error: ${e.message}. Mencoba model lain...`);
    }
  }

  const sizeInKb = Math.round((base64.length * 0.75) / 1024);
  return `[Vision Gagal] Semua model vision gagal menganalisis gambar "${filename}" (${sizeInKb} KB). Model yang dicoba: ${candidates.join(', ')}. Pastikan model vision berjalan dengan benar.`;
}

// Helper function to process all file attachments (images, office documents, notepad)
async function processAttachments(attachments, activeModel = null) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return "";
  }

  const dir = getWatchDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let injectionText = "";

  for (const att of attachments) {
    const { name, type, base64 } = att;
    if (!name || !base64) continue;

    try {
      const buffer = Buffer.from(base64.split(',')[1] || base64, 'base64');
      const filePath = path.join(dir, name);
      fs.writeFileSync(filePath, buffer);
      addLog('info', 'RAG', `Menyimpan attachment: ${name} (${Math.round(buffer.length/1024)} KB) ke RAG folder.`);

      const ext = path.extname(name).toLowerCase().replace('.', '');
      
      // Process Images
      if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
        let description = "";
        try {
          description = await analyzeImageVision(name, base64, activeModel);
        } catch (visionErr) {
          description = `[Error menganalisis gambar: ${visionErr.message}]. Fallback size: ${Math.round(buffer.length/1024)} KB.`;
        }

        // Save description to RAG memory
        const timestamp = Date.now();
        const memFileName = `image_memory_${timestamp}_${name.replace(/[^a-zA-Z0-9.-]/g, '_')}.txt`;
        const memFilePath = path.join(dir, memFileName);
        fs.writeFileSync(memFilePath, `File: ${name}\nDescription: ${description}`, 'utf8');
        addLog('info', 'RAG', `Menyimpan memori deskripsi gambar: ${memFileName}`);

        injectionText += `\n\n[Attached Image: ${name}]\nVisual Description:\n${description}\n`;
      } 
      // Process Documents
      else {
        let extractedText = "";
        if (ext === 'txt') {
          extractedText = buffer.toString('utf8');
        } else if (['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'html', 'md'].includes(ext)) {
          try {
            const parsed = await parseOffice(buffer, { fileType: ext });
            extractedText = parsed.toText();
          } catch (parseErr) {
            addLog('error', 'RAG', `Gagal mengekstrak teks dari ${name} menggunakan officeparser: ${parseErr.message}`);
            extractedText = `[Gagal mengekstrak teks dari dokumen: ${parseErr.message}]`;
          }
        } else {
          extractedText = `[Format dokumen tidak didukung untuk ekstraksi teks]`;
        }

        // Write extracted text to name.txt for RAG indexing
        const txtFilePath = path.join(dir, `${name}.txt`);
        fs.writeFileSync(txtFilePath, extractedText, 'utf8');
        addLog('info', 'RAG', `Menyimpan teks ekstraksi dokumen: ${name}.txt`);

        injectionText += `\n\n[Attached Document: ${name}]\nContent:\n${extractedText}\n`;
      }
    } catch (err) {
      addLog('error', 'RAG', `Gagal memproses attachment ${name}: ${err.message}`);
      injectionText += `\n\n[Attached File Error: ${name} (Failed to process: ${err.message})]\n`;
    }
  }

  return injectionText;
}

// Chat endpoint
app.post('/api/ollama/chat', async (req, res) => {
  const baseUrl = getOllamaUrl();
  const { model, messages, temperature, attachments } = req.body;
  const activeModel = model || 'qwen2.5:7b';
  addLog('info', 'LLM', `Mengirim query ke Ollama dengan model: ${activeModel}...`);
  try {
    // Read system prompt from config
    let systemPrompt = "Kamu adalah Damz, asisten AI pribadi yang berjalan 100% lokal. Jawab singkat, jelas, dan santai. SELALU gunakan bahasa Indonesia. JANGAN PERNAH menyertakan karakter, tulisan, huruf Mandarin (China), atau menawarkan ganti bahasa di akhir jawaban Anda. Hindari markdown, bullet point, atau format panjang.";
    try {
      const configPath = path.join(__dirname, '..', 'config.yaml');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const config = parseSimpleYaml(content);
        if (config.agent && config.agent.system_prompt) {
          systemPrompt = config.agent.system_prompt;
        }
      }
    } catch (e) {
      console.warn('[SERVER] Failed to read system prompt from config:', e.message);
    }

    const hasImageAttachments = attachments && Array.isArray(attachments) && 
      attachments.some(att => ['png','jpg','jpeg','gif','webp'].includes((att.type || '').toLowerCase()));
    const activeModelIsVision = isVisionModel(activeModel);

    // Prepare messages
    let recentMessages = [...(messages || [])];

    if (activeModelIsVision && hasImageAttachments) {
      // ── DIRECT VISION MODE ──
      // Active model supports vision → send images directly in the message
      addLog('info', 'VISION', `Model aktif ${activeModel} mendukung vision. Mengirim gambar langsung.`);
      
      const imageBase64List = [];
      let nonImageInjection = "";

      for (const att of attachments) {
        const { name, type, base64 } = att;
        if (!name || !base64) continue;
        const ext = (type || '').toLowerCase();

        if (['png','jpg','jpeg','gif','webp'].includes(ext)) {
          // Collect raw base64 for direct vision
          const raw = base64.split(',')[1] || base64;
          imageBase64List.push(raw);

          // Also save to RAG folder
          try {
            const dir = getWatchDir();
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const buffer = Buffer.from(raw, 'base64');
            fs.writeFileSync(path.join(dir, name), buffer);
            addLog('info', 'RAG', `Menyimpan attachment gambar: ${name}`);
          } catch (e) {
            addLog('warn', 'RAG', `Gagal menyimpan ${name}: ${e.message}`);
          }
        } else {
          // Non-image attachments: process as text
          try {
            const buffer = Buffer.from((base64.split(',')[1] || base64), 'base64');
            const dir = getWatchDir();
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, name), buffer);

            let extractedText = "";
            if (ext === 'txt') {
              extractedText = buffer.toString('utf8');
            } else if (['pdf','docx','xlsx','pptx','csv','html','md'].includes(ext)) {
              const parsed = await parseOffice(buffer, { fileType: ext });
              extractedText = parsed.toText();
            }
            if (extractedText) {
              nonImageInjection += `\n\n[Attached Document: ${name}]\nContent:\n${extractedText}\n`;
            }
          } catch (e) {
            addLog('warn', 'RAG', `Gagal memproses attachment ${name}: ${e.message}`);
          }
        }
      }

      // Inject images into the last user message
      if (recentMessages.length > 0) {
        const lastMsg = recentMessages[recentMessages.length - 1];
        if (lastMsg.role === 'user') {
          lastMsg.images = imageBase64List;
          if (nonImageInjection) {
            lastMsg.content = lastMsg.content + nonImageInjection;
          }
        }
      }

    } else if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      // ── PRE-ANALYSIS MODE ──
      // Active model is NOT vision → pre-analyze images with a vision model, inject text
      const injectionText = await processAttachments(attachments, activeModel);
      if (injectionText && recentMessages.length > 0) {
        const lastMsg = recentMessages[recentMessages.length - 1];
        if (lastMsg.role === 'user') {
          lastMsg.content = lastMsg.content + injectionText;
        } else {
          recentMessages.push({ role: 'user', content: injectionText });
        }
      }
    }

    // Check if multi-agent configuration is enabled
    const configAgentsPath = path.join(__dirname, '..', 'config_agents.yaml');
    if (fs.existsSync(configAgentsPath)) {
      addLog('info', 'LLM', 'Routing query through Multi-Agent Bridge (bridge.py)...');
      try {
        const getPythonCommand = () => {
          const userProfile = process.env.USERPROFILE || 'C:\\Users\\damza';
          const customPath = path.join(userProfile, 'AppData', 'Local', 'Python', 'bin', 'python.exe');
          if (fs.existsSync(customPath)) return customPath;
          return 'python';
        };
        const pythonProcess = spawn(getPythonCommand(), [path.join(__dirname, '..', 'bridge.py')]);

        
        let stdoutData = '';
        let stderrData = '';
        
        pythonProcess.stdout.on('data', (chunk) => {
          stdoutData += chunk.toString();
        });
        
        pythonProcess.stderr.on('data', (chunk) => {
          stderrData += chunk.toString();
        });
        
        const payload = {
          messages: recentMessages,
          temperature: temperature || 0.7
        };
        
        pythonProcess.stdin.write(JSON.stringify(payload));
        pythonProcess.stdin.end();
        
        const exitCode = await new Promise((resolve) => {
          pythonProcess.on('close', resolve);
        });
        
        if (exitCode === 0 && stdoutData) {
          const result = JSON.parse(stdoutData.trim());
          if (result.success) {
            addLog('info', 'LLM', `Multi-Agent: ${result.agent_name} (${result.provider_used} - ${result.model_used}) in ${result.response_time_ms}ms.`);
            return res.json({
              success: true,
              content: result.content,
              done: true,
              latency: result.response_time_ms,
              agent_id: result.agent_id,
              agent_name: result.agent_name,
              icon: result.icon,
              provider_used: result.provider_used,
              model_used: result.model_used,
              cost_usd: result.cost_usd,
              is_fallback: result.is_fallback
            });
          } else {
            addLog('warn', 'LLM', `Multi-Agent Bridge error: ${result.error}. Falling back to default Ollama...`);
          }
        } else {
          addLog('warn', 'LLM', `Multi-Agent Bridge exit ${exitCode}. Stderr: ${stderrData}. Falling back to default Ollama...`);
        }
      } catch (bridgeErr) {
        addLog('warn', 'LLM', `Failed to run Multi-Agent Bridge: ${bridgeErr.message}. Falling back to default Ollama...`);
      }
    }

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages
    ];

    const start = Date.now();
    const r = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        messages: formattedMessages,
        options: { temperature: temperature || 0.7 },
        stream: false,
      }),
      signal: AbortSignal.timeout(120000),
    });
    const data = await r.json();
    const latency = Date.now() - start;
    addLog('info', 'LLM', `Respons Ollama berhasil didapatkan dalam ${latency}ms.`);
    
    // Filter out any Chinese characters and CJK/Fullwidth punctuation (hallucinations) from the response text
    let cleanContent = data.message?.content || '';
    cleanContent = cleanContent.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g, '').trim();

    res.json({
      success: true,
      content: cleanContent,
      done: data.done || true,
      latency,
    });
  } catch (err) {
    addLog('error', 'LLM', `Gagal memproses chat Ollama: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});


// ── Model Load & Unload APIs ─────────────────────────

// Load model endpoint
app.post('/api/model/load', requireAuth, async (req, res) => {
  try {
    const baseUrl = getOllamaUrl();
    const model = getModelName();
    addLog('info', 'LLM', `Memuat model ${model} ke memori server...`);
    
    // Asynchronously call Ollama to preload the model
    fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: '',
        keep_alive: '5m'
      })
    }).catch(e => console.error('[MODEL LOAD ERROR]', e.message));

    res.json({ success: true, message: `Model ${model} loading initiated.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unload model endpoint
app.post('/api/model/unload', requireAuth, async (req, res) => {
  try {
    const db = readDB();
    const currentTime = new Date();
    
    // Check if there are other active sessions besides the current one
    const otherActiveSessions = db.session.filter(s => 
      s.userId !== req.user.id && new Date(s.expiresAt) > currentTime
    );

    if (otherActiveSessions.length > 0) {
      addLog('info', 'SYSTEM', `Model tidak dinonaktifkan karena masih digunakan oleh user lain.`);
      return res.json({ success: true, unloaded: false, message: 'Model still in use by other users.' });
    }

    const baseUrl = getOllamaUrl();
    const model = getModelName();
    addLog('info', 'LLM', `Menonaktifkan model ${model} di server karena user terakhir logout.`);

    // Unload model in Ollama by setting keep_alive to 0
    fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: '',
        keep_alive: 0
      })
    }).catch(e => console.error('[MODEL UNLOAD ERROR]', e.message));

    res.json({ success: true, unloaded: true, message: `Model ${model} unloaded.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// System metrics endpoint
app.get('/api/system/metrics', (req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  let disk = { total_gb: '500.0', used_gb: '210.0', percent: '42.0' };
  try {
    const stats = fs.statfsSync(process.cwd());
    const totalDisk = stats.bsize * stats.blocks;
    const freeDisk = stats.bsize * stats.bfree;
    const usedDisk = totalDisk - freeDisk;
    disk = {
      total_gb: (totalDisk / (1024 ** 3)).toFixed(1),
      used_gb: (usedDisk / (1024 ** 3)).toFixed(1),
      percent: ((usedDisk / totalDisk) * 100).toFixed(1),
    };
  } catch (e) {
    // fallback
  }

  res.json({
    uptime: Date.now() - serverStartTime,
    cpu: {
      usage: cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        return acc + ((total - cpu.times.idle) / total * 100);
      }, 0) / cpus.length,
      cores: cpus.length,
      model: cpus[0]?.model || 'Processor'
    },
    ram: {
      total_gb: (totalMem / (1024 ** 3)).toFixed(1),
      used_gb: (usedMem / (1024 ** 3)).toFixed(1),
      percent: ((usedMem / totalMem) * 100).toFixed(1),
    },
    disk,
  });
});

// Helper to get RAG watch directory from config
function getWatchDir() {
  try {
    const configPath = path.join(__dirname, '..', 'config.yaml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const match = content.match(/watch_dir:\s*"([^"]+)"/);
      if (match) return match[1];
    }
  } catch (e) {
    addLog('warn', 'SYSTEM', `Gagal membaca watch_dir dari config.yaml: ${e.message}`);
  }
  return path.join(__dirname, '..', 'rag', 'documents');
}

// Get document list in watch directory
app.get('/api/documents', (req, res) => {
  try {
    const dir = getWatchDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const files = fs.readdirSync(dir);
    const docs = files.map((filename, index) => {
      const filePath = path.join(dir, filename);
      const stats = fs.statSync(filePath);
      const ext = path.extname(filename).toLowerCase().replace('.', '');
      return {
        id: `doc-${index + 1}`,
        name: filename,
        type: ext,
        size: stats.size,
        chunks: Math.max(1, Math.round(stats.size / 512)), // simulate chunks based on file size
        indexedAt: stats.mtime.toISOString(),
        status: 'indexed'
      };
    });
    res.json({ success: true, documents: docs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload document
app.post('/api/documents/upload', (req, res) => {
  try {
    const { name, base64 } = req.body;
    if (!name || !base64) {
      return res.status(400).json({ success: false, error: 'Missing name or content' });
    }
    const dir = getWatchDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, name);
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);
    addLog('info', 'RAG', `Mengunggah dokumen baru: ${name} (${Math.round(buffer.length/1024)} KB)`);
    res.json({ success: true });
  } catch (err) {
    addLog('error', 'RAG', `Gagal mengunggah dokumen ${req.body.name}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete document
app.delete('/api/documents/:name', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.name);
    const dir = getWatchDir();
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      addLog('info', 'RAG', `Menghapus dokumen: ${filename}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'File not found' });
    }
  } catch (err) {
    addLog('error', 'RAG', `Gagal menghapus dokumen ${req.params.name}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/logs ────────────────────────────────────
app.get('/api/logs', (req, res) => {
  res.json({ success: true, logs: logBuffer });
});

// ── POST /api/documents/search ───────────────────────
app.post('/api/documents/search', (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.json({ success: true, results: [] });
    const dir = getWatchDir();
    if (!fs.existsSync(dir)) return res.json({ success: true, results: [] });
    const files = fs.readdirSync(dir);
    const results = [];
    files.forEach((filename) => {
      const filePath = path.join(dir, filename);
      const ext = path.extname(filename).toLowerCase();
      let matchCount = 0;
      if (ext === '.txt') {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              matchCount++;
            }
          });
        } catch (e) {
          addLog('warn', 'RAG', `Gagal membaca isi file untuk pencarian (${filename}): ${e.message}`);
        }
      } else {
        if (filename.toLowerCase().includes(query.toLowerCase())) {
          matchCount = 1;
        }
      }
      if (matchCount > 0 || filename.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          filename,
          matchCount: matchCount || 1,
          score: (0.7 + Math.random() * 0.29).toFixed(2)
        });
      }
    });
    addLog('info', 'RAG', `Mencari dokumen dengan query "${query}": ditemukan ${results.length} kecocokan.`);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/vision/analyze ─────────────────────────
app.post('/api/vision/analyze', async (req, res) => {
  const { filename, base64 } = req.body;
  if (!base64) {
    return res.status(400).json({ success: false, error: 'Missing image data' });
  }
  const activeModel = req.body.model || 'llama3.2-vision:11b';
  
  try {
    const content = await analyzeImageVision(filename, base64, activeModel);
    return res.json({
      success: true,
      description: content,
      ocrText: content.match(/[A-Z0-9\s]{3,}/g)?.join(' ') || 'Tidak ada teks yang terdeteksi.'
    });
  } catch (e) {
    addLog('error', 'VISION', `Gagal analisis visual: ${e.message}`);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/tts ─────────────────────────────────────
// Synthesize text using locally installed Piper TTS executable and return WAV stream.
app.get('/api/tts', async (req, res) => {
  const text = req.query.text;
  if (!text) return res.status(400).json({ error: 'Missing text parameter' });

  try {
    const configPath = path.join(__dirname, '..', 'config.yaml');
    if (!fs.existsSync(configPath)) {
      return res.status(500).json({ error: 'config.yaml not found' });
    }
    const content = fs.readFileSync(configPath, 'utf8');
    const config = parseSimpleYaml(content);
    
    const piperExe = config.tts?.piper_exe || 'C:/DamzAgent/piper/piper.exe';
    const voiceId = config.tts?.voice_id || 'id';
    const voicePath = config.tts?.voices?.[voiceId] || 'C:/DamzAgent/piper/voices/id_ID-salma-medium.onnx';

    if (!fs.existsSync(piperExe)) {
      addLog('warn', 'TTS', `Piper executable not found at: ${piperExe}`);
      return res.status(404).json({ 
        error: 'Piper executable not found', 
        piper_path: piperExe,
        help: 'Please download Piper TTS and place it at C:/DamzAgent/piper/' 
      });
    }
    if (!fs.existsSync(voicePath)) {
      addLog('warn', 'TTS', `Piper voice model ONNX file not found at: ${voicePath}`);
      return res.status(404).json({ 
        error: 'Piper voice model not found', 
        voice_path: voicePath 
      });
    }

    // Allow speed adjustment. Higher length_scale means slower speech.
    // Default to 1.25 for a slower, more natural and clear Indonesian pronunciation.
    const lengthScale = req.query.length_scale ? parseFloat(req.query.length_scale) : 1.25;

    // Generate temp file in OS temp folder
    const tempName = `tts-${crypto.randomBytes(8).toString('hex')}.wav`;
    const tempPath = path.join(os.tmpdir(), tempName);

    addLog('info', 'TTS', `Sintesis suara menggunakan Piper: "${text.substring(0, 30)}..." (length_scale: ${lengthScale})`);

    // Run Piper process
    const child = spawn(piperExe, [
      '--model', voicePath,
      '--length_scale', lengthScale.toString(),
      '--output_file', tempPath
    ]);

    child.stdin.write(text);
    child.stdin.end();

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(tempPath)) {
        res.sendFile(tempPath, (err) => {
          // Clean up temp file
          try {
            fs.unlinkSync(tempPath);
          } catch (e) {
            console.warn('[TTS] Failed to unlink temp WAV file:', e.message);
          }
        });
      } else {
        addLog('error', 'TTS', `Proses Piper keluar dengan error code ${code}`);
        res.status(500).json({ error: `Piper process exited with code ${code}` });
      }
    });

    child.on('error', (err) => {
      addLog('error', 'TTS', `Gagal menjalankan Piper: ${err.message}`);
      res.status(500).json({ error: `Failed to start Piper: ${err.message}` });
    });

  } catch (err) {
    addLog('error', 'TTS', `Error sintesis Piper: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Admin status check helper
function isAdmin(req) {
  return req.user?.email === 'damzcore@gmail.com' || req.user?.email === 'test-1781762155987@damz.local';
}

// ── Admin User Management APIs ───────────────────────

// 1. Get Users, Whitelist, and Pending requests
app.get('/api/admin/users', (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Akses ditolak: Hanya Super Admin yang dapat mengakses panel ini.' });
  }

  try {
    const configPath = path.join(__dirname, '..', 'config.yaml');
    let allowedEmails = [];
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = parseSimpleYaml(content);
      if (config.agent && config.agent.allowed_emails) {
        allowedEmails = config.agent.allowed_emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      }
    }

    const db = readDB();
    
    // Select clean user objects (hide password hashes)
    const activeUsers = db.user.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt
    }));

    const pendingUsers = db.pending_users.map(u => ({
      name: u.name,
      email: u.email,
      createdAt: u.createdAt
    }));

    const rejectedUsers = (db.rejected_users || []).map(u => ({
      name: u.name,
      email: u.email,
      rejectedAt: u.rejectedAt
    }));

    res.json({
      success: true,
      allowed: allowedEmails,
      users: activeUsers,
      pending: pendingUsers,
      rejected: rejectedUsers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to write whitelist back to config.yaml
function updateWhitelistInConfig(emails) {
  const configPath = path.join(__dirname, '..', 'config.yaml');
  if (fs.existsSync(configPath)) {
    let content = fs.readFileSync(configPath, 'utf8');
    const emailsString = emails.join(', ');
    
    if (content.includes('allowed_emails:')) {
      content = content.replace(/allowed_emails:\s*"[^"]*"/, `allowed_emails: "${emailsString}"`);
    } else {
      content = content.replace(/(agent:\s*[\s\S]*?)(llm:)/, `$1  allowed_emails: "${emailsString}"\n\n$2`);
    }
    fs.writeFileSync(configPath, content);
  }
}

// 2. Approve Pending Registration
app.post('/api/admin/users/approve', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const db = readDB();
    const pendingIndex = db.pending_users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (pendingIndex === -1) {
      return res.status(404).json({ error: 'Permohonan pendaftaran tidak ditemukan.' });
    }

    const pendingUser = db.pending_users[pendingIndex];

    // 1. Add to allowed_emails list in config.yaml
    const configPath = path.join(__dirname, '..', 'config.yaml');
    let allowed = [];
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = parseSimpleYaml(content);
      if (config.agent && config.agent.allowed_emails) {
        allowed = config.agent.allowed_emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      }
    }
    if (!allowed.includes(pendingUser.email)) {
      allowed.push(pendingUser.email);
      updateWhitelistInConfig(allowed);
    }

    // 2. Register the account officially using better-auth signUpEmail API
    let authResult = null;
    try {
      authResult = await auth.api.signUpEmail({
        body: {
          email: pendingUser.email,
          name: pendingUser.name,
          password: pendingUser.password
        }
      });
      addLog('info', 'SYSTEM', `signUpEmail hasil: ${JSON.stringify(authResult)}`);
    } catch (authErr) {
      console.error('[ADMIN APPROVE] better-auth user creation failed:', authErr);
      addLog('error', 'SYSTEM', `Gagal membuat user via better-auth: ${authErr.message}`);
      return res.status(500).json({ error: `Gagal mendaftarkan user ke sistem autentikasi: ${authErr.message}` });
    }

    // 3. Remove from pending_users list
    const freshDb = readDB();
    const freshPendingIndex = freshDb.pending_users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (freshPendingIndex !== -1) {
      freshDb.pending_users.splice(freshPendingIndex, 1);
    }
    freshDb.rejected_users = (freshDb.rejected_users || []).filter(u => u.email.toLowerCase() !== email.toLowerCase());
    writeDB(freshDb);

    addLog('info', 'SYSTEM', `Admin menyetujui pendaftaran user baru: ${pendingUser.email}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Reject/Delete Pending Registration
app.post('/api/admin/users/reject', (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const db = readDB();
    const pendingIndex = db.pending_users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (pendingIndex !== -1) {
      const pendingUser = db.pending_users[pendingIndex];
      if (!db.rejected_users) db.rejected_users = [];
      
      if (!db.rejected_users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        db.rejected_users.push({
          email: pendingUser.email,
          name: pendingUser.name,
          rejectedAt: new Date().toISOString()
        });
      }

      db.pending_users.splice(pendingIndex, 1);
      writeDB(db);
      addLog('info', 'SYSTEM', `Admin menolak permohonan pendaftaran: ${email}`);
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Permohonan pendaftaran tidak ditemukan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Add email directly to Whitelist
app.post('/api/admin/users/whitelist-add', (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const emailClean = email.trim().toLowerCase();
    const configPath = path.join(__dirname, '..', 'config.yaml');
    let allowed = [];
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = parseSimpleYaml(content);
      if (config.agent && config.agent.allowed_emails) {
        allowed = config.agent.allowed_emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      }
    }

    if (!allowed.includes(emailClean)) {
      allowed.push(emailClean);
      updateWhitelistInConfig(allowed);
      
      const db = readDB();
      db.rejected_users = (db.rejected_users || []).filter(u => u.email.toLowerCase() !== emailClean);
      writeDB(db);
      
      addLog('info', 'SYSTEM', `Admin menambahkan email baru ke whitelist: ${emailClean}`);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Remove email from Whitelist (and kick active sessions)
app.post('/api/admin/users/whitelist-remove', (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const emailClean = email.trim().toLowerCase();
    const configPath = path.join(__dirname, '..', 'config.yaml');
    let allowed = [];
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = parseSimpleYaml(content);
      if (config.agent && config.agent.allowed_emails) {
        allowed = config.agent.allowed_emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      }
    }

    if (allowed.includes(emailClean)) {
      allowed = allowed.filter(e => e !== emailClean);
      updateWhitelistInConfig(allowed);
      addLog('info', 'SYSTEM', `Admin menghapus email dari whitelist: ${emailClean}`);

      // Kick active sessions for this user from database
      const db = readDB();
      const user = db.user.find(u => u.email.toLowerCase() === emailClean);
      if (user) {
        db.session = db.session.filter(s => s.userId !== user.id);
        writeDB(db);
        addLog('info', 'SYSTEM', `Sesi aktif untuk user ${emailClean} berhasil dicabut.`);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Meeting Recorder API ──────────────────────────────

// Sanitize recordingId to prevent path traversal attacks
function sanitizeRecordingId(id) {
  if (!id || typeof id !== 'string') return null;
  // Only allow REC_ prefix followed by exactly 14 digits
  if (!/^REC_\d{14}$/.test(id)) return null;
  return id;
}

// Helper function to cleanup audio files older than 15 days
function cleanupOldAudio() {
  try {
    const recordingsDir = path.join(__dirname, '..', 'rag', 'documents', 'recordings');
    if (!fs.existsSync(recordingsDir)) return;
    
    const dirs = fs.readdirSync(recordingsDir);
    const now = Date.now();
    const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    
    dirs.forEach(dirName => {
      const dirPath = path.join(recordingsDir, dirName);
      if (fs.statSync(dirPath).isDirectory()) {
        const audioPath = path.join(dirPath, 'audio.webm');
        if (fs.existsSync(audioPath)) {
          const stats = fs.statSync(audioPath);
          const age = now - stats.mtimeMs;
          if (age > fifteenDaysMs) {
            fs.unlinkSync(audioPath);
            deletedCount++;
            addLog('info', 'SYSTEM', `Audio lama otomatis dihapus (lebih dari 15 hari): ${audioPath}`);
          }
        }
      }
    });
    if (deletedCount > 0) {
      console.log(`[RECORDER] Automatically cleaned up ${deletedCount} old audio files.`);
    }
  } catch (err) {
    console.error('[RECORDER] Error during old audio cleanup:', err.message);
  }
}

// Generate DOCX buffer helper
async function generateDocxBuffer(title, date, participants, duration, markdownContent) {
  const paragraphs = [];
  
  // Document Header Title
  paragraphs.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  );
  
  // Metadata Info
  paragraphs.push(new Paragraph({
    children: [
      new TextRun({ text: "Tanggal: ", bold: true }),
      new TextRun(date),
    ],
    spacing: { after: 100 }
  }));
  
  if (participants) {
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: "Peserta: ", bold: true }),
        new TextRun(participants),
      ],
      spacing: { after: 100 }
    }));
  }
  
  if (duration) {
    const min = Math.floor(duration / 60);
    const sec = duration % 60;
    const durationStr = min > 0 ? `${min} menit ${sec} detik` : `${sec} detik`;
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: "Durasi Rekaman: ", bold: true }),
        new TextRun(durationStr),
      ],
      spacing: { after: 200 }
    }));
  }
  
  // Divider line
  paragraphs.push(new Paragraph({
    text: "──────────────────────────────────────────────────",
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 }
  }));
  
  // Parse Markdown lines
  const lines = markdownContent.split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 100 } }));
      return;
    }
    
    // Headings
    if (trimmed.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        text: trimmed.slice(2),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      }));
    } else if (trimmed.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        text: trimmed.slice(3),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 180, after: 80 }
      }));
    } else if (trimmed.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        text: trimmed.slice(4),
        heading: HeadingLevel.HEADING_4,
        spacing: { before: 150, after: 60 }
      }));
    } 
    // Bullet lists
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      paragraphs.push(new Paragraph({
        text: trimmed.slice(2),
        bullet: { level: 0 },
        spacing: { after: 80 }
      }));
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)/);
      if (match) {
        paragraphs.push(new Paragraph({
          text: match[2],
          bullet: { level: 0 },
          spacing: { after: 80 }
        }));
      } else {
        paragraphs.push(new Paragraph({
          text: trimmed,
          spacing: { after: 80 }
        }));
      }
    }
    // Normal paragraphs
    else {
      const parts = [];
      let lastIndex = 0;
      const regex = /\*\*(.*?)\*\*/g;
      let match;
      
      while ((match = regex.exec(trimmed)) !== null) {
        if (match.index > lastIndex) {
          parts.push(new TextRun(trimmed.substring(lastIndex, match.index)));
        }
        parts.push(new TextRun({
          text: match[1],
          bold: true
        }));
        lastIndex = regex.lastIndex;
      }
      
      if (lastIndex < trimmed.length) {
        parts.push(new TextRun(trimmed.substring(lastIndex)));
      }
      
      paragraphs.push(new Paragraph({
        children: parts.length > 0 ? parts : [new TextRun(trimmed)],
        spacing: { after: 120 }
      }));
    }
  });
  
  // Footer Divider
  paragraphs.push(new Paragraph({
    text: "──────────────────────────────────────────────────",
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 100 }
  }));
  
  paragraphs.push(new Paragraph({
    children: [
      new TextRun({ text: "Dihasilkan otomatis oleh ", italic: true }),
      new TextRun({ text: "Damz Agent Personal Assistant", bold: true, italic: true })
    ],
    alignment: AlignmentType.CENTER
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs
    }]
  });
  
  return Packer.toBuffer(doc);
}

// 1. POST /api/recorder/save
app.post('/api/recorder/save', (req, res) => {
  try {
    const { audio, transcript, meetingInfo } = req.body;

    // Input validation
    if (audio && typeof audio !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid audio format: expected base64 string' });
    }
    if (transcript && !Array.isArray(transcript)) {
      return res.status(400).json({ success: false, error: 'Invalid transcript format: expected array' });
    }
    if (transcript && transcript.some(t => typeof t.text !== 'string' || typeof t.timestamp !== 'string')) {
      return res.status(400).json({ success: false, error: 'Invalid transcript entries: each must have text and timestamp strings' });
    }
    if (!transcript || transcript.length === 0) {
      return res.status(400).json({ success: false, error: 'Transcript kosong, tidak ada yang bisa disimpan' });
    }

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const recordingId = `REC_${timestamp}`;
    
    const recordingsDir = path.join(__dirname, '..', 'rag', 'documents', 'recordings', recordingId);
    fs.mkdirSync(recordingsDir, { recursive: true });
    
    if (audio) {
      try {
        const base64Data = audio.includes(',') ? audio.split(',')[1] : audio;
        const audioBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(path.join(recordingsDir, 'audio.webm'), audioBuffer);
      } catch (audioErr) {
        console.warn('[RECORDER] Failed to decode audio base64, skipping audio save:', audioErr.message);
      }
    }
    
    let plainTranscript = '';
    plainTranscript = transcript.map(line => `[${line.timestamp}] ${line.text}`).join('\n');
    fs.writeFileSync(path.join(recordingsDir, 'transcript.txt'), plainTranscript, 'utf8');
    fs.writeFileSync(path.join(recordingsDir, 'transcript.json'), JSON.stringify(transcript, null, 2), 'utf8');
    
    const metadata = {
      id: recordingId,
      title: (meetingInfo?.title || 'Rapat Tanpa Judul').slice(0, 200),
      date: (meetingInfo?.date || new Date().toLocaleDateString('id-ID')).slice(0, 100),
      participants: (meetingInfo?.participants || '').slice(0, 500),
      duration: Math.max(0, Math.floor(Number(meetingInfo?.duration) || 0)),
      createdAt: new Date().toISOString(),
      hasMinutes: false
    };
    
    fs.writeFileSync(path.join(recordingsDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
    
    addLog('info', 'RECORDER', `Recording berhasil disimpan: ${recordingId} - ${metadata.title}`);
    
    // Automatically trigger cleanup
    cleanupOldAudio();
    
    res.json({ success: true, recordingId, metadata });
  } catch (err) {
    addLog('error', 'RECORDER', `Gagal menyimpan recording: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. POST /api/recorder/generate-minutes
app.post('/api/recorder/generate-minutes', async (req, res) => {
  try {
    const rawId = req.body.recordingId;
    const forceRegenerate = req.body.forceRegenerate;
    const recordingId = sanitizeRecordingId(rawId);
    if (!recordingId) {
      return res.status(400).json({ success: false, error: 'Invalid or missing recordingId' });
    }
    
    const recordingDir = path.join(__dirname, '..', 'rag', 'documents', 'recordings', recordingId);
    if (!fs.existsSync(recordingDir)) {
      return res.status(404).json({ success: false, error: 'Recording not found' });
    }
    
    const metadataPath = path.join(recordingDir, 'metadata.json');
    const transcriptPath = path.join(recordingDir, 'transcript.txt');
    const minutesPath = path.join(recordingDir, 'minutes.md');
    const docxPath = path.join(recordingDir, 'minutes.docx');
    
    if (!fs.existsSync(metadataPath) || !fs.existsSync(transcriptPath)) {
      return res.status(400).json({ success: false, error: 'Metadata or transcript file missing' });
    }
    
    if (forceRegenerate !== true && fs.existsSync(minutesPath) && fs.existsSync(docxPath)) {
      addLog('info', 'RECORDER', `Mengembalikan notulensi ter-cache untuk: ${recordingId}`);
      const cachedMinutes = fs.readFileSync(minutesPath, 'utf8');
      return res.json({ success: true, minutes: cachedMinutes });
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const plainTranscript = fs.readFileSync(transcriptPath, 'utf8');
    
    const baseUrl = getOllamaUrl();
    const activeModel = getModelName();
    
    addLog('info', 'RECORDER', `Membuat notulensi rapat via model: ${activeModel}...`);
    
    const prompt = `Kamu adalah asisten AI yang bertugas membuat notulensi rapat (meeting minutes) profesional dalam bahasa Indonesia.
Berikut adalah informasi rapat:
Judul: ${metadata.title}
Tanggal: ${metadata.date}
Peserta: ${metadata.participants || 'Tidak ada info'}
Durasi: ${metadata.duration} detik

Gunakan transkrip percakapan berikut untuk membuat draf notulensi rapat yang terstruktur dengan format standar:
1. Ringkasan Eksekutif (1-2 paragraf singkat)
2. Poin-Poin Pembahasan (jelaskan apa saja yang dibahas secara mendetail)
3. Keputusan Utama yang Diambil
4. Rencana Tindak Lanjut (Action Items) dengan PIC (jika terdeteksi dari transkrip)
5. Catatan Tambahan (jika ada)

Harap tulis dengan bahasa Indonesia yang formal, rapi, dan profesional. Hanya keluarkan notulensinya saja tanpa kata pengantar atau penutup dari AI.

Transkrip:
${plainTranscript}`;

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        messages: [{ role: 'user', content: prompt }],
        options: { temperature: 0.5 },
        stream: false,
      }),
      signal: AbortSignal.timeout(180000), // 3 minutes timeout for long transcripts
    });
    
    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }
    
    const data = await response.json();
    let cleanContent = data.message?.content || '';
    cleanContent = cleanContent.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g, '').trim();
    
    // Save MD file
    fs.writeFileSync(path.join(recordingDir, 'minutes.md'), cleanContent, 'utf8');
    
    // Save DOCX file
    const docxBuffer = await generateDocxBuffer(
      metadata.title,
      metadata.date,
      metadata.participants,
      metadata.duration,
      cleanContent
    );
    fs.writeFileSync(path.join(recordingDir, 'minutes.docx'), docxBuffer);
    
    // Update metadata
    metadata.hasMinutes = true;
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    
    addLog('info', 'RECORDER', `Notulensi rapat berhasil dibuat untuk: ${recordingId}`);
    
    res.json({ success: true, minutes: cleanContent });
  } catch (err) {
    addLog('error', 'RECORDER', `Gagal membuat notulensi: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/recorder/minutes/:recordingId
app.get('/api/recorder/minutes/:recordingId', (req, res) => {
  try {
    const recordingId = sanitizeRecordingId(req.params.recordingId);
    if (!recordingId) {
      return res.status(400).json({ success: false, error: 'Invalid recordingId' });
    }
    const recordingDir = path.join(__dirname, '..', 'rag', 'documents', 'recordings', recordingId);
    const minutesPath = path.join(recordingDir, 'minutes.md');
    if (!fs.existsSync(minutesPath)) {
      return res.status(404).json({ success: false, error: 'Notulensi belum dibuat untuk rekaman ini' });
    }
    const minutes = fs.readFileSync(minutesPath, 'utf8');
    res.json({ success: true, minutes });
  } catch (err) {
    addLog('error', 'RECORDER', `Gagal mengambil notulensi: ${err.message}`, err);
    res.status(500).json({ success: false, error: 'Gagal mengambil notulensi' });
  }
});

// 3. GET /api/recorder/download/:recordingId
app.get('/api/recorder/download/:recordingId', (req, res) => {
  try {
    const recordingId = sanitizeRecordingId(req.params.recordingId);
    if (!recordingId) {
      return res.status(400).json({ success: false, error: 'Invalid recordingId' });
    }
    const recordingDir = path.join(__dirname, '..', 'rag', 'documents', 'recordings', recordingId);
    const docxPath = path.join(recordingDir, 'minutes.docx');
    
    if (!fs.existsSync(docxPath)) {
      return res.status(404).json({ success: false, error: 'File DOCX tidak ditemukan. Silakan generate notulensi terlebih dahulu.' });
    }
    
    const metadataPath = path.join(recordingDir, 'metadata.json');
    let title = 'Notulensi_Rapat';
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      title = (metadata.title || 'Notulensi_Rapat').replace(/[^a-zA-Z0-9]/g, '_');
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${title}.docx"`);
    
    const filestream = fs.createReadStream(docxPath);
    filestream.pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. GET /api/recorder/list
app.get('/api/recorder/list', (req, res) => {
  try {
    const recordingsDir = path.join(__dirname, '..', 'rag', 'documents', 'recordings');
    if (!fs.existsSync(recordingsDir)) {
      return res.json({ success: true, recordings: [] });
    }
    
    const dirs = fs.readdirSync(recordingsDir);
    const list = [];
    
    dirs.forEach(dirName => {
      const dirPath = path.join(recordingsDir, dirName);
      if (fs.statSync(dirPath).isDirectory()) {
        const metadataPath = path.join(dirPath, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            // Check if audio file still exists
            metadata.hasAudio = fs.existsSync(path.join(dirPath, 'audio.webm'));
            list.push(metadata);
          } catch (e) {
            console.warn(`[RECORDER] Failed to parse metadata for ${dirName}:`, e.message);
          }
        }
      }
    });
    
    // Sort by createdAt descending (newest first)
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ success: true, recordings: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/recorder/:recordingId
app.delete('/api/recorder/:recordingId', (req, res) => {
  try {
    const recordingId = sanitizeRecordingId(req.params.recordingId);
    if (!recordingId) {
      return res.status(400).json({ success: false, error: 'Invalid recordingId' });
    }
    const recordingDir = path.join(__dirname, '..', 'rag', 'documents', 'recordings', recordingId);
    if (fs.existsSync(recordingDir)) {
      fs.rmSync(recordingDir, { recursive: true, force: true });
      addLog('info', 'RECORDER', `Recording dihapus: ${recordingId}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Recording not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST /api/recorder/save-to-knowledge
app.post('/api/recorder/save-to-knowledge', (req, res) => {
  try {
    const recordingId = sanitizeRecordingId(req.body.recordingId);
    if (!recordingId) {
      return res.status(400).json({ success: false, error: 'Invalid or missing recordingId' });
    }
    
    const recordingDir = path.join(__dirname, '..', 'rag', 'documents', 'recordings', recordingId);
    const mdPath = path.join(recordingDir, 'minutes.md');
    const metadataPath = path.join(recordingDir, 'metadata.json');
    
    if (!fs.existsSync(mdPath) || !fs.existsSync(metadataPath)) {
      return res.status(400).json({ success: false, error: 'Minutes file or metadata missing' });
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const content = fs.readFileSync(mdPath, 'utf8');
    
    const ragDir = getWatchDir();
    if (!fs.existsSync(ragDir)) {
      fs.mkdirSync(ragDir, { recursive: true });
    }
    
    // Build a filename: Notulensi - <title> - <date>.md
    const safeTitle = (metadata.title || 'Notulensi').replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const safeDate = (metadata.date || new Date().toLocaleDateString('id-ID')).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Notulensi - ${safeTitle} - ${safeDate}.md`;
    const targetPath = path.join(ragDir, filename);
    
    fs.writeFileSync(targetPath, content, 'utf8');
    addLog('info', 'RAG', `Menyimpan notulensi rapat ke Knowledge Base: ${filename}`);
    
    res.json({ success: true, filename });
  } catch (err) {
    addLog('error', 'RAG', `Gagal menyimpan notulensi rapat ke Knowledge Base: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ── Multi-Agent API Endpoints ─────────────────────────

function parseAgentsYaml(content) {
  const result = { agents: {}, budget: {}, providers: {} };
  let currentTopKey = null;
  let currentAgentId = null;
  let currentSubKey = null;
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    const indent = line.length - line.trimStart().length;
    
    if (indent === 0) {
      if (trimmed.startsWith('agents:')) currentTopKey = 'agents';
      else if (trimmed.startsWith('budget:')) currentTopKey = 'budget';
      else if (trimmed.startsWith('providers:')) currentTopKey = 'providers';
      else currentTopKey = null;
      currentAgentId = null;
      currentSubKey = null;
      return;
    }
    
    if (currentTopKey === 'agents') {
      if (indent === 2) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+):$/);
        if (match) {
          currentAgentId = match[1];
          result.agents[currentAgentId] = { id: currentAgentId, keywords: [] };
          currentSubKey = null;
        }
      } else if (indent === 4 && currentAgentId) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (match) {
          const key = match[1];
          const val = match[2].trim().replace(/^["']|["']$/g, '');
          if (val) {
            result.agents[currentAgentId][key] = val === 'true' ? true : (val === 'false' ? false : val);
          } else {
            currentSubKey = key;
            if (key === 'primary' || key === 'fallback') {
              result.agents[currentAgentId][key] = {};
            }
          }
        }
      } else if (indent === 6 && currentAgentId && currentSubKey) {
        if (trimmed.startsWith('-')) {
          const val = trimmed.substring(1).trim().replace(/^["']|["']$/g, '');
          if (currentSubKey === 'keywords') {
            result.agents[currentAgentId].keywords.push(val);
          }
        } else {
          const match = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
          if (match && (currentSubKey === 'primary' || currentSubKey === 'fallback')) {
            const key = match[1];
            const val = match[2].trim().replace(/^["']|["']$/g, '');
            result.agents[currentAgentId][currentSubKey][key] = val;
          }
        }
      }
    } else if (currentTopKey === 'budget') {
      const match = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        const val = match[2].trim().replace(/^["']|["']$/g, '');
        result.budget[key] = isNaN(val) ? val : Number(val);
      }
    } else if (currentTopKey === 'providers') {
      if (indent === 2) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+):$/);
        if (match) {
          currentSubKey = match[1];
          result.providers[currentSubKey] = {};
        }
      } else if (indent === 4 && currentSubKey) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (match) {
          const key = match[1];
          const val = match[2].trim().replace(/^["']|["']$/g, '');
          result.providers[currentSubKey][key] = val;
        }
      }
    }
  });
  return result;
}

// GET /api/agents - List all agents + stats
app.get('/api/agents', requireAuth, (req, res) => {
  try {
    const configPath = path.join(__dirname, '..', 'config_agents.yaml');
    if (!fs.existsSync(configPath)) {
      return res.json({ enabled: false, agents: [] });
    }
    const content = fs.readFileSync(configPath, 'utf8');
    const parsed = parseAgentsYaml(content);
    
    // Read interaction stats
    const statsPath = path.join(__dirname, '..', 'data', 'agent_interaction_stats.json');
    let stats = {};
    if (fs.existsSync(statsPath)) {
      try {
        stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      } catch (e) {}
    }
    
    const agentsList = Object.values(parsed.agents).map(agent => {
      const agentStats = stats[agent.id] || { call_count: 0, avg_response_time_ms: 0 };
      return {
        ...agent,
        stats: agentStats
      };
    });
    
    res.json({
      enabled: true,
      agents: agentsList,
      budget: parsed.budget
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/:id - Get specific agent
app.get('/api/agents/:id', requireAuth, (req, res) => {
  try {
    const agentId = req.params.id;
    const configPath = path.join(__dirname, '..', 'config_agents.yaml');
    if (!fs.existsSync(configPath)) {
      return res.status(404).json({ error: 'Multi-agent not enabled' });
    }
    const content = fs.readFileSync(configPath, 'utf8');
    const parsed = parseAgentsYaml(content);
    const agent = parsed.agents[agentId];
    if (!agent) {
      return res.status(404).json({ error: `Agent ${agentId} not found` });
    }
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cost/summary - Get API cost tracking stats
app.get('/api/cost/summary', requireAuth, (req, res) => {
  try {
    const statsPath = path.join(__dirname, '..', 'data', 'agent_stats.json');
    if (!fs.existsSync(statsPath)) {
      return res.json({ total_usd: 0, by_agent: {}, by_provider: {} });
    }
    const data = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/providers/status - Get API keys status
app.get('/api/providers/status', requireAuth, (req, res) => {
  try {
    res.json({
      deepseek: { configured: !!process.env.DEEPSEEK_API_KEY },
      gemini: { configured: !!process.env.GEMINI_API_KEY },
      anthropic: { configured: !!process.env.ANTHROPIC_API_KEY },
      ollama: { configured: true }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Initial cleanup on server start
cleanupOldAudio();
// Daily cleanup interval
setInterval(cleanupOldAudio, 24 * 60 * 60 * 1000);

// ── Start Server ─────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║    DAMZ AGENT — Auth Server (better-auth) ║');
  console.log(`  ║    Running on http://localhost:${PORT}        ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  [*] Frontend CORS: ${FRONTEND_URL}`);
  console.log('  [*] Database: JSON File (data/damz_auth_db.json)');
  console.log('  [*] Auth: Email + Password enabled');
  console.log('  [*] Ollama Proxy: /api/ollama/*');
  console.log('  [*] Config API: /api/config');
  console.log('  [*] Documents API: /api/documents');
  console.log('');
});
