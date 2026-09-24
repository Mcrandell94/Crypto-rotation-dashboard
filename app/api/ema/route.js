// Server-side, but no secret involved — Kraken's public OHLC endpoint is
// fully keyless. Computes real Daily and Weekly 50/200 EMA for BTC and ETH.
//
// Previously used CoinGecko, capped at 365 days of history — enough for a
// solid Daily 200 EMA but nowhere near enough for Weekly (200 weeks is ~4
// years), so Weekly EMA was left out rather than shipped badly converged.
// Kraken's OHLC endpoint returns up to 720 of the most recent candles
// *regardless of interval* (verified against Kraken's own docs), so a
// weekly request alone gets ~13.8 years of history — comfortably enough
// for both Daily and Weekly 200 EMA. Switching sources also matches this
// panel to whatever real exchange price series Kraken quotes, rather than
// CoinGecko's cross-exchange aggregate, which is one likely source of any
// mismatch against a chart pinned to a specific exchange.

import { PAIRS, fetchCandles } from '../../lib/kraken';
import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

const TIMEFRAMES = [
  { key: 'daily', minutes: 1440 },
  { key: 'weekly', minutes: 10080 },
];
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

async function handler() {
  try {
    const assets = {};
    const failed = [];

    for (const [sym, pair] of Object.entries(PAIRS)) {
      assets[sym] = { price: null };
      for (const { key, minutes } of TIMEFRAMES) {
        try {
          const candles = await fetchCandles(pair, minutes);
          const closes = candles.map((c) => parseFloat(c[4]));
          const price = closes[closes.length - 1];
          const emas = Object.fromEntries(PERIODS.map((p) => [`ema${p}`, ema(closes, p)]));
          assets[sym].price = price;
          assets[sym][key] = {
            ...emas,
            goldenCross: emas.ema50 != null && emas.ema200 != null ? emas.ema50 > emas.ema200 : null,
            historyPoints: closes.length,
          };
        } catch (e) {
          failed.push(`${sym} ${key}`);
        }
      }
    }

    return Response.json({ assets, failed, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}

export const GET = withCdnCache(handler, 300);
