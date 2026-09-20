// Server-side only. Combines three free sources: alternative.me's Fear &
// Greed Index (fully keyless), CoinGecko's /global endpoint (same Demo key
// as the RRG route) for BTC/USDT market cap dominance, and the St. Louis
// Fed's FRED API for real traditional-macro context (rates, dollar
// strength, yield curve) — the one thing an otherwise crypto-only "Macro &
// Sentiment" panel was missing.

export const dynamic = 'force-dynamic';

// { key in the response, FRED series id, display formatting hint }
const FRED_SERIES = [
  { key: 'fedFundsRate', seriesId: 'DFF', label: 'Fed Funds Rate' },
  { key: 'treasury10y', seriesId: 'DGS10', label: '10Y Treasury Yield' },
  { key: 'dollarIndex', seriesId: 'DTWEXBGS', label: 'Trade-Weighted Dollar Index' },
  { key: 'yieldCurveSpread', seriesId: 'T10Y2Y', label: '10Y-2Y Spread' },
  { key: 'crudeOil', seriesId: 'DCOILWTICO', label: 'WTI Crude Oil' },
  // Japan's actual policy lever — the BOJ sets a target range for this
  // exact overnight interbank rate, so it's a faithful live proxy for
  // "the BOJ rate" rather than the discount rate (FRED's INTDSRJPM193N),
  // which stopped updating in 2017.
  { key: 'japanPolicyRate', seriesId: 'IRSTCI01JPM156N', label: 'Japan Policy Rate' },
];

// FRED's daily series post with a short lag and sometimes carry a "."
// (missing) value at the newest date or over a holiday — fetch a small
// window and take the first real number rather than assuming the latest
// entry is populated.
async function fetchFredLatest(seriesId, apiKey) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    const err = new Error(`FRED returned ${res.status} for ${seriesId}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const point = (json.observations || []).find((o) => o.value !== '.');
  if (!point) return null;
  return { value: parseFloat(point.value), date: point.date };
}

async function fetchRates() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return { rates: null, ratesFailed: null };

  const results = await Promise.allSettled(FRED_SERIES.map((s) => fetchFredLatest(s.seriesId, apiKey)));
  const rates = {};
  const ratesFailed = [];
  results.forEach((r, i) => {
    const { key, label } = FRED_SERIES[i];
    if (r.status === 'fulfilled' && r.value) rates[key] = r.value;
    else ratesFailed.push(label);
  });
  return { rates, ratesFailed };
}

export async function GET() {
  const cgKey = process.env.COINGECKO_API_KEY;
  if (!cgKey) {
    return Response.json(
      { error: 'COINGECKO_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const [fngRes, globalRes, { rates, ratesFailed }] = await Promise.all([
      fetch('https://api.alternative.me/fng/?limit=1', { next: { revalidate: 3600 } }),
      fetch('https://api.coingecko.com/api/v3/global', {
        headers: { 'x-cg-demo-api-key': cgKey, Accept: 'application/json' },
        next: { revalidate: 900 },
      }),
      fetchRates(),
    ]);

    if (!fngRes.ok) {
      const detail = await fngRes.text();
      return Response.json({ error: `Fear & Greed API returned ${fngRes.status}`, detail }, { status: fngRes.status });
    }
    if (!globalRes.ok) {
      const detail = await globalRes.text();
      return Response.json({ error: `CoinGecko returned ${globalRes.status}`, detail }, { status: globalRes.status });
    }

    const fngJson = await fngRes.json();
    const globalJson = await globalRes.json();

    const point = fngJson.data?.[0];
    const pct = globalJson.data?.market_cap_percentage || {};

    return Response.json({
      fng: point
        ? { value: Number(point.value), classification: point.value_classification, asOf: new Date(Number(point.timestamp) * 1000).toISOString() }
        : null,
      dominance: { btc: pct.btc ?? null, usdt: pct.usdt ?? null },
      rates,
      ratesFailed,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
