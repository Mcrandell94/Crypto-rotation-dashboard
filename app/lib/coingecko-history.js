// Shared daily-price-history fetch for CoinGecko's Demo API, used by both
// the per-ticker RRG route and the per-sector composite RRG route.

const HISTORY_DAYS = 100; // >90 days makes CoinGecko return daily granularity on the free plan

function toDayMap(prices) {
  const map = new Map();
  for (const [ts, price] of prices) {
    const day = new Date(ts).toISOString().slice(0, 10);
    map.set(day, price);
  }
  return map;
}

// Returns { prices, volumes, caps }, each a Map<'YYYY-MM-DD', number> —
// all three series come back in the same market_chart response, so volume
// and market cap cost no extra API calls.
export async function fetchDailyHistory(coingeckoId, apiKey) {
  const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${HISTORY_DAYS}`;
  const res = await fetch(url, {
    headers: { 'x-cg-demo-api-key': apiKey, Accept: 'application/json' },
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`CoinGecko returned ${res.status} for ${coingeckoId}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  const json = await res.json();
  return {
    prices: toDayMap(json.prices || []),
    volumes: toDayMap(json.total_volumes || []),
    caps: toDayMap(json.market_caps || []),
  };
}

// Returns a Map<'YYYY-MM-DD', price>.
export async function fetchDailyPrices(coingeckoId, apiKey) {
  return (await fetchDailyHistory(coingeckoId, apiKey)).prices;
}
