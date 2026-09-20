// Server-side. Same liquidation-clustering model as
// app/api/liquidationheatmap/route.js (see app/lib/liquidationHeatmap.js
// for the method), but sourced from Coinalyze — the exact data provider
// the original open-source project this method was adapted from
// (github.com/minchillo4/btc-liquidation-heatmap) was built around, read
// directly from its source since it publishes no docs site. Coinalyze is
// free (a 40 req/min rate limit, no paid tier), so this runs on real
// hourly bars aggregated across the same 12 BTC perpetual venues the
// original project used, rather than the 4-hour-bar workaround the other
// route needed to fit Kraken's candle cap and this project's Coinglass
// plan's interval floor. Kept as a separate, toggleable source rather
// than replacing the other route, since they're genuinely different
// inputs (different venues, different bar size) and can disagree.

import { runLiquidationHeatmap } from '../../lib/liquidationHeatmap';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://api.coinalyze.net/v1';
const PRICE_SYMBOL = 'BTCUSDT_PERP.A';
const OI_SYMBOLS = [
  'BTCUSDT.6', 'BTCUSDT_PERP.A', 'BTCBUSD_PERP.A', 'PERP_BTC_USDT.W',
  'BTCUSDT_PERP.4', 'BTCUSDC_PERP.3', 'BTCUSDT_PERP.3', 'BTC_USDT.Y',
  'BTC_USDC-PERPETUAL.2', 'BTCUSDT_PERP.F', 'uBTCUSD.7', 'BTC-USD.8',
].join(',');
const LOOKBACK_DAYS = 90; // within Coinalyze's ~60-80 day hourly retention window, with a small cushion

async function fetchHistory(url, params, apiKey) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${url}?${qs}`, {
    headers: { api_key: apiKey, Accept: 'application/json' },
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Coinalyze returned ${res.status} for ${url}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return res.json();
}

export async function GET() {
  const apiKey = process.env.COINALYZE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINALYZE_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - LOOKBACK_DAYS * 86400;
    const common = { interval: '1hour', from: String(from), to: String(to) };

    const [priceJson, oiJson] = await Promise.all([
      fetchHistory(`${BASE_URL}/ohlcv-history`, { symbols: PRICE_SYMBOL, ...common }, apiKey),
      fetchHistory(`${BASE_URL}/open-interest-history`, { symbols: OI_SYMBOLS, ...common }, apiKey),
    ]);

    const priceHistory = priceJson?.[0]?.history;
    if (!Array.isArray(priceHistory) || priceHistory.length === 0) {
      return Response.json({ error: 'Coinalyze returned no price history', detail: JSON.stringify(priceJson).slice(0, 500) }, { status: 502 });
    }
    if (!Array.isArray(oiJson) || oiJson.length === 0) {
      return Response.json({ error: 'Coinalyze returned no open interest history', detail: JSON.stringify(oiJson).slice(0, 500) }, { status: 502 });
    }

    const priceByTime = new Map();
    for (const c of priceHistory) {
      priceByTime.set(c.t, { close: Number(c.c), high: Number(c.h), low: Number(c.l) });
    }

    // Sum open interest across every venue at each shared hourly timestamp
    // — same aggregation the original project does.
    const oiByTime = new Map();
    for (const symbolSeries of oiJson) {
      for (const point of symbolSeries.history || []) {
        oiByTime.set(point.t, (oiByTime.get(point.t) || 0) + Number(point.c));
      }
    }

    const rows = [...priceByTime.keys()]
      .filter((t) => oiByTime.has(t))
      .sort((a, b) => a - b)
      .map((t) => ({ time: t * 1000, ...priceByTime.get(t), closeOi: oiByTime.get(t) }));

    if (rows.length < 20) {
      return Response.json(
        { error: 'Not enough overlapping price/OI history to compute a heatmap', detail: `${rows.length} aligned bars` },
        { status: 502 }
      );
    }

    const bins = runLiquidationHeatmap(rows, 1);
    const price = rows[rows.length - 1].close;

    const nearestLongCluster = bins
      .filter((b) => b.priceHigh <= price && b.longWeight > 0)
      .sort((a, b) => b.priceHigh - a.priceHigh)[0] || null;
    const nearestShortCluster = bins
      .filter((b) => b.priceLow >= price && b.shortWeight > 0)
      .sort((a, b) => a.priceLow - b.priceLow)[0] || null;

    return Response.json({
      price,
      barHours: 1,
      lookbackDays: Math.round((rows[rows.length - 1].time - rows[0].time) / 86400000),
      bins,
      nearestLongCluster,
      nearestShortCluster,
      source: 'Coinalyze — 12 aggregated BTC perpetual venues, hourly bars',
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
