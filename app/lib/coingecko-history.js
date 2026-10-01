// Shared price-history fetch for CoinGecko's Demo API, used by both the
// per-ticker RRG route and the per-sector composite RRG route, at three
// bar sizes:
// - 1d: 100 days of daily points (CoinGecko returns daily granularity for
//       requests over 90 days)
// - 4h: 21 days of hourly points (2-90 day requests come back hourly),
//       grouped into 4-hour UTC bars, ~126 bars
// - 1w: 365 days of daily points (the Demo plan's history limit), grouped
//       into Monday-start UTC weeks, ~52 bars
// A bar's price and market cap are its last point (the close). Volume:
// CoinGecko's total_volumes is a rolling 24-hour figure at each point, so
// daily bars use it as-is, weekly bars average the week's daily figures
// (a partial current week stays comparable), and 4-hour bars get none — a
// rolling 24h number isn't a 4-hour bar's volume.

export const INTERVALS = {
  '1d': { days: 100 },
  '4h': { days: 21 },
  '1w': { days: 365 },
};

export function parseInterval(value) {
  return Object.prototype.hasOwnProperty.call(INTERVALS, value) ? value : '1d';
}

const pad = (n) => String(n).padStart(2, '0');

// Bar label for a timestamp: 'YYYY-MM-DD' (1d), 'YYYY-MM-DD HH:00' UTC at
// 00/04/08/12/16/20 (4h), or the Monday that starts the week (1w).
export function barKey(ts, interval) {
  const d = new Date(ts);
  if (interval === '4h') {
    return `${d.toISOString().slice(0, 10)} ${pad(Math.floor(d.getUTCHours() / 4) * 4)}:00`;
  }
  if (interval === '1w') {
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

// [[ts, value], ...] -> Map<barKey, value>, using each bar's last point
// ('last') or the mean of its points ('mean').
export function toBars(points, interval, mode = 'last') {
  const sorted = [...points].filter(([, v]) => Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
  if (mode === 'last') {
    const map = new Map();
    for (const [ts, v] of sorted) map.set(barKey(ts, interval), v);
    return map;
  }
  const sums = new Map();
  for (const [ts, v] of sorted) {
    const k = barKey(ts, interval);
    const s = sums.get(k) || { total: 0, n: 0 };
    s.total += v;
    s.n += 1;
    sums.set(k, s);
  }
  return new Map([...sums].map(([k, s]) => [k, s.total / s.n]));
}

// Returns { prices, volumes, caps }, each a Map<barKey, number> — all three
// series come back in the same market_chart response, so volume and market
// cap cost no extra API calls.
export async function fetchHistory(coingeckoId, apiKey, interval = '1d') {
  const { days } = INTERVALS[interval];
  const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url, {
    headers: { 'x-cg-demo-api-key': apiKey, Accept: 'application/json' },
    next: { revalidate: interval === '4h' ? 300 : 900 },
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`CoinGecko returned ${res.status} for ${coingeckoId}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  const json = await res.json();
  let volumes;
  if (interval === '4h') volumes = new Map();
  else if (interval === '1w') volumes = toBars(json.total_volumes || [], '1w', 'mean');
  else volumes = toBars(json.total_volumes || [], '1d');
  return {
    prices: toBars(json.prices || [], interval),
    volumes,
    caps: toBars(json.market_caps || [], interval),
  };
}

// Daily history (kept for existing callers).
export function fetchDailyHistory(coingeckoId, apiKey) {
  return fetchHistory(coingeckoId, apiKey, '1d');
}

// Returns a Map<'YYYY-MM-DD', price>.
export async function fetchDailyPrices(coingeckoId, apiKey) {
  return (await fetchDailyHistory(coingeckoId, apiKey)).prices;
}
