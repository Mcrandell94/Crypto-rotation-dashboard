// Server-side. A third source for the same liquidation-cluster panel —
// unlike the other two (which MODEL clusters from real price+OI data),
// this one is BitcoinCounterFlow's own real, vendor-computed liquidation
// heatmap, confirmed available on the account's "Developer" plan ($29/mo)
// per BCF's own in-account API docs (screenshotted directly, since
// bitcoincounterflow.com itself is unreachable from this sandbox like
// most providers hit so far):
//   GET https://api.bitcoincounterflow.com/api/liquidation-heatmap
//     ?apikey=...&days=120&interval=4h
//
// The exact response field names weren't visible in what was
// screenshotted (only the request side of the docs page was shown), so
// parsing here tries the shapes real liquidation-heatmap vendors in this
// space are known to use — most concretely, Bitbo's own published example
// response, `{ data: [[price_bucket, long_intensity, short_intensity], ...] }`
// with 0-1 normalized intensities — and fails loudly with a raw response
// sample if none match, rather than silently rendering something broken.

import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://api.bitcoincounterflow.com/api';

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
  }
  return null;
}

// Normalizes whatever shape comes back into [{ price, long, short }, ...].
function parseRows(json) {
  const data = json?.data ?? json;

  if (Array.isArray(data) && Array.isArray(data[0])) {
    // [[price, longIntensity, shortIntensity], ...]
    return data
      .map((row) => ({ price: Number(row[0]), long: Number(row[1]) || 0, short: Number(row[2]) || 0 }))
      .filter((r) => Number.isFinite(r.price));
  }

  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    return data
      .map((r) => ({
        price: Number(pick(r, ['price', 'price_bucket', 'priceBucket', 'level'])),
        long: Number(pick(r, ['long_intensity', 'longIntensity', 'long', 'longs']) ?? 0),
        short: Number(pick(r, ['short_intensity', 'shortIntensity', 'short', 'shorts']) ?? 0),
      }))
      .filter((r) => Number.isFinite(r.price));
  }

  // Coinglass model2-style: { y_axis: [...], liquidation_leverage_data: [[binIndex, ?, value], ...] }
  if (Array.isArray(data?.y_axis) && Array.isArray(data?.liquidation_leverage_data)) {
    return data.liquidation_leverage_data
      .map(([binIndex, , value]) => {
        const price = data.y_axis[binIndex];
        return price != null ? { price: Number(price), long: Number(value) || 0, short: 0 } : null;
      })
      .filter(Boolean);
  }

  return null;
}

async function handler() {
  const apiKey = process.env.BITCOINCOUNTERFLOW_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'BITCOINCOUNTERFLOW_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const url = `${BASE_URL}/liquidation-heatmap?apikey=${apiKey}&days=120&interval=4h`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 900 } });
    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `BitcoinCounterFlow returned ${res.status}`, detail: detail.slice(0, 500) }, { status: res.status });
    }

    const json = await res.json();
    const rows = parseRows(json);
    if (!rows || rows.length === 0) {
      const detail = JSON.stringify(json).slice(0, 800);
      return Response.json(
        { error: `BitcoinCounterFlow's liquidation-heatmap response didn't match any known field shape. Raw sample: ${detail}`, detail },
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
    // bucket range as a stand-in center line, same as the modeled sources
    // use their own last-close price.
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
      weightUnit: 'intensity',
      source: "BitcoinCounterFlow's own liquidation heatmap (vendor-computed, not modeled here)",
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}

export const GET = withCdnCache(handler, 900);
