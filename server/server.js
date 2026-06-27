#!/usr/bin/env node
/**
 * SocialCrypt Server
 * ===================
 *
 * Dumb JSONL blob store for encrypted social messaging.
 * Works everywhere: bare metal, Docker, HuggingFace Spaces,
 * Railway, Fly.io, Render, Glitch, etc.
 *
 *   GET  /           → Web dashboard
 *   GET  /blobs.jsonl → All blobs (JSONL format)
 *   POST /submit      → Append { id, blob } (server sets ts)
 *   GET  /stats       → Message count & size
 *   GET  /health      → Health check
 *
 * Storage: Uses /data on HuggingFace Spaces (persistent volume),
 *          falls back to local ./data everywhere else.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 7860;
const DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data');
const BLOBS_FILE = path.join(DATA_DIR, 'blobs.jsonl');

// ─── Initialize ──────────────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
console.log(`📁 Data directory: ${DATA_DIR}`);

// ─── Helper: get stats ──────────────────────────────────────────────
function getStats() {
  if (!fs.existsSync(BLOBS_FILE)) return { messages: 0, size_bytes: 0, size_human: '0 B' };
  const stat = fs.statSync(BLOBS_FILE);
  const content = fs.readFileSync(BLOBS_FILE, 'utf-8').trim();
  const lines = content ? content.split('\n').filter(Boolean) : [];
  const sizeKB = (stat.size / 1024).toFixed(1);
  return {
    messages: lines.length,
    size_bytes: stat.size,
    size_human: stat.size > 1048576 ? (stat.size / 1048576).toFixed(1) + ' MB' : sizeKB + ' KB'
  };
}

// ─── HTTP Server ─────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  // GET / — Dashboard
  if (req.method === 'GET' && p === '/') {
    const s = getStats();
    const rows = [];
    if (s.messages > 0) {
      const lines = fs.readFileSync(BLOBS_FILE, 'utf-8').trim().split('\n').filter(Boolean).reverse().slice(0, 50);
      for (const line of lines) {
        try {
          const e = JSON.parse(line);
          rows.push(`<tr><td>${(e.id||'?').substring(0,16)}...</td><td>${e.ts ? new Date(e.ts).toLocaleString() : '?'}</td><td>${e.blob ? (e.blob.length/1024).toFixed(1)+' KB' : '?'}</td></tr>`);
        } catch {}
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>🔐 SocialCrypt Server</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--border:#30363d;--text:#e6edf3;--dim:#8b949e;--accent:#58a6ff}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;padding:20px}
.container{max-width:800px;margin:0 auto}
h1{text-align:center;padding:40px 0 20px;font-size:2.5rem;color:var(--accent)}
h2{font-size:1.2rem;margin-bottom:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.box{text-align:center;padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:8px}
.box .n{font-size:2rem;font-weight:700;color:var(--accent)}
.box .l{font-size:0.82rem;color:var(--dim);margin-top:4px}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:10px 12px;border-bottom:2px solid var(--border);color:var(--dim);font-size:0.82rem}
td{padding:10px 12px;border-bottom:1px solid var(--border);font-family:monospace;font-size:0.85rem}
tr:hover td{background:rgba(255,255,255,0.03)}
.footer{text-align:center;padding:24px;color:var(--dim);font-size:0.85rem}
</style></head>
<body><div class="container">
<h1>🔐 SocialCrypt</h1>
<div class="card"><h2>📊 Stats</h2>
<div class="grid">
<div class="box"><div class="n">${s.messages}</div><div class="l">Messages</div></div>
<div class="box"><div class="n">${s.size_human}</div><div class="l">Size</div></div>
<div class="box"><div class="n">${DATA_DIR === '/data' ? '/data' : './data'}</div><div class="l">Storage</div></div>
</div></div>
<div class="card"><h2>📡 Endpoints</h2>
<p style="font-family:monospace;font-size:0.9rem;margin:4px 0">GET /blobs.jsonl — Read all blobs</p>
<p style="font-family:monospace;font-size:0.9rem;margin:4px 0">POST /submit — Submit {id, blob}</p>
<p style="font-family:monospace;font-size:0.9rem;margin:4px 0">GET /stats — JSON stats</p>
<p style="font-family:monospace;font-size:0.9rem;margin:4px 0">GET /health — Health check</p>
</div>
<div class="card"><h2>📬 Messages ${s.messages > 0 ? '('+Math.min(s.messages,50)+' of '+s.messages+')' : ''}</h2>
${s.messages > 0 ? `<div style="overflow-x:auto"><table><thead><tr><th>Recipient</th><th>Time</th><th>Size</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : '<p style="text-align:center;padding:40px;color:var(--dim)">📭 No messages yet</p>'}
</div>
<div class="footer">SocialCrypt — Encrypted Social Messaging</div>
</div></body></html>`);
  }

  // GET /blobs.jsonl — Stream blobs
  if (req.method === 'GET' && p === '/blobs.jsonl') {
    const s = getStats();
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'X-Total-Messages': String(s.messages) });
    if (fs.existsSync(BLOBS_FILE)) return fs.createReadStream(BLOBS_FILE).on('error', () => res.end()).pipe(res);
    return res.end('');
  }

  // POST /submit — Append blob
  if (req.method === 'POST' && p === '/submit') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.id || !data.blob) { res.writeHead(400); return res.end(JSON.stringify({error:'Missing id or blob'})); }
        const line = JSON.stringify({ id: data.id, ts: Date.now(), blob: data.blob }) + '\n';
        if (!fs.existsSync(path.dirname(BLOBS_FILE))) fs.mkdirSync(path.dirname(BLOBS_FILE), { recursive: true });
        fs.appendFileSync(BLOBS_FILE, line, 'utf-8');
        console.log(`📨 Stored for ${data.id.substring(0,16)}... | Total: ${getStats().messages}`);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({error:'Invalid JSON: '+e.message})); }
    });
    return;
  }

  // GET /stats
  if (req.method === 'GET' && p === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ...getStats(), data_dir: DATA_DIR, port: PORT }));
  }

  // GET /health
  if (req.method === 'GET' && p === '/health') {
    let writable = false;
    try { fs.accessSync(path.dirname(BLOBS_FILE), fs.constants.W_OK); writable = true; } catch {}
    res.writeHead(writable ? 200 : 503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: writable ? 'ok' : 'degraded', messages: getStats().messages }));
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('SocialCrypt — try /blobs.jsonl, /submit, /stats, /health');
});

// ─── Startup ─────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`┌──────────────────────────────────┐`);
  console.log(`│  🔐 SocialCrypt Server            │`);
  console.log(`│  📡 http://0.0.0.0:${String(PORT).padEnd(5)}          │`);
  console.log(`│  💾 ${String(DATA_DIR).padEnd(25)}│`);
  console.log(`│  📬 ${String(getStats().messages).padStart(5)} messages            │`);
  console.log(`└──────────────────────────────────┘`);
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 5000); });
process.on('SIGINT', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 5000); });
