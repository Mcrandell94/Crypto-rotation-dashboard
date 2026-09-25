// Server-side only — same CoinGecko Demo key as /api/rrg. Returns an
// aligned daily "composite index" series per sector, in the same
// {benchmark, days, prices} shape /api/rrg returns for individual tickers,
// so the RelativeRotationGraph component can plot whole sectors against
// each other without any changes to its own RS-Ratio/RS-Momentum math.
//
// Each sector's composite is an equal-weighted average of its representative
// tickers' *normalized* returns (each ticker rebased to 1.0 at the start of
// the window, then averaged day by day) — not a raw price average, which
// would let a single high-priced token dominate the sector's shape. A
// cap-weighted version (members weighted by day-0 market cap) is returned
// alongside as `pricesCapWeighted` for the chart's optional toggle.
//
// Fetching full daily history for every ticker in every sector (70+ ids)
// would risk CoinGecko's Demo-tier rate limit in one burst, so each sector
// is represented by its first few listed tickers (already the most
// prominent names per sector in app/lib/sectors.js) rather than all of them.

import { COINGECKO_IDS } from '../../lib/coingecko-ids';
import { fetchDailyHistory } from '../../lib/coingecko-history';
import { equalWeightComposite, capWeightComposite, capWeights } from '../../lib/rrgOverlays';
import { SECTORS } from '../../lib/sectors';
import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

const TICKERS_PER_SECTOR = 4;

async function handler(request) {
  const apiKey = process.env.COINGECKO_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINGECKO_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const benchmark = searchParams.get('benchmark') || 'BTC';
  if (!COINGECKO_IDS[benchmark]) {
    return Response.json({ error: `No CoinGecko id mapped for benchmark ${benchmark}` }, { status: 400 });
  }

  const sectorTickers = SECTORS.map((s) => s.tickers.filter((t) => t !== benchmark).slice(0, TICKERS_PER_SECTOR));
  const allTickers = [...new Set(sectorTickers.flat())].filter((t) => COINGECKO_IDS[t]);

  try {
    const allSymbols = [benchmark, ...allTickers];
    const results = await Promise.allSettled(
      allSymbols.map((sym) => fetchDailyHistory(COINGECKO_IDS[sym], apiKey))
    );

    const mapBySymbol = {};
    const failedTickers = [];
    results.forEach((r, i) => {
      const sym = allSymbols[i];
      if (r.status === 'fulfilled') mapBySymbol[sym] = r.value;
      else failedTickers.push(sym);
    });

    if (!mapBySymbol[benchmark]) {
      return Response.json({ error: `Could not fetch benchmark ${benchmark} from CoinGecko` }, { status: 502 });
    }

    const okTickers = allTickers.filter((t) => mapBySymbol[t]);
    let commonDays = [...mapBySymbol[benchmark].prices.keys()];
    for (const t of okTickers) commonDays = commonDays.filter((d) => mapBySymbol[t].prices.has(d));
    commonDays.sort();

    // Two composites per sector, both rebased to 1.0 on day 0: equal-weighted
    // (each member counts the same) and cap-weighted (weighted by each
    // member's market cap on day 0). Plus the sector's summed daily volume
    // for the volume overlay, and the cap weights so the UI can show them.
    const benchPrices = commonDays.map((d) => mapBySymbol[benchmark].prices.get(d));
    const prices = { [benchmark]: benchPrices };
    const pricesCapWeighted = { [benchmark]: benchPrices };
    const volumes = {};
    const memberWeights = {};
    const failed = [];
    SECTORS.forEach((sector, i) => {
      const tickers = sectorTickers[i].filter((t) => mapBySymbol[t]);
      if (tickers.length === 0) {
        failed.push(sector.label);
        return;
      }
      const series = tickers.map((t) => commonDays.map((d) => mapBySymbol[t].prices.get(d)));
      const day0Caps = tickers.map((t) => mapBySymbol[t].caps.get(commonDays[0]) ?? null);
      prices[sector.label] = equalWeightComposite(series);
      pricesCapWeighted[sector.label] = capWeightComposite(series, day0Caps) || prices[sector.label];
      volumes[sector.label] = commonDays.map((d) => {
        const vs = tickers.map((t) => mapBySymbol[t].volumes.get(d));
        return vs.every((v) => Number.isFinite(v)) ? vs.reduce((a, b) => a + b, 0) : null;
      });
      memberWeights[sector.label] = Object.fromEntries(tickers.map((t, k) => [t, capWeights(day0Caps)[k]]));
    });

    return Response.json({
      benchmark,
      days: commonDays,
      prices,
      pricesCapWeighted,
      volumes,
      memberWeights,
      sectorMembers: Object.fromEntries(SECTORS.map((s, i) => [s.label, sectorTickers[i]])),
      failed,
      // Individual members that failed (e.g. a CoinGecko 429 in the burst):
      // their sector's composite is built from the remaining members, so say
      // so rather than silently. Non-empty also keeps this partial result
      // out of the CDN cache (see app/lib/cdnCache.js).
      tickersFailed: failedTickers,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}

export const GET = withCdnCache(handler, 900);
