// Server-side. A fourth source for the same liquidation-cluster panel —
// OpenMarket.xyz's own vendor-computed liquidation heatmap (like
// BitcoinCounterFlow, not modeled here), but genuinely free: their
// published Free tier (10 weight/min) explicitly lists "heatmaps &
// profiles" and "liquidation tracking" among its included features, with
// 7 days of history.
//
// openmarket.xyz/docs and openmarket.xyz/docs/quickstart are both
// unreachable from this sandbox like most providers hit so far, so the
// endpoint below was verified against OpenMarket's own published blog
// post ("Real-Time Liquidation Heatmaps for Hyperliquid") and API
// overview page, which give this concrete, working example request:
//   GET https://api.openmarket.xyz/v1/points
//     ?type=HYPERLIQUID_LIQUIDATION_AGG&coin=BTC&interval=HOUR
//     &from=<unix seconds>&period=3600&transform.normalize.quote=USD
//   Header: X-OpenMarket-Key: <key>
//
// IMPORTANT CAVEAT: this specific documented type is scoped to
// Hyperliquid's own order book, not aggregated across every exchange the
// way Coinglass's heatmap is — that's the only concretely-confirmed
// example request found, so it's what's used here; the UI labels it
// accordingly rather than implying cross-exchange coverage.
//
// The exact response JSON shape was NOT independently confirmed (docs
// blocked) — parsing below tries several plausible layouts and fails
// loudly with a raw response sample if none match, per this project's
// established pattern, so a live screenshot of the failure can be used
// to correct the parsing precisely.

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://api.openmarket.xyz/v1';
const LOOKBACK_DAYS = 6;

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
  }
  return null;
}

// Normalizes whatever shape comes back into a flat array of raw points.
function extractPoints(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.points)) return json.points;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.series)) {
    // Each series entry may itself carry a nested points array.
    const flattened = json.series.flatMap((s) => (Array.isArray(s?.points) ? s.points : Array.isArray(s?.data) ? s.data : []));
    if (flattened.length > 0) return flattened;
  }
  return null;
}

// Normalizes a raw point into { price, long, short }, trying several
// plausible field-name variants since the exact schema isn't confirmed.
function parsePoint(p) {
  if (!p || typeof p !== 'object') return null;
  const price = Number(pick(p, ['price', 'priceLevel', 'level', 'bucket', 'p', 'x']));
  if (!Number.isFinite(price)) return null;
  const long = Number(pick(p, ['long', 'longUsd', 'longNotional', 'buy', 'buyNotional', 'bid']) ?? 0) || 0;
  const short = Number(pick(p, ['short', 'shortUsd', 'shortNotional', 'sell', 'sellNotional', 'ask']) ?? 0) || 0;
  if (long === 0 && short === 0) {
    // Some heatmap schemas report one undirected intensity per bucket.
    const v = Number(pick(p, ['value', 'notional', 'intensity', 'y']) ?? 0) || 0;
    if (v === 0) return null;
    return { price, long: v, short: 0 };
  }
  return { price, long, short };
}

export async function GET() {
  const apiKey = process.env.OPENMARKET_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'OPENMARKET_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const from = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 3600;
    const params = new URLSearchParams({
      type: 'HYPERLIQUID_LIQUIDATION_AGG',
      coin: 'BTC',
      interval: 'HOUR',
      from: String(from),
      period: '3600',
      'transform.normalize.quote': 'USD',
    });
    const res = await fetch(`${BASE_URL}/points?${params.toString()}`, {
      headers: { 'X-OpenMarket-Key': apiKey, Accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      const detail = await res.text();
      return Response.json(
        { error: `OpenMarket returned ${res.status}. Raw response: ${detail.slice(0, 500)}`, detail: detail.slice(0, 500) },
        { status: res.status }
      );
    }

    const json = await res.json();
    const rawPoints = extractPoints(json);
    if (!rawPoints) {
      const detail = JSON.stringify(json).slice(0, 800);
      return Response.json(
        { error: `OpenMarket's liquidation-heatmap response didn't match any known field shape. Raw sample: ${detail}`, detail },
        { status: 502 }
      );
    }

    const rows = rawPoints.map(parsePoint).filter(Boolean);
    if (rows.length === 0) {
      const detail = JSON.stringify(rawPoints[0]).slice(0, 500);
      return Response.json(
        { error: `OpenMarket's liquidation-heatmap points didn't match any known field shape. Raw sample: ${detail}`, detail },
        { status: 502 }
      );
    }

    rows.sort((a, b) => a.price - b.price);
    // Bucket width: the median gap between consecutive price points, so
    // each point becomes a bucket spanning halfway to its neighbors.
    const gaps = rows.slice(1).map((r, i) => r.price - rows[i].price).filter((g) => g > 0).sort((a, b) => a - b);
    const bucketWidth = gaps.length ? gaps[Math.floor(gaps.length / 2)] : Math.max(1, rows[rows.length - 1].price * 0.002);

    const bins = rows.map((r) => ({
      priceLow: r.price - bucketWidth / 2,
      priceHigh: r.price + bucketWidth / 2,
      longWeight: r.long,
      shortWeight: r.short,
    }));

    // No explicit spot price in this endpoint — use the midpoint of the
    // bucket range as a stand-in center line, same as the BCF source does.
    const price = rows[Math.floor(rows.length / 2)].price;

    const nearestLongCluster = bins
      .filter((b) => b.priceHigh <= price && b.longWeight > 0)
      .sort((a, b) => b.priceHigh - a.priceHigh)[0] || null;
    const nearestShortCluster = bins
      .filter((b) => b.priceLow >= price && b.shortWeight > 0)
      .sort((a, b) => a.priceLow - b.priceLow)[0] || null;

    return Response.json({
      price,
      bins,
      nearestLongCluster,
      nearestShortCluster,
      weightUnit: 'usd',
      lookbackDays: LOOKBACK_DAYS,
      source: "OpenMarket's own liquidation heatmap — Hyperliquid BTC perpetuals only, not aggregated across exchanges",
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
