// Server-side only — same CoinGecko Demo key as /api/rrg. Returns an
// aligned daily "composite index" series per sector, in the same
// {benchmark, days, prices} shape /api/rrg returns for individual tickers,
// so the RelativeRotationGraph component can plot whole sectors against
// each other without any changes to its own RS-Ratio/RS-Momentum math.
//
// Each sector's composite is an equal-weighted average of its representative
// tickers' *normalized* returns (each ticker rebased to 1.0 at the start of
// the window, then averaged day by day) — not a raw price average, which
// would let a single high-priced token dominate the sector's shape.
//
// Fetching full daily history for every ticker in every sector (70+ ids)
// would risk CoinGecko's Demo-tier rate limit in one burst, so each sector
// is represented by its first few listed tickers (already the most
// prominent names per sector in app/lib/sectors.js) rather than all of them.

import { COINGECKO_IDS } from '../../lib/coingecko-ids';
import { fetchDailyPrices } from '../../lib/coingecko-history';
import { SECTORS } from '../../lib/sectors';

export const dynamic = 'force-dynamic';

const TICKERS_PER_SECTOR = 4;

function composite(dayMaps, commonDays) {
  return commonDays.map((day, i) => {
    const ratios = dayMaps
      .map((m) => (i === 0 ? 1 : m.get(day) / m.get(commonDays[0])))
      .filter((r) => Number.isFinite(r));
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
  });
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
  if (!COINGECKO_IDS[benchmark]) {
    return Response.json({ error: `No CoinGecko id mapped for benchmark ${benchmark}` }, { status: 400 });
  }

  const sectorTickers = SECTORS.map((s) => s.tickers.filter((t) => t !== benchmark).slice(0, TICKERS_PER_SECTOR));
  const allTickers = [...new Set(sectorTickers.flat())].filter((t) => COINGECKO_IDS[t]);

  try {
    const allSymbols = [benchmark, ...allTickers];
    const results = await Promise.allSettled(
      allSymbols.map((sym) => fetchDailyPrices(COINGECKO_IDS[sym], apiKey))
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
    let commonDays = [...mapBySymbol[benchmark].keys()];
    for (const t of okTickers) commonDays = commonDays.filter((d) => mapBySymbol[t].has(d));
    commonDays.sort();

    const prices = { [benchmark]: commonDays.map((d) => mapBySymbol[benchmark].get(d)) };
    const failed = [];
    SECTORS.forEach((sector, i) => {
      const tickers = sectorTickers[i].filter((t) => mapBySymbol[t]);
      if (tickers.length === 0) {
        failed.push(sector.label);
        return;
      }
      const dayMaps = tickers.map((t) => mapBySymbol[t]);
      prices[sector.label] = composite(dayMaps, commonDays);
    });

    return Response.json({
      benchmark,
      days: commonDays,
      prices,
      sectorMembers: Object.fromEntries(SECTORS.map((s, i) => [s.label, sectorTickers[i]])),
      failed,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
