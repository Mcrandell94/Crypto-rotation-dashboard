// Server-side only — requires a Coinglass API key (coinglass.com), the same
// COINGLASS_API_KEY already used for the Open Interest panel. Real taker
// buy vs. sell volume, aggregated across every exchange Coinglass tracks,
// plus the identical breakdown per exchange — not a single-exchange proxy.
//
// Endpoint: GET /api/futures/taker-buy-sell-volume/exchange-list. Per
// Coinglass's own docs repo (github.com/coinglass-official/
// coinglass-api-docs/blob/master/rest/Futures/Long-Short-Ratio/
// taker-buysell-volume-exchange-list.md), this one is available on every
// plan tier including the free/trial Hobbyist tier this project currently
// has — same verification standard as the Open Interest route, and
// coinglass.com's docs site itself is unreachable from this sandbox like
// most providers hit this session.
//
// With no `symbol` param, returns BTC + ETH across all ranges (the default
// page load). With `?symbol=XYZ`, fetches just that one ticker on demand —
// used for the "other tickers" picker, so this route isn't hammering
// Coinglass with dozens of calls for tickers nobody's looking at. Not
// every ticker this dashboard tracks elsewhere (small-caps, memes) is
// necessarily a listed futures market on Coinglass; when it isn't, this
// fails loudly with Coinglass's own response rather than guessing a value.

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://open-api-v4.coinglass.com/api';
const RANGES = ['5m', '1h', '4h', '24h'];

async function fetchTakerFlow(symbol, range, apiKey) {
  const res = await fetch(`${BASE_URL}/futures/taker-buy-sell-volume/exchange-list?symbol=${symbol}&range=${range}`, {
    headers: { 'CG-API-KEY': apiKey, Accept: 'application/json' },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const detail = await res.text();
    return { range, error: `Coinglass returned ${res.status} for ${symbol} ${range} taker flow. Raw response: ${detail.slice(0, 300)}` };
  }

  const json = await res.json();
  if (json.code !== '0' && json.code !== 0) {
    return { range, error: `Coinglass API error for ${symbol} ${range}: ${json.msg || 'unknown error'}. Raw sample: ${JSON.stringify(json).slice(0, 300)}` };
  }

  const d = json.data;
  if (!d || d.buy_vol_usd == null || d.sell_vol_usd == null) {
    return { range, error: `Coinglass taker-flow response for ${symbol} ${range} didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 300)}` };
  }

  return {
    range,
    buyRatio: d.buy_ratio,
    sellRatio: d.sell_ratio,
    buyVolUsd: d.buy_vol_usd,
    sellVolUsd: d.sell_vol_usd,
    netVolUsd: d.buy_vol_usd - d.sell_vol_usd,
    byExchange: (d.exchange_list || [])
      .map((e) => ({
        exchange: e.exchange,
        buyRatio: e.buy_ratio,
        sellRatio: e.sell_ratio,
        buyVolUsd: e.buy_vol_usd,
        sellVolUsd: e.sell_vol_usd,
        netVolUsd: e.buy_vol_usd - e.sell_vol_usd,
      }))
      .sort((a, b) => (b.buyVolUsd + b.sellVolUsd) - (a.buyVolUsd + a.sellVolUsd)),
  };
}

async function fetchSymbol(symbol, apiKey) {
  const results = await Promise.all(RANGES.map((r) => fetchTakerFlow(symbol, r, apiKey)));
  const byRange = {};
  const rangesFailed = [];
  for (const r of results) {
    if (r.error) {
      rangesFailed.push({ range: r.range, error: r.error });
    } else {
      byRange[r.range] = r;
    }
  }
  return { symbol, byRange, rangesFailed };
}

export async function GET(request) {
  const apiKey = process.env.COINGLASS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINGLASS_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedSymbol = searchParams.get('symbol')?.trim().toUpperCase();

  try {
    if (requestedSymbol) {
      const result = await fetchSymbol(requestedSymbol, apiKey);
      if (Object.keys(result.byRange).length === 0) {
        return Response.json(
          {
            error: `Coinglass has no taker buy/sell data for ${requestedSymbol} — it may not be listed as a futures market there.`,
            detail: JSON.stringify(result.rangesFailed).slice(0, 800),
          },
          { status: 502 }
        );
      }
      return Response.json({ assets: { [requestedSymbol]: result }, fetchedAt: new Date().toISOString() });
    }

    const [btc, eth] = await Promise.all([
      fetchSymbol('BTC', apiKey),
      fetchSymbol('ETH', apiKey),
    ]);

    if (Object.keys(btc.byRange).length === 0 && Object.keys(eth.byRange).length === 0) {
      return Response.json(
        {
          error: 'Coinglass taker buy/sell volume failed for every range and asset.',
          detail: JSON.stringify({ btc: btc.rangesFailed, eth: eth.rangesFailed }).slice(0, 800),
        },
        { status: 502 }
      );
    }

    return Response.json({ assets: { BTC: btc, ETH: eth }, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
