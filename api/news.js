export const config = { runtime: 'nodejs' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MARKET_NEWS_MAP = {
  'new york': { country: 'us', q: 'wall street stock market' },
  'mexico city': { country: 'mx', q: 'mexico bmv stock market' },
  london: { country: 'gb', q: 'london stock market ftse' },
  amsterdam: { country: 'nl', q: 'amsterdam aex stock market' },
  frankfurt: { country: 'de', q: 'germany dax stocks' },
  zurich: { country: 'ch', q: 'switzerland smi stocks' },
  paris: { country: 'fr', q: 'france cac40 stocks' },
  dubai: { country: 'ae', q: 'dubai dfm stocks' },
  shanghai: { country: 'cn', q: 'china stock market' },
  shenzhen: { country: 'cn', q: 'shenzhen stock market' },
  'hong kong': { country: 'hk', q: 'hang seng hong kong stocks' },
  singapore: { country: 'sg', q: 'singapore sti stock market' },
  taipei: { country: 'tw', q: 'taiwan taiex stocks' },
  seoul: { country: 'kr', q: 'kospi seoul stock market' },
  tokyo: { country: 'jp', q: 'nikkei tokyo stocks' },
  mumbai: { country: 'in', q: 'india sensex nse bse' },
  sydney: { country: 'au', q: 'asx australia stocks' },
  riyadh: { country: 'sa', q: 'saudi tadawul market' },
  toronto: { country: 'ca', q: 'canada tsx stocks' },
  'sao paulo': { country: 'br', q: 'brazil bovespa stocks' },
  johannesburg: { country: 'za', q: 'south africa jse stocks' },
  auckland: { country: 'nz', q: 'new zealand nzx stocks' },
};

const DEMO_NEWS = {
  status: 'ok',
  demo: true,
  articles: [
    { title: 'Major indices edge higher as investors weigh central bank signals', description: 'Global equities moved modestly up in midday trade as traders parsed comments from policymakers.', url: 'https://example.com/demo', publishedAt: new Date().toISOString(), source: { name: 'Demo Wire' } },
    { title: 'Asia-Pacific markets mixed after tech earnings batch', description: 'Regional benchmarks diverged as semiconductor names led gains in some markets.', url: 'https://example.com/demo', publishedAt: new Date(Date.now() - 3600000).toISOString(), source: { name: 'Demo Markets' } },
    { title: 'Oil and currencies in focus ahead of inflation data', description: 'Commodity-linked assets drew attention as the week\'s macro calendar fills out.', url: 'https://example.com/demo', publishedAt: new Date(Date.now() - 7200000).toISOString(), source: { name: 'Demo Finance' } },
    { title: 'European stocks steady; banks outperform', description: 'Lenders rose on the session while luxury goods lagged broader indices.', url: 'https://example.com/demo', publishedAt: new Date(Date.now() - 10800000).toISOString(), source: { name: 'Demo EU Brief' } },
    { title: 'Wall Street looks to earnings season for direction', description: 'Analysts say guidance from large caps may set the tone for risk appetite.', url: 'https://example.com/demo', publishedAt: new Date(Date.now() - 14400000).toISOString(), source: { name: 'Demo Street' } },
  ],
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS).end();
    return;
  }

  const NEWS_KEY = (process.env.NEWS_API_KEY || '').trim();
  if (!NEWS_KEY) {
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(DEMO_NEWS));
    return;
  }

  const params = new URL(req.url, 'http://x').searchParams;
  const mode = params.get('mode') || 'topic';
  const country = (params.get('country') || '').toLowerCase();
  const q = params.get('q') || 'stock market';
  const market = (params.get('market') || '').toLowerCase().trim();
  const mapped = MARKET_NEWS_MAP[market];

  try {
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

    const upstream = await fetch(url);
    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok || data.status === 'error') {
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({
        ...DEMO_NEWS,
        newsApiError: data.message || data.code || `HTTP ${upstream.status}`,
      }));
      return;
    }

    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ...data, demo: false }));
  } catch (e) {
    res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: String(e.message) }));
  }
}
