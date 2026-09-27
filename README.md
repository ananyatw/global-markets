# Global Markets

A real-time global stock markets dashboard. Interactive world map with live prices, market news, and AI-powered finance explanations.

**[Live Demo →](https://global-markets-mocha.vercel.app)**

![Global Markets screenshot](https://raw.githubusercontent.com/ananyatw/global-markets/dev/screenshot.png)

---

## Features

- **Interactive world map** — 22 stock exchanges as clickable pins with open/closed/pre-market status
- **Live prices** — ETF proxies and index tickers via Yahoo Finance, refreshed every 60 seconds
- **Market news** — headlines filtered by region via NewsAPI, with demo fallback when no key is set
- **AI Learn tab** — tap any finance topic to get a plain-language explanation; supports OpenRouter, Gemini, and Groq — works for visitors out of the box with a server-side key, or bring your own

---

## Running locally

```bash
git clone https://github.com/ananyatw/global-markets.git
cd global-markets
cp .env.example .env   # add your keys
npm install
npm start
# → http://localhost:3847
```

---

## Deploying to Vercel

1. Import this repo at [vercel.com](https://vercel.com)
2. Add environment variables (Settings → Environment Variables):

| Variable | Required | Where to get it |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes (for AI tab) | [openrouter.ai/keys](https://openrouter.ai/keys) — free |
| `NEWS_API_KEY` | Optional | [newsapi.org/register](https://newsapi.org/register) — free |

3. Deploy — Vercel auto-detects the `api/` folder and `vercel.json`

The app works without any keys: Yahoo Finance quotes load live, news falls back to sample headlines, and the AI tab uses the server key you set.

---

## Tech

- Vanilla HTML/CSS/JS — no framework, no build step
- Vercel serverless functions (`api/`) for proxying external APIs
- Yahoo Finance for market data
- NewsAPI for headlines
- OpenRouter / Google Gemini / Groq for AI explanations

---

## API keys & privacy

User-provided API keys are stored only in the browser's `localStorage` and sent only to this app's own `/api/claude` endpoint. They are never logged or stored server-side.
