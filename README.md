# Crypto Rotation Dashboard — Live Data Migration

A minimal, working slice proving the real pipeline: your browser → a secure server route →
CoinMarketCap → back to the browser. Your API key never touches the client.

## What's in here right now

- `app/api/crypto/route.js` — the server-side route that calls CoinMarketCap. This is the
  ONLY file that ever touches your API key.
- `app/page.js` — the page that displays live BTC/ETH/SOL/SUI/LINK prices, market cap, and
  24h/7d change.
- `app/layout.js` — required Next.js boilerplate, sets the page title and base styling.

This is intentionally small. Once you confirm it's live and working, we expand it panel by
panel — rotation chart, AI Vibe scoring, liquidation levels, etc. — pulling each one over from
the original single-file prototype.

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

### 3. Add your API key — in Vercel, not in the code
- In the Vercel project: Settings > Environment Variables
- Add a variable named exactly `CMC_API_KEY`, value = your real CoinMarketCap key
- Apply it to all environments (Production, Preview, Development)

### 4. Deploy
- Vercel deploys automatically the moment you connect the repo
- After adding the environment variable, trigger one more deploy (Vercel's dashboard has a
  "Redeploy" button) so the new key is picked up

### 5. Test locally first (optional but recommended)
```
npm install
cp .env.local.example .env.local
# edit .env.local, paste your real key in
npm run dev
```
Then open http://localhost:3000 — you should see live prices. This confirms everything works
before it's public.

## After this is live

Come back and we'll port over the next piece of the original dashboard — tell me which panel
matters most to see live first (Rotation chart? AI Market Vibe? Liquidation levels?) and whether
you want to add another data source (Coinglass, FRED, etc.) alongside CoinMarketCap yet.
