#!/usr/bin/env node
/**
 * Serves global-markets.html and proxies NewsAPI + Anthropic (browser-safe).
 *
 * Env:
 *   NEWS_API_KEY     — overrides bundled NewsAPI key (use for public repos; never commit secrets)
 *   ANTHROPIC_API_KEY — Claude key for Learn explanations (optional if browser sends x-anthropic-api-key)
 *   ANTHROPIC_MODEL  — default claude-3-5-sonnet-20241022
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodeFetch from 'node-fetch';

const fetch = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : nodeFetch;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3847;
const NEWS_KEY = (process.env.NEWS_API_KEY?.trim() || 'd6f20474eeaa45d19ff487af60ab1fa0').trim();
const ANTHROPIC_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
const ANTHROPIC_MODEL = (process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022').trim();

const MAX_JSON_BODY = 256 * 1024;
const MARKET_NEWS_MAP = {
  'new york': { country: 'us', q: 'wall street stock market' },
  london: { country: 'gb', q: 'london stock market ftse' },
  frankfurt: { country: 'de', q: 'germany dax stocks' },
  paris: { country: 'fr', q: 'france cac40 stocks' },
  shanghai: { country: 'cn', q: 'china stock market' },
  'hong kong': { country: 'hk', q: 'hang seng hong kong stocks' },
  tokyo: { country: 'jp', q: 'nikkei tokyo stocks' },
  mumbai: { country: 'in', q: 'india sensex nse bse' },
  sydney: { country: 'au', q: 'asx australia stocks' },
  riyadh: { country: 'sa', q: 'saudi tadawul market' },
  toronto: { country: 'ca', q: 'canada tsx stocks' },
  'sao paulo': { country: 'br', q: 'brazil bovespa stocks' },
  johannesburg: { country: 'za', q: 'south africa jse stocks' },
  auckland: { country: 'nz', q: 'new zealand nzx stocks' },
};

/** Lets a page opened as file:// still call this dev server (same machine). */
function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Anthropic-Api-Key',
    ...extra,
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > MAX_JSON_BODY) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const DEMO_NEWS = {
  status: 'ok',
  demo: true,
  articles: [
    {
      title: 'Major indices edge higher as investors weigh central bank signals',
      description: 'Global equities moved modestly up in midday trade as traders parsed comments from policymakers.',
      url: 'https://example.com/demo',
      publishedAt: new Date().toISOString(),
      source: { name: 'Demo Wire' },
    },
    {
      title: 'Asia-Pacific markets mixed after tech earnings batch',
      description: 'Regional benchmarks diverged as semiconductor names led gains in some markets.',
      url: 'https://example.com/demo',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      source: { name: 'Demo Markets' },
    },
    {
      title: 'Oil and currencies in focus ahead of inflation data',
      description: 'Commodity-linked assets drew attention as the week’s macro calendar fills out.',
      url: 'https://example.com/demo',
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      source: { name: 'Demo Finance' },
    },
    {
      title: 'European stocks steady; banks outperform',
      description: 'Lenders rose on the session while luxury goods lagged broader indices.',
      url: 'https://example.com/demo',
      publishedAt: new Date(Date.now() - 10800000).toISOString(),
      source: { name: 'Demo EU Brief' },
    },
    {
      title: 'Wall Street looks to earnings season for direction',
      description: 'Analysts say guidance from large caps may set the tone for risk appetite.',
      url: 'https://example.com/demo',
      publishedAt: new Date(Date.now() - 14400000).toISOString(),
      source: { name: 'Demo Street' },
    },
  ],
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.join(root, normalized);
  if (!full.startsWith(root)) return null;
  return full;
}

