// Server-side, no secret — Kalshi's market data is public and keyless
// (api.elections.kalshi.com serves every Kalshi market, not just
// elections). Market-implied odds for the next CPI and PPI prints, shown on
// the CB Calendar next to each release the way the Fed odds sit next to
// the FOMC meeting.
//
// Polymarket runs US CPI markets too but no PPI ones, so Kalshi covers
// both. Series verified live on 2026-10-11: KXCPI (headline m/m), KXCPIYOY,
// KXCPICORE (core m/m), KXUSPPI (PPI m/m), KXUSPPIYOY. Each event is one
// release's ladder of "Above X%" markets; see app/lib/inflationOdds for
// how a ladder is read, and why a thin one is reported instead.

import { withCdnCache } from '../../lib/cdnCache';
import { readLadder, nextEvent } from '../../lib/inflationOdds';

export const dynamic = 'force-dynamic';

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

const RELEASES = {
  cpi: [
    { label: 'm/m', series: 'KXCPI' },
    { label: 'y/y', series: 'KXCPIYOY' },
    { label: 'core m/m', series: 'KXCPICORE' },
  ],
  ppi: [
    { label: 'm/m', series: 'KXUSPPI' },
    { label: 'y/y', series: 'KXUSPPIYOY' },
  ],
};

async function readMeasure({ label, series }, now) {
  try {
    const url = `${KALSHI_BASE}/events?series_ticker=${series}&status=open&with_nested_markets=true&limit=12`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
    if (!res.ok) {
      const detail = await res.text();
      return { label, series, error: `Kalshi returned ${res.status} for ${series}: ${detail.slice(0, 200)}` };
    }
    const json = await res.json();
    if (!Array.isArray(json.events)) {
      return { label, series, error: `Kalshi's ${series} response had no events list. Raw sample: ${JSON.stringify(json).slice(0, 300)}` };
    }
    const next = nextEvent(json.events, now);
    if (!next) return { label, series, readable: false, reason: 'no-market' };
    return {
      label,
      series,
      event: next.e.event_ticker,
      title: next.e.title,
      closeTime: new Date(next.close).toISOString(),
      ...readLadder(next.e.markets),
    };
  } catch (err) {
    return { label, series, error: `${series}: ${err.message || String(err)}` };
  }
}

async function handler() {
  const now = Date.now();
  const entries = await Promise.all(
    Object.entries(RELEASES).map(async ([key, measures]) => {
      const results = await Promise.all(measures.map((m) => readMeasure(m, now)));
      const closes = results.map((r) => Date.parse(r.closeTime)).filter(Number.isFinite);
      return [key, { closeTime: closes.length ? new Date(Math.min(...closes)).toISOString() : null, measures: results }];
    })
  );
  const releases = Object.fromEntries(entries);

  const all = Object.values(releases).flatMap((r) => r.measures);
  if (all.every((m) => m.error)) {
    return Response.json(
      { error: `Kalshi lookup failed for every CPI/PPI series: ${all.map((m) => m.error).join(' | ').slice(0, 600)}` },
      { status: 502 }
    );
  }
  // Top-level, so lib/cdnCache doesn't hold a partial failure at the edge.
  const measuresFailed = all.filter((m) => m.error).map((m) => m.series);
  return Response.json({ releases, measuresFailed, source: 'Kalshi', fetchedAt: new Date().toISOString() });
}

export const GET = withCdnCache(handler, 300);
