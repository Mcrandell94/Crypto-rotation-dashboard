# Backlog

Ideas agreed on but parked until the page is better organized. Nothing
here is built yet.

## Header: "next event" line
One line in the always-visible header with the nearest scheduled events,
e.g. `CPI in 20d · FOMC in 34d · Markets closed Mon (Columbus Day)`.
All the data already exists: `app/lib/bls-calendar.js` (critical BLS
prints), `app/lib/fomc-calendar.js`, and `app/lib/us-closures.js`
(bank/NYSE closures and early closes).

## "As of" times on every panel
Show how old each panel's data is (CPI from August, funding from 30s ago,
COT from last Friday all look equally "live" today). Most API routes
already return `fetchedAt` or a data date, so this is mostly UI work.

## Release-day mode
On CPI / jobs report / PPI / FOMC days, surface the print and BTC's
reaction first.

## Mobile layout pass
Some panels are desktop-first (long CB Calendar descriptions, wide
tables).

## Data-source health check
One route that checks each provider and reports what's up or down, so a
failing source shows up without someone having to notice it.

## Parked / disabled (code kept, see comments to re-enable)
- **RRG guide link** on the Rotation tab: reverted in PR #37, waiting until
  the guide can be shared publicly.
- **BitcoinCounterFlow heatmap source**: needs `BITCOINCOUNTERFLOW_API_KEY`
  in Vercel (Developer plan). See `app/components/LiquidationHeatmap.js`.
- **Liquidation Zones** (CoinLobster REST 401) and **Taker Flow**
  (Coinglass plan doesn't cover it). See `app/hooks/useLevelsTabData.js`.

## Recurring upkeep
- Paste BLS's 2027 release schedule into `app/lib/bls-calendar.js` when
  it's published (current coverage ends Dec 2026).

## Working notes (for future sessions)
- **Production domain:** `https://crypto-rotation-dashboard-xi.vercel.app`.
  It is NOT public: Vercel Authentication is set to protect all deployments
  (`ssoProtection.deploymentType: "all"`), production included, so only
  logged-in members of the Vercel team can open it. The Vercel connector's
  fetch tool sometimes gets through via a temporary share link, but not
  reliably. Use the bypass header below for any automated check,
  production or preview.
- **Checking deployments (production or a branch preview):** the project has a Protection
  Bypass for Automation secret. It's stored in the Claude environment's
  settings as `VERCEL_AUTOMATION_BYPASS_SECRET`, with `*.vercel.app` allowed
  under Network access. Send it as the `x-vercel-protection-bypass` header on
  requests to any deployment URL. Never print it or commit it. Environment settings
  only load when a session starts, so a session opened before they were added
  won't see them. If the secret leaks, regenerate it in Vercel → Deployment
  Protection.
- **Logs:** production runtime logs are readable through the Vercel connector
  (team `onchain4`). Each request line shows `cache=HIT/MISS/STALE`.