async function proxyNews(searchParams) {
  if (!NEWS_KEY) return DEMO_NEWS;

  const mode = searchParams.get('mode') || 'topic';
  const country = (searchParams.get('country') || '').toLowerCase();
  const q = searchParams.get('q') || 'stock market';
  const market = (searchParams.get('market') || '').toLowerCase().trim();
  const mapped = MARKET_NEWS_MAP[market];

  let url;
  if (mapped?.country) {
    url = new URL('https://newsapi.org/v2/top-headlines');
    url.searchParams.set('country', mapped.country);
    url.searchParams.set('category', 'business');
    url.searchParams.set('pageSize', '20');
    url.searchParams.set('apiKey', NEWS_KEY);
  } else if (mode === 'country' && country) {
    url = new URL('https://newsapi.org/v2/top-headlines');
    url.searchParams.set('country', country);
    url.searchParams.set('category', 'business');
    url.searchParams.set('pageSize', '20');
    url.searchParams.set('apiKey', NEWS_KEY);
  } else {
    url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', mapped?.q || q);
    url.searchParams.set('sortBy', 'publishedAt');
    url.searchParams.set('language', 'en');
    url.searchParams.set('pageSize', '20');
    url.searchParams.set('apiKey', NEWS_KEY);
  }

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === 'error') {
    return {
      ...DEMO_NEWS,
      demo: true,
      newsApiError: data.message || data.code || `HTTP ${res.status}`,
    };
  }
  return { ...data, demo: false };
}

async function proxyClaude(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    res.writeHead(400, corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(JSON.stringify({ error: 'invalid_json', message: String(e.message) }));
    return;
  }

  const question = String(body.question || '').trim();
  if (!question) {
    res.writeHead(400, corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(JSON.stringify({ error: 'missing_question' }));
    return;
  }

  const headerKey = (req.headers['x-anthropic-api-key'] || '').trim();
  const apiKey = headerKey || ANTHROPIC_KEY;
  if (!apiKey) {
    res.writeHead(503, corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(
      JSON.stringify({
        error: 'missing_api_key',
        message:
          'Set ANTHROPIC_API_KEY when starting the server, or paste a key in the Learn tab (stored locally and sent only to this dev server).',
      }),
    );
    return;
  }

  const payload = {
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system:
      'You are a clear, accurate finance educator for curious beginners. Answer in plain language. Use short paragraphs or bullet lists when helpful. Do not give personalized investment advice, trade recommendations, or promises about returns.',
    messages: [{ role: 'user', content: question }],
  };

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    res.writeHead(502, corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(JSON.stringify({ error: 'upstream_network', message: String(e.message) }));
    return;
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const msg = data.error?.message || data.message || `HTTP ${upstream.status}`;
    res.writeHead(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, {
      ...corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
    });
    res.end(JSON.stringify({ error: 'anthropic_error', message: msg }));
    return;
  }

  const parts = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text);
  const text = parts.join('\n').trim() || '(No text in response.)';

  res.writeHead(200, {
    ...corsHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    }),
  });
  res.end(JSON.stringify({ text }));
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (
    req.method === 'OPTIONS' &&
    (u.pathname === '/api/news' || u.pathname === '/api/claude')
  ) {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === 'POST' && u.pathname === '/api/claude') {
    try {
      await proxyClaude(req, res);
    } catch (e) {
      res.writeHead(500, corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
      res.end(JSON.stringify({ error: 'server_error', message: String(e.message) }));
    }
    return;
  }

  if (u.pathname === '/api/news') {
    try {
      const payload = await proxyNews(u.searchParams);
      const body = JSON.stringify(payload);
      res.writeHead(200, {
        ...corsHeaders({
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        }),
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500, corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
      res.end(JSON.stringify({ status: 'error', message: String(e.message) }));
    }
    return;
  }

  let filePath = u.pathname === '/' ? '/global-markets.html' : u.pathname;
  const resolved = safeJoin(__dirname, filePath);
  if (!resolved) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(resolved, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const ext = path.extname(resolved);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(resolved).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Global Markets → http://127.0.0.1:${PORT}/`);
  if (!process.env.NEWS_API_KEY?.trim()) {
    console.log('NewsAPI: using bundled key; set NEWS_API_KEY to override.');
  }
  if (!ANTHROPIC_KEY) {
    console.log('ANTHROPIC_API_KEY not set — Learn tab can still use a key saved in the browser.');
  }
});
