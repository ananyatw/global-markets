export const config = { runtime: 'nodejs' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-OpenRouter-Api-Key, X-Anthropic-Api-Key',
};

const OPENROUTER_MODEL = (process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-8b-instruct:free').trim();
const FALLBACK_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
];

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > 256 * 1024) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
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
  if (req.method !== 'POST') {
    res.writeHead(405, CORS).end();
    return;
  }

  let body;
  try {
    const raw = await readBody(req);
    body = raw ? JSON.parse(raw) : {};
  } catch (e) {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_json', message: String(e.message) }));
    return;
  }

  const question = String(body.question || '').trim();
  if (!question) {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'missing_question' }));
    return;
  }

  const headerKey = (req.headers['x-openrouter-api-key'] || req.headers['x-anthropic-api-key'] || '').trim();
  const apiKey = headerKey || String(body.apiKey || '').trim() || (process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) {
    res.writeHead(503, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'missing_api_key',
      message: 'Set OPENROUTER_API_KEY in Vercel environment variables, or paste a key in the Learn tab.',
    }));
    return;
  }

  const messages = [
    {
      role: 'system',
      content: 'You are a clear, accurate finance educator for curious beginners. Answer in plain language. Use short paragraphs or bullet lists when helpful. Do not give personalized investment advice, trade recommendations, or promises about returns.',
    },
    { role: 'user', content: question },
  ];

  const modelsToTry = [OPENROUTER_MODEL, ...FALLBACK_MODELS].filter((m, i, a) => m && a.indexOf(m) === i);

  let lastResult;
  try {
    for (const model of modelsToTry) {
      const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, max_tokens: 2048, messages }),
      });
      const data = await upstream.json().catch(() => ({}));
      lastResult = { upstream, data, model };
      if (upstream.ok) break;
      const msg = String(data?.error?.message || data?.message || '');
      if (!msg.toLowerCase().includes('no endpoints found')) break;
    }
  } catch (e) {
    res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'upstream_network', message: String(e.message) }));
    return;
  }

  const { upstream, data, model } = lastResult || {};
  if (!upstream?.ok) {
    const msg = data?.error?.message || data?.message || `HTTP ${upstream?.status || 502}`;
    const status = upstream?.status >= 400 && upstream?.status < 600 ? upstream.status : 502;
    res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'openrouter_error', message: msg, modelTried: model }));
    return;
  }

  const text = String(data.choices?.[0]?.message?.content || '').trim() || '(No text in response.)';
  res.writeHead(200, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ text, modelUsed: model }));
}
