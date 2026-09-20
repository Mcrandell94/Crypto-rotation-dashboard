// Server-side only — this is the one place the CoinGecko demo key is used.
// Returns aligned daily price series for the benchmark + tracked assets. The
// RS-Ratio/RS-Momentum math itself runs client-side (see
// RelativeRotationGraph.js) so the interactive controls (tail/trend/momentum
// windows, z-score toggle, scrubber) don't need a refetch per change.

import { COINGECKO_IDS } from '../../lib/coingecko-ids';

export const dynamic = 'force-dynamic';

const HISTORY_DAYS = 100; // >90 days makes CoinGecko return daily granularity on the free plan

function toDayMap(prices) {
  const map = new Map();
  for (const [ts, price] of prices) {
    const day = new Date(ts).toISOString().slice(0, 10);
    map.set(day, price);
  }
  return map;
}

async function fetchDailyPrices(symbol, apiKey) {
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
  return toDayMap(json.prices || []);
}

export async function GET(request) {
  const apiKey = process.env.COINGECKO_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINGECKO_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const benchmark = searchParams.get('benchmark') || 'BTC';
  const requested = (searchParams.get('symbols') || 'ETH,SOL,SUI,LINK')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== benchmark);

  if (!COINGECKO_IDS[benchmark]) {
    return Response.json({ error: `No CoinGecko id mapped for benchmark ${benchmark}` }, { status: 400 });
  }

  const unmapped = requested.filter((s) => !COINGECKO_IDS[s]);
  const symbols = requested.filter((s) => COINGECKO_IDS[s]);

  try {
    const allSymbols = [benchmark, ...symbols];
    const results = await Promise.allSettled(allSymbols.map((sym) => fetchDailyPrices(sym, apiKey)));

    const failed = [...unmapped];
    const mapBySymbol = {};
    results.forEach((r, i) => {
      const sym = allSymbols[i];
      if (r.status === 'fulfilled') mapBySymbol[sym] = r.value;
      else failed.push(sym);
    });

    if (!mapBySymbol[benchmark]) {
      return Response.json({ error: `Could not fetch benchmark ${benchmark} from CoinGecko` }, { status: 502 });
    }

    const okSymbols = symbols.filter((s) => mapBySymbol[s]);
    let commonDays = [...mapBySymbol[benchmark].keys()];
    for (const sym of okSymbols) {
      commonDays = commonDays.filter((d) => mapBySymbol[sym].has(d));
    }
    commonDays.sort();

    const prices = {};
    for (const sym of [benchmark, ...okSymbols]) {
      prices[sym] = commonDays.map((d) => mapBySymbol[sym].get(d));
    }

    return Response.json({ benchmark, days: commonDays, prices, failed, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
