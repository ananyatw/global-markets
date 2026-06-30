export const config = { runtime: 'nodejs' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS).end();
    return;
  }

  const raw = (new URL(req.url, 'http://x').searchParams.get('symbols') || '').trim();
  if (!raw) {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'missing_symbols', quotes: {} }));
    return;
  }

  const symbols = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  try {
    const url = new URL('https://query1.finance.yahoo.com/v7/finance/quote');
    url.searchParams.set('symbols', symbols.join(','));

    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'global-markets-proxy/1.0' },
    });
    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      // Fallback: chart endpoint
      const quotes = {};
      await Promise.all(symbols.map(async (sym) => {
        try {
          const cUrl = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`);
          cUrl.searchParams.set('range', '5d');
          cUrl.searchParams.set('interval', '1d');
          const cRes = await fetch(cUrl, { headers: { 'User-Agent': 'global-markets-proxy/1.0' } });
          const cData = await cRes.json().catch(() => ({}));
          const result = cData?.chart?.result?.[0];
          const closes = result?.indicators?.quote?.[0]?.close || [];
          const valid = closes.filter(n => Number.isFinite(n));
          const close = valid[valid.length - 1];
          const prev = valid[valid.length - 2];
          if (Number.isFinite(close)) {
            const pct = Number.isFinite(prev) && prev !== 0 ? ((close - prev) / prev) * 100 : 0;
            quotes[sym] = {
              close: String(close),
              previous_close: Number.isFinite(prev) ? String(prev) : '',
              percent_change: String(pct),
            };
          }
        } catch (_) {}
      }));

      if (Object.keys(quotes).length) {
        res.writeHead(200, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ status: 'ok', quotes, source: 'yahoo_chart_fallback' }));
        return;
      }

      res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: `HTTP ${upstream.status}`, quotes: {} }));
      return;
    }

    const rows = data?.quoteResponse?.result || [];
    const quotes = {};
    for (const row of rows) {
      const sym = String(row.symbol || '').toUpperCase();
      if (!sym) continue;
      quotes[sym] = {
        close: String(row.regularMarketPrice ?? ''),
        previous_close: String(row.regularMarketPreviousClose ?? ''),
        percent_change: row.regularMarketChangePercent == null ? '' : String(row.regularMarketChangePercent),
      };
    }

    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: 'ok', quotes }));
  } catch (e) {
    res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: String(e.message), quotes: {} }));
  }
}
