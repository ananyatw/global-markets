export const config = { runtime: 'nodejs' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-OpenRouter-Api-Key, X-Anthropic-Api-Key',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(Buffer.concat(chunks).toString('utf8')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS).end();
    return;
  }

  let body = {};
  try {
    const raw = await readBody(req);
    body = raw ? JSON.parse(raw) : {};
  } catch (_) {}

  const headerKey = (req.headers['x-openrouter-api-key'] || req.headers['x-anthropic-api-key'] || '').trim();
  const apiKey = headerKey || String(body.apiKey || '').trim() || (process.env.OPENROUTER_API_KEY || '').trim();

  if (!apiKey) {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'missing_api_key' }));
    return;
  }

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = data.error?.message || data.message || `HTTP ${upstream.status}`;
      const status = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
      res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'openrouter_error', message: msg }));
      return;
    }
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'upstream_network', message: String(e.message) }));
  }
}
