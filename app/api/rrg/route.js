// Server-side only — this is the one place the CoinGecko demo key is used.
// Returns aligned price series (4-hour, daily or weekly bars, per the
// `interval` param) for the benchmark + tracked assets. The
// RS-Ratio/RS-Momentum math itself runs client-side (see
// RelativeRotationGraph.js) so the interactive controls (tail/trend/momentum
// windows, z-score toggle, scrubber) don't need a refetch per change.

import { COINGECKO_IDS } from '../../lib/coingecko-ids';
import { fetchHistory as fetchBars, parseInterval, alignBars } from '../../lib/coingecko-history';
import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

function fetchHistory(symbol, apiKey, interval) {
  return fetchBars(COINGECKO_IDS[symbol], apiKey, interval);
}

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
  const interval = parseInterval(searchParams.get('interval'));
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
    const results = await Promise.allSettled(allSymbols.map((sym) => fetchHistory(sym, apiKey, interval)));

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

    // Tickers too young for this window are left out (and listed in
    // `shortHistory`) rather than cutting every series down to theirs.
    const { days: commonDays, kept: okSymbols, short: shortHistory } = alignBars(
      [...mapBySymbol[benchmark].prices.keys()],
      Object.fromEntries(symbols.filter((s) => mapBySymbol[s]).map((s) => [s, mapBySymbol[s].prices])),
    );

    // Daily USD volume alongside price (same CoinGecko response) for the
    // RRG's optional volume-confirmation overlay; null where a day's
    // volume is missing rather than a filled-in guess.
    const prices = {};
    const volumes = {};
    for (const sym of [benchmark, ...okSymbols]) {
      prices[sym] = commonDays.map((d) => mapBySymbol[sym].prices.get(d));
      volumes[sym] = commonDays.map((d) => mapBySymbol[sym].volumes.get(d) ?? null); // none on 4h bars
    }

    // `days` holds the bar labels (dates, 4-hour UTC starts, or week starts).
    return Response.json({ benchmark, interval, days: commonDays, prices, volumes, failed, shortHistory, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}

export const GET = withCdnCache(handler, 900);
