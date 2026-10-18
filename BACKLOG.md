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
- **Taker Flow** (Coinglass plan doesn't cover it). See
  `app/hooks/useLevelsTabData.js`.

## Recurring upkeep
- The Liquidation Levels Tracker's 1-Day to 1-Year horizons are
  hand-read from Datawallet heatmap screenshots (last set 2026-10-18).
  Re-read them when new screenshots come in; the Live horizon updates
  itself from LiqWall.
- 2027's CPI, PPI and jobs-report dates come from OMB's federal schedule
  (October 2026). When BLS posts its own 2027 calendar
  (bls.gov/schedule/), check them against it and add the other BLS
  releases if wanted. Coverage ends Dec 2027; add 2028 when it's out.

## Working notes (for future sessions)
- **Production domain:** `https://crypto-rotation-dashboard-xi.vercel.app`
  is public (no login). This is the link shared with friends helping out.
  Vercel Authentication is on Standard Protection
  (`ssoProtection.deploymentType: "prod_deployment_urls_and_all_previews"`,
  set 2026-09-24), so production domains are open to anyone with the link,
  while branch previews and per-deployment URLs
  (`…-<hash>-onchain4.vercel.app`) still require a Vercel login. To make it
  private again, set Vercel Authentication back to All Deployments.
- **Checking a branch preview (or a per-deployment URL):** the project has a Protection
  Bypass for Automation secret. It's stored in the Claude environment's
  settings as `VERCEL_AUTOMATION_BYPASS_SECRET`, with `*.vercel.app` allowed
  under Network access. Send it as the `x-vercel-protection-bypass` header on
  requests to any deployment URL. Never print it or commit it. Environment settings
  only load when a session starts, so a session opened before they were added
  won't see them. If the secret leaks, regenerate it in Vercel → Deployment
  Protection.
- **Logs:** production runtime logs are readable through the Vercel connector
  (team `onchain4`). Each request line shows `cache=HIT/MISS/STALE`.
