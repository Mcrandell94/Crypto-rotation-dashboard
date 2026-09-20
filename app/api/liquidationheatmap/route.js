// Server-side. Combines two real, already-used data sources — Kraken's
// keyless OHLC endpoint for BTC price candles, and the Coinglass OI
// endpoint already used elsewhere in this project — to compute a
// synthetic liquidation-clustering estimate ourselves, the same way this
// project computes options max pain from real Deribit data rather than
// pulling a number from a paid aggregator. See app/lib/liquidationHeatmap.js
// for the method and its source.
//
// 4-hour bars: the floor both Kraken's ~720-candle cap and this project's
// Coinglass plan's interval restriction (>=4h on Hobbyist) allow, giving
// roughly 120 days of lookback.

import { PAIRS, fetchCandles } from '../../lib/kraken';
import { runLiquidationHeatmap } from '../../lib/liquidationHeatmap';

export const dynamic = 'force-dynamic';

const BAR_HOURS = 4;
const BAR_MINUTES = BAR_HOURS * 60;
const COINGLASS_BASE = 'https://open-api-v4.coinglass.com/api';

// Buckets a millisecond timestamp to its containing 4-hour boundary, so
// Kraken and Coinglass candles (which may not share an identical phase)
// can be joined on a common key.
function bucketKey(ms) {
  const barMs = BAR_HOURS * 3600 * 1000;
  return Math.floor(ms / barMs) * barMs;
}

async function fetchOiHistory(apiKey) {
  const url = `${COINGLASS_BASE}/futures/open-interest/aggregated-history?symbol=BTC&interval=4h&limit=720`;
  const res = await fetch(url, {
    headers: { 'CG-API-KEY': apiKey, Accept: 'application/json' },
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Coinglass returned ${res.status} for OI history`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  const json = await res.json();
  if (json.code !== '0' && json.code !== 0) {
    const err = new Error(`Coinglass API error: ${json.msg || 'unknown error'}`);
    err.detail = JSON.stringify(json).slice(0, 500);
    throw err;
  }
  const rows = Array.isArray(json.data) ? json.data : [];
  if (rows.length === 0) throw new Error('Coinglass returned no OI history rows');
  return rows;
}

export async function GET() {
  const apiKey = process.env.COINGLASS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINGLASS_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const [priceCandles, oiRows] = await Promise.all([
      fetchCandles(PAIRS.BTC, BAR_MINUTES),
      fetchOiHistory(apiKey),
    ]);

    const priceByBucket = new Map();
    for (const c of priceCandles) {
      const key = bucketKey(Number(c[0]) * 1000);
      priceByBucket.set(key, { close: parseFloat(c[4]), high: parseFloat(c[2]), low: parseFloat(c[3]) });
    }

    const oiByBucket = new Map();
    for (const r of oiRows) {
      const key = bucketKey(Number(r.time));
      const closeOi = Number(r.close);
      if (Number.isFinite(closeOi)) oiByBucket.set(key, closeOi);
    }

    const rows = [...priceByBucket.keys()]
      .filter((key) => oiByBucket.has(key))
      .sort((a, b) => a - b)
      .map((key) => ({ time: key, ...priceByBucket.get(key), closeOi: oiByBucket.get(key) }));

    if (rows.length < 20) {
      return Response.json(
        { error: 'Not enough overlapping price/OI history to compute a heatmap', detail: `${rows.length} aligned bars` },
        { status: 502 }
      );
    }

    const bins = runLiquidationHeatmap(rows, BAR_HOURS);
    const price = rows[rows.length - 1].close;

    const nearestLongCluster = bins
      .filter((b) => b.priceHigh <= price && b.longWeight > 0)
      .sort((a, b) => b.priceHigh - a.priceHigh)[0] || null;
    const nearestShortCluster = bins
      .filter((b) => b.priceLow >= price && b.shortWeight > 0)
      .sort((a, b) => a.priceLow - b.priceLow)[0] || null;

    return Response.json({
      price,
      barHours: BAR_HOURS,
      lookbackDays: Math.round((rows[rows.length - 1].time - rows[0].time) / 86400000),
      bins,
      nearestLongCluster,
      nearestShortCluster,
      source: 'Kraken price + Coinglass aggregated OI, 4-hour bars',
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
