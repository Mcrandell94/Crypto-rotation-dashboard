// Shared helpers for Kraken's public OHLC endpoint — fully keyless, no
// account needed for market data. Returns up to 720 of the most recent
// candles for whatever interval you ask for (verified against Kraken's own
// docs), regardless of interval — so a daily request gets ~2 years of
// history, not just the last 720 days-worth of a finer interval.

const KRAKEN_BASE = 'https://api.kraken.com/0/public/OHLC';

// Kraken's REST aliases for BTC/USD and ETH/USD. The response comes back
// keyed under Kraken's *internal* pair name (e.g. XXBTZUSD), which doesn't
// necessarily match what you requested — never assume the key, always find
// it defensively (see parseOhlc below).
export const PAIRS = { BTC: 'XBTUSD', ETH: 'ETHUSD' };

// Kraken keys the OHLC result by its own internal pair name, which can
// differ from the requested pair (e.g. request "XBTUSD", get back
// "XXBTZUSD") — find the data key defensively rather than assuming it.
function parseOhlc(result) {
  const key = Object.keys(result).find((k) => k !== 'last');
  return key ? result[key] : null;
}

// Returns an array of [time, open, high, low, close, vwap, volume, count].
export async function fetchCandles(pair, minutes) {
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
  return candles;
}
