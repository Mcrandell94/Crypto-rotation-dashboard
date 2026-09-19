// Server-side only — the CoinGecko demo key is used here too.
// Computes real Daily 50/200 EMA for BTC and ETH from daily closes.
//
// The prototype also tracked Weekly 50/200 EMA, but those need far more
// history than this route can get: 50 weeks is ~1 year, 200 weeks is ~4
// years, and CoinGecko's free Demo plan caps historical data at 365 days.
// A "200 EMA" computed off ~52 weekly bars wouldn't be a real 200-period
// EMA (barely past its own seed) — it would just be a mislabeled average.
// Daily EMAs are left out of that problem: 365 daily closes gives a
// 200-period EMA a genuine ~165-day settling window, which is normal and
// solid. So this route only ever returns daily EMAs.

import { COINGECKO_IDS } from '../../lib/coingecko-ids';

const ASSETS = ['BTC', 'ETH'];
const HISTORY_DAYS = 365; // the max the free Demo plan allows
const PERIODS = [50, 200];

function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period; // seed = SMA
  for (let i = period; i < values.length; i++) {
    value = values[i] * k + value * (1 - k);
  }
  return value;
}

async function fetchDailyCloses(symbol, apiKey) {
  const id = COINGECKO_IDS[symbol];
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${HISTORY_DAYS}`;
  const res = await fetch(url, {
    headers: { 'x-cg-demo-api-key': apiKey, Accept: 'application/json' },
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`CoinGecko returned ${res.status} for ${symbol}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  const json = await res.json();
  return (json.prices || []).map(([, price]) => price);
}

export async function GET() {
  const apiKey = process.env.COINGECKO_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINGECKO_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const results = await Promise.allSettled(ASSETS.map((sym) => fetchDailyCloses(sym, apiKey)));

    const assets = {};
    const failed = [];
    results.forEach((r, i) => {
      const sym = ASSETS[i];
      if (r.status !== 'fulfilled') {
        failed.push(sym);
        return;
      }
      const closes = r.value;
      const price = closes[closes.length - 1];
      const emas = Object.fromEntries(PERIODS.map((p) => [`ema${p}`, ema(closes, p)]));
      assets[sym] = {
        price,
        ...emas,
        goldenCross: emas.ema50 != null && emas.ema200 != null ? emas.ema50 > emas.ema200 : null,
        historyDays: closes.length,
      };
    });

    return Response.json({ assets, failed, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
