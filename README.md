# Crypto Rotation Dashboard — Live Data Migration

A minimal, working slice proving the real pipeline: your browser → a secure server route →
CoinMarketCap → back to the browser. Your API key never touches the client.

## What's in here right now

- `app/api/crypto/route.js` — the server-side route that calls CoinMarketCap for live quotes.
- `app/api/rrg/route.js` — the server-side route that calls CoinGecko for historical prices and
  computes each asset's Relative Rotation Graph position (RS-Ratio / RS-Momentum vs BTC).
  These two files are the only places your API keys are ever touched.
- `app/page.js` — the page that displays live BTC/ETH/SOL/SUI/LINK prices, market cap, and
  24h/7d change.
- `app/components/RotationChart.js` — momentum ranking bar chart, ranked by 7-day change.
- `app/components/RelativeRotationGraph.js` — the real RRG: a quadrant scatter (RS-Ratio vs
  RS-Momentum) with a trailing tail per asset, benchmarked against BTC.
- `app/layout.js` — required Next.js boilerplate, sets the page title and base styling.

This is intentionally small. Once you confirm it's live and working, we expand it panel by
panel — AI Vibe scoring, liquidation levels, etc. — pulling each one over from the original
single-file prototype.

## What you need to do (steps only you can do — account creation and secrets)

### 1. Get this code into a GitHub repo
- Create a free GitHub account if you don't have one: github.com
- Create a new empty repository (e.g. `crypto-rotation-dashboard`)
- Either:
  - Open this folder in Claude Code and ask it to initialize git, commit, and push to that repo, or
  - Manually: `git init`, `git add .`, `git commit -m "initial pipeline"`, then follow GitHub's
    instructions for pushing an existing folder to a new repo

### 2. Create a Vercel account and import the repo
- Free account at vercel.com, sign in with your GitHub account (easiest option — one click)
- Click "Add New Project," select your `crypto-rotation-dashboard` repo
- Vercel auto-detects it's a Next.js app — no configuration needed

### 3. Add your API keys — in Vercel, not in the code
- In the Vercel project: Settings > Environment Variables
- Add `CMC_API_KEY` = your real CoinMarketCap key
- Add `COINGECKO_API_KEY` = a free Demo key from coingecko.com (Developer Dashboard) — this
  powers the Relative Rotation Graph's historical data
- Apply both to all environments (Production, Preview, Development)

### 4. Deploy
- Vercel deploys automatically the moment you connect the repo
- After adding the environment variable, trigger one more deploy (Vercel's dashboard has a
  "Redeploy" button) so the new key is picked up

### 5. Test locally first (optional but recommended)
```
npm install
cp .env.local.example .env.local
# edit .env.local, paste your real keys in
npm run dev
```
Then open http://localhost:3000 — you should see live prices. This confirms everything works
before it's public.

## After this is live

Come back and we'll port over the next piece of the original dashboard — AI Market Vibe scoring
and liquidation levels are next up. Liquidation levels need a Coinglass subscription (their free
tier only covers recent liquidation events, not true price-level heatmaps — the Professional tier
is needed for that).
