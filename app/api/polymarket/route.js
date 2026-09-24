// Server-side, but no secret involved — Polymarket's Gamma API is fully
// public and keyless. Finds the current Bitcoin price-target markets across
// four timeframes (daily/weekly/monthly/year-end) and returns each
// threshold's live implied probability (its "Yes"/"Up" token price, which
// is literally what traders are paying for that outcome).
//
// Polymarket runs these as dated events with human-written titles rather
// than a stable machine-readable "timeframe" field (e.g. "What price will
// Bitcoin hit in February 2026?", "Bitcoin above $X on Sep 20?", "Bitcoin
// Up or Down on May 15"), so this classifies by the same title patterns
// Polymarket's own site groups them under. There's no dedicated
// search-by-timeframe endpoint — Polymarket's own reference agent code
// fetches broadly by tag and filters client-side the same way.

import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const CRYPTO_TAG_ID = 21; // confirmed production tag id for the Crypto category

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function isBitcoinOnly(title) {
  const t = title.toLowerCase();
  if (!t.includes('bitcoin') && !/\bbtc\b/.test(t)) return false;
  // The broad Crypto tag also carries other coins' versions of the same
  // question format — exclude anything that names another asset too.
  return !/ethereum|\beth\b|solana|\bsol\b|xrp|dogecoin|\bdoge\b/.test(t);
}

function classify(rawTitle) {
  const t = rawTitle.toLowerCase().trim();
  if (/hit (before|in) \d{4}\??$/.test(t)) return 'yearly';
  if (MONTH_NAMES.some((m) => t.includes(`hit in ${m}`))) return 'monthly';
  if (/hit .*\d{1,2}\s*[-–]\s*\d{1,2}/.test(t)) return 'weekly'; // e.g. "hit September 14-20"
  if (/bitcoin above \$?[\d,]+ on /.test(t)) return 'daily';
  if (/up or down/.test(t) && !/\d{1,2}(:\d{2})?\s*(am|pm)\s*-/.test(t)) return 'daily'; // exclude the 5m/15m variants, which carry a time range
  return null;
}

async function fetchEvents() {
  const url = `${GAMMA_BASE}/events?tag_id=${CRYPTO_TAG_ID}&closed=false&active=true&order=volume24hr&ascending=false&limit=150`;
  const res = await fetch(url, { next: { revalidate: 120 } });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Polymarket returned ${res.status}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return res.json();
}

function thresholdValue(label) {
  const n = parseFloat(String(label).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// A market's `outcomes`/`outcomePrices` come back as JSON-stringified
// arrays (e.g. '["Yes","No"]' / '["0.81","0.19"]') — a documented Gamma API
// quirk, not a formatting choice made here.
function parseMarket(market) {
  let outcomes;
  let prices;
  try {
    outcomes = JSON.parse(market.outcomes || '[]');
    prices = JSON.parse(market.outcomePrices || '[]');
  } catch {
    return null;
  }
  const idx = outcomes.findIndex((o) => /^(yes|up)$/i.test(o));
  if (idx === -1 || prices[idx] == null) return null;
  const pct = Math.round(parseFloat(prices[idx]) * 1000) / 10;
  if (!Number.isFinite(pct)) return null;
  return { label: market.groupItemTitle || market.question, outcome: outcomes[idx], pct };
}

async function handler() {
  try {
    const events = await fetchEvents();
    const buckets = { daily: null, weekly: null, monthly: null, yearly: null };

    for (const ev of events) {
      if (!isBitcoinOnly(ev.title || '')) continue;
      const bucket = classify(ev.title || '');
      if (!bucket || buckets[bucket]) continue; // first hit wins — events arrive sorted by volume desc

      let thresholds = (ev.markets || [])
        .map(parseMarket)
        .filter(Boolean)
        .sort((a, b) => thresholdValue(a.label) - thresholdValue(b.label));

      // Ladder-style events (weekly/monthly/yearly) carry dozens of price
      // brackets, most already decided one way or the other once the price
      // has moved past them (pinned at ~100% or ~0%) — real data, but not
      // forward-looking. Keep only the part of the ladder still genuinely
      // undecided, capped to a handful closest to the coin-flip line, since
      // that's the only part that's actually a live prediction rather than
      // settled history. The single-market daily Up/Down bucket has no
      // ladder to condense, so it's left alone regardless of how lopsided
      // it is.
      if (thresholds.length > 1) {
        const live = thresholds.filter((t) => t.pct > 1 && t.pct < 99);
        thresholds = (live.length > 6
          ? [...live].sort((a, b) => Math.abs(a.pct - 50) - Math.abs(b.pct - 50)).slice(0, 6)
          : live
        ).sort((a, b) => thresholdValue(a.label) - thresholdValue(b.label));
      }

      if (thresholds.length === 0) continue;

      buckets[bucket] = { title: ev.title, slug: ev.slug, endDate: ev.endDate, thresholds };
    }

    const missing = Object.keys(buckets).filter((k) => !buckets[k]);
    return Response.json({ buckets, missing, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}

export const GET = withCdnCache(handler, 120);
