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
