// Server-side, but no secret involved — Polymarket's Gamma API is fully
// public and keyless, same endpoint the existing /api/polymarket route
// uses for BTC price-target markets. This one instead looks for the
// active "Fed decision" market — real, market-implied probabilities for
// the next FOMC outcome (hold / 25bp hike / 25bp cut / etc.), used by the
// CB Calendar instead of a hand-guessed forward probability.
//
// Polymarket structures Fed-decision markets as one event with several
// outcome tokens (one per possible decision, e.g. "No Change", "25 bps
// decrease", "50+ bps decrease"), not a single Yes/No — so every outcome
// and its live price is returned, not just one side.

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

// Same Gamma API quirk as /api/polymarket: outcomes/outcomePrices arrive
// as JSON-stringified arrays.
function parseOutcomes(market) {
  try {
    const outcomes = JSON.parse(market.outcomes || '[]');
    const prices = JSON.parse(market.outcomePrices || '[]');
    return outcomes
      .map((label, i) => ({ label, pct: Math.round(parseFloat(prices[i]) * 1000) / 10 }))
      .filter((o) => Number.isFinite(o.pct));
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const events = await fetchEvents();
    const candidates = events.filter((e) => isFedDecisionEvent(e.title));

    if (candidates.length === 0) {
      return Response.json({ market: null, fetchedAt: new Date().toISOString() });
    }

    const event = candidates[0];
    const market = (event.markets || [])[0];
    if (!market) {
      const detail = JSON.stringify(event).slice(0, 500);
      return Response.json(
        { error: "Found a Fed decision event but it carried no market data. Raw sample: " + detail, detail },
        { status: 502 }
      );
    }

    const outcomes = parseOutcomes(market).sort((a, b) => b.pct - a.pct);
    if (outcomes.length === 0) {
      const detail = JSON.stringify(market).slice(0, 500);
      return Response.json(
        { error: "Fed decision market's outcomes didn't match the expected shape. Raw sample: " + detail, detail },
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
