// Server-side, but no secret involved — Polymarket's Gamma API is fully
// public and keyless, same endpoint the existing /api/polymarket route
// uses for BTC price-target markets. This one instead looks for the
// active "Fed decision" market — real, market-implied probabilities for
// the next FOMC outcome (hold / 25bp hike / 25bp cut / etc.), used by the
// CB Calendar instead of a hand-guessed forward probability.
//
// Polymarket structures a Fed-decision event as several binary Yes/No
// markets, one per possible decision ("No change", "25 bps decrease", ...),
// each labeled by its `groupItemTitle` (the same field /api/polymarket
// reads for its price ladders). Each decision's probability is its
// market's "Yes" price. Reading only the first market (the original
// version) returned a bare "No 99.8% / Yes 0.3%" with no decision named.

import { withCdnCache } from '../../lib/cdnCache';
import { decisionOutcomes } from '../../lib/fedOdds';

export const dynamic = 'force-dynamic';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';

function isFedDecisionEvent(title) {
  const t = (title || '').toLowerCase();
  return /\bfed\b|federal reserve|\bfomc\b/.test(t) && /rate|decision|hike|cut|bps|basis point/.test(t);
}

async function fetchEvents() {
  const url = `${GAMMA_BASE}/events?closed=false&active=true&order=volume24hr&ascending=false&limit=100`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Polymarket returned ${res.status}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return res.json();
}

async function handler() {
  try {
    const events = await fetchEvents();
    const candidates = events.filter((e) => isFedDecisionEvent(e.title));

    if (candidates.length === 0) {
      return Response.json({ market: null, fetchedAt: new Date().toISOString() });
    }

    // The next meeting: the soonest-resolving open Fed decision event.
    const now = Date.now();
    const event = [...candidates]
      .filter((e) => !e.endDate || Date.parse(e.endDate) > now)
      .sort((a, b) => Date.parse(a.endDate || 0) - Date.parse(b.endDate || 0))[0] || candidates[0];

    const outcomes = decisionOutcomes(event.markets);
    if (outcomes.length === 0) {
      const detail = JSON.stringify(event.markets || event).slice(0, 500);
      return Response.json(
        { error: "Found a Fed decision event but couldn't read a Yes price for any of its decision markets. Raw sample: " + detail, detail },
        { status: 502 }
      );
    }

    return Response.json({
      market: { title: event.title, slug: event.slug, endDate: event.endDate, outcomes },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}

export const GET = withCdnCache(handler, 300);
