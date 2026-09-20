// Server-side, but no secret involved — Kraken's public OHLC endpoint is
// fully keyless (no account or API key needed for market data reads).
//
// Replaces the prototype's hand-entered TradingView RSI/MACD readings with
// values computed live from real candles. The prototype's 4th field
// ("vs MAs") was explicitly flagged in its own comments as an *inferred
// guess*, not a real chart read — here it's a real price-vs-50-SMA
// comparison instead, which is strictly more accurate than what it replaces.

// No searchParams here (unlike the other routes), so without this Next.js
// would statically optimize the route at build time and bake in whatever
// Kraken returned during that one build — never refetching live.
export const dynamic = 'force-dynamic';

const KRAKEN_BASE = 'https://api.kraken.com/0/public/OHLC';

// Kraken's REST aliases for BTC/USD and ETH/USD. The response comes back
// keyed under Kraken's *internal* pair name (e.g. XXBTZUSD), which doesn't
// necessarily match what you requested — never assume the key, always find
// it defensively (see parseOhlc below).
const PAIRS = { BTC: 'XBTUSD', ETH: 'ETHUSD' };
const INTERVALS = [
  { key: '15m', minutes: 15 },
  { key: '4h', minutes: 240 },
  { key: '1d', minutes: 1440 },
];

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += -diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function emaSeries(values, period) {
  const k = 2 / (period + 1);
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = emaSeries(closes, fast);
  const emaSlow = emaSeries(closes, slow);
  const macdValid = closes
    .map((_, i) => (emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null))
    .filter((v) => v != null);
  if (macdValid.length < signalPeriod) return { histogram: null };
  const signalSeries = emaSeries(macdValid, signalPeriod);
  const lastMacd = macdValid[macdValid.length - 1];
  const lastSignal = signalSeries[signalSeries.length - 1];
  return { histogram: lastMacd - lastSignal };
}

function sma(values, period) {
  if (values.length < period) return null;
  const s = values.slice(-period);
  return s.reduce((a, b) => a + b, 0) / s.length;
}

// Kraken keys the OHLC result by its own internal pair name, which can
// differ from the requested pair (e.g. request "XBTUSD", get back
// "XXBTZUSD") — find the data key defensively rather than assuming it.
function parseOhlc(result) {
  const key = Object.keys(result).find((k) => k !== 'last');
  return key ? result[key] : null;
}

async function fetchCandles(pair, minutes) {
  const url = `${KRAKEN_BASE}?pair=${pair}&interval=${minutes}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Kraken returned ${res.status} for ${pair}@${minutes}m`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  const json = await res.json();
  if (json.error?.length) {
    const err = new Error(`Kraken error for ${pair}@${minutes}m: ${json.error.join(', ')}`);
    err.status = 502;
    throw err;
  }
  const candles = parseOhlc(json.result);
  if (!candles) {
    const err = new Error(`Kraken returned no candle data for ${pair}@${minutes}m`);
    err.status = 502;
    throw err;
  }
  return candles; // [time, open, high, low, close, vwap, volume, count]
}

export async function GET() {
  try {
    const assets = {};
    const failed = [];

    for (const [sym, pair] of Object.entries(PAIRS)) {
      assets[sym] = {};
      for (const { key, minutes } of INTERVALS) {
        try {
          const candles = await fetchCandles(pair, minutes);
          const closes = candles.map((c) => parseFloat(c[4]));
          const volumes = candles.map((c) => parseFloat(c[6]));
          const price = closes[closes.length - 1];
          const sma50 = sma(closes, 50);
          const avgVol20 = sma(volumes, 20);
          const lastVol = volumes[volumes.length - 1];
          const { histogram } = macd(closes);

          assets[sym][key] = {
            price,
            rsi: rsi(closes, 14),
            macd: histogram != null ? (histogram >= 0 ? 'bull' : 'bear') : null,
            macdHistogram: histogram,
            priceVsSma50: sma50 != null ? (price >= sma50 ? 'above' : 'below') : null,
            volumeVsAvg: avgVol20 != null ? (lastVol >= avgVol20 ? 'above' : 'below') : null,
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
