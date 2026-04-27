## 🤖 Live AI Explanations (Learn Tab)

The Learn tab uses AI to explain stock market concepts in plain English.
It works out of the box with a free OpenRouter key — no credit card required.

### Get your free key (2 minutes)

1. Go to [openrouter.ai](https://openrouter.ai) and sign up
2. Navigate to [openrouter.ai/keys](https://openrouter.ai/keys)
3. Click **Create Key** — the free tier is enough
4. Paste it into the key input on the Learn tab and hit **Save**

That's it. The key is stored locally in your browser and never sent
anywhere except OpenRouter's API.

### Running the app

```bash
git clone https://github.com/YOURNAME/global-markets.git
cd global-markets
npm install
npm start
```

Then open http://localhost:3847 in your browser.

### Optional: set your key via environment variable

If you'd rather not paste the key in the UI every time:

```bash
OPENROUTER_API_KEY=your_key_here npm start
```

### Market data (optional)

Live stock quotes use [Twelve Data](https://twelvedata.com) — also free
tier, also paste-in-the-UI. Without a key, the app runs on realistic
demo data so everything still works and looks right.

### Tech stack

- Vanilla JS + SVG — no frontend framework
- Node.js (`serve.mjs`) — lightweight local proxy
- [OpenRouter](https://openrouter.ai) — free AI API (Llama 3.3)
- [Twelve Data](https://twelvedata.com) — market quotes
- [NewsAPI](https://newsapi.org) — financial headlines
