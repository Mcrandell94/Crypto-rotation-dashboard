// Server-side only — this is the one place the CoinGecko demo key is used.
// Builds a Relative Rotation Graph: each tracked asset's price relative to a
// benchmark (BTC by default), turned into an RS-Ratio (relative strength,
// centered on 100) and RS-Momentum (rate of change of that ratio, also
// centered on 100). This is a standard open approximation of the JdK RRG
// method, not the exact proprietary formula.

const COINGECKO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  SUI: 'sui',
  LINK: 'chainlink',
};

const RATIO_SMA_WINDOW = 14;
const RATIO_SMOOTH_WINDOW = 5;
const MOMENTUM_LOOKBACK = 5;
const MOMENTUM_SMOOTH_WINDOW = 5;
const TAIL_LENGTH = 8;
const HISTORY_DAYS = 100; // >90 days makes CoinGecko return daily granularity on the free plan

function rollingMeanTrim(values, window) {
  const out = [];
  for (let i = 0; i <= values.length - window; i++) {
    let sum = 0;
    for (let j = i; j < i + window; j++) sum += values[j];
    out.push(sum / window);
  }
  return out;
}

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
  const symbols = (searchParams.get('symbols') || 'ETH,SOL,SUI,LINK')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== benchmark);

  try {
    const allSymbols = [benchmark, ...symbols];
    const maps = await Promise.all(allSymbols.map((sym) => fetchDailyPrices(sym, apiKey)));
    const mapBySymbol = Object.fromEntries(allSymbols.map((sym, i) => [sym, maps[i]]));

    let commonDays = [...mapBySymbol[benchmark].keys()];
    for (const sym of symbols) {
      const days = mapBySymbol[sym];
      commonDays = commonDays.filter((d) => days.has(d));
    }
    commonDays.sort();

    const benchmarkPrices = commonDays.map((d) => mapBySymbol[benchmark].get(d));

    const series = {};
    for (const sym of symbols) {
      const assetPrices = commonDays.map((d) => mapBySymbol[sym].get(d));
      const ratio = assetPrices.map((p, i) => p / benchmarkPrices[i]);

      const smaRatio = rollingMeanTrim(ratio, RATIO_SMA_WINDOW);
      const rsRatioRaw = smaRatio.map((sma, i) => (100 * ratio[i + RATIO_SMA_WINDOW - 1]) / sma);
      const daysAfterRatioSma = commonDays.slice(RATIO_SMA_WINDOW - 1);

      const rsRatio = rollingMeanTrim(rsRatioRaw, RATIO_SMOOTH_WINDOW);
      const daysAfterRatioSmooth = daysAfterRatioSma.slice(RATIO_SMOOTH_WINDOW - 1);

      const momentumRaw = [];
      for (let i = 0; i + MOMENTUM_LOOKBACK < rsRatio.length; i++) {
        momentumRaw.push((100 * rsRatio[i + MOMENTUM_LOOKBACK]) / rsRatio[i]);
      }
      const daysAfterMomentum = daysAfterRatioSmooth.slice(MOMENTUM_LOOKBACK);

      const rsMomentum = rollingMeanTrim(momentumRaw, MOMENTUM_SMOOTH_WINDOW);
      const finalDays = daysAfterMomentum.slice(MOMENTUM_SMOOTH_WINDOW - 1);
      const finalRsRatio = rsRatio.slice(rsRatio.length - finalDays.length);

      const tailDays = finalDays.slice(-TAIL_LENGTH);
      const tailRsRatio = finalRsRatio.slice(-TAIL_LENGTH);
      const tailRsMomentum = rsMomentum.slice(-TAIL_LENGTH);

      const tail = tailDays.map((date, i) => ({
        date,
        rsRatio: tailRsRatio[i],
        rsMomentum: tailRsMomentum[i],
      }));

      series[sym] = { tail, current: tail[tail.length - 1] || null };
    }

    return Response.json({ benchmark, series, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
