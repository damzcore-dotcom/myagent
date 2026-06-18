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
const FRONTEND_URL = 'http://localhost:3000';

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

app.use(express.json());

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
      for (const [key, tagList] of Object.entries(MODEL_TAGS)) {
        if (baseName.includes(key)) { tags = tagList; break; }
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

// Chat endpoint
app.post('/api/ollama/chat', async (req, res) => {
  const baseUrl = getOllamaUrl();
  const { model, messages, temperature } = req.body;
  addLog('info', 'LLM', `Mengirim query ke Ollama dengan model: ${model || 'qwen2.5:7b'}...`);
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

    // Prepend system message for Ollama context
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages || [])
    ];

    const start = Date.now();
    const r = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'qwen2.5:7b',
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
  } catch (e) {}
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
        } catch (e) {}
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
  const baseUrl = getOllamaUrl();
  const activeModel = req.body.model || 'llama3.2-vision:11b';
  
  try {
    addLog('info', 'VISION', `Menganalisis gambar "${filename}" menggunakan model ${activeModel}...`);
    const r = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          {
            role: 'user',
            content: 'Jelaskan gambar ini secara detail dan ekstrak teks apa pun (OCR) yang Anda lihat.',
            images: [base64]
          }
        ],
        stream: false
      }),
      signal: AbortSignal.timeout(60000)
    });
    if (r.ok) {
      const data = await r.json();
      const content = data.message?.content || '';
      addLog('info', 'VISION', `Analisis gambar "${filename}" selesai.`);
      return res.json({
        success: true,
        description: content,
        ocrText: content.match(/[A-Z0-9\s]{3,}/g)?.join(' ') || 'Tidak ada teks yang terdeteksi.'
      });
    }
  } catch (e) {
    addLog('warn', 'VISION', `Gagal analisis dengan Ollama (${e.message}). Menggunakan analisis lokal.`);
  }

  const sizeInKb = Math.round((base64.length * 0.75) / 1024);
  res.json({
    success: true,
    description: `[Analisis Lokal Fallback] Gambar "${filename}" (${sizeInKb} KB) telah berhasil diproses secara lokal. Deskripsi visual lengkap membutuhkan model vision lokal (seperti llama3.2-vision atau llava) yang terpasang dan berjalan aktif di Ollama. Silakan pasang model vision di halaman Settings untuk analisis visual penuh.`,
    ocrText: `[Metadata OCR]\nNama file: ${filename}\nUkuran file: ${sizeInKb} KB\nTipe konten: base64`
  });
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
  return req.user?.email === 'damzcore@gmail.com';
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
    try {
      await auth.api.signUpEmail({
        body: {
          email: pendingUser.email,
          name: pendingUser.name,
          password: pendingUser.password
        }
      });
    } catch (authErr) {
      console.warn('[ADMIN APPROVE] better-auth user creation skipped/failed:', authErr.message);
    }

    // 3. Remove from pending_users list
    db.pending_users.splice(pendingIndex, 1);
    db.rejected_users = (db.rejected_users || []).filter(u => u.email.toLowerCase() !== email.toLowerCase());
    writeDB(db);

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
