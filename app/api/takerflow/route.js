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
// page load), plus a "leaderboard" — the 2 strongest-buy and 2 strongest-
// sell tickers, by 1h taker buy ratio, from a curated watchlist of liquid
// tickers (below) that are very likely to actually be listed Coinglass
// futures markets. It's a watchlist, not this dashboard's full ~70-ticker
// sector list — fetching all of those on every page load/refresh would
// mean dozens of extra Coinglass calls per refresh against a per-tier
// limit Coinglass's own docs don't publish a number for (they only say it
// varies by plan and point to response headers instead). With
// `?symbol=XYZ`, fetches just that one ticker on demand across all
// ranges — used for the "other tickers" picker for anything outside the
// watchlist. Not every ticker this dashboard tracks elsewhere (small-caps,
// memes) is necessarily a listed futures market on Coinglass; when it
// isn't, this fails loudly with Coinglass's own response rather than
// guessing a value.
//
// Two mitigations against that unpublished limit, both real rather than
// guessed:
// 1. Every response here echoes the `API-KEY-MAX-LIMIT` / `API-KEY-
//    USE-LIMIT` headers Coinglass's own docs say every call carries, as
//    `rateLimit` — the actual per-minute ceiling and current usage for
//    this key, visible in the panel itself, not assumed. Once real
//    numbers are visible there, the watchlist can be sized to fit them
//    with evidence instead of a guess.
// 2. Leaderboard rows cache for 5 minutes (LEADERBOARD_REVALIDATE_SECONDS)
//    via Next's fetch Data Cache — much longer than the 60s the primary
//    BTC/ETH/on-demand lookups use, since the leaderboard doesn't need
//    second-by-second freshness. Repeated page loads/refreshes within
//    that window reuse the cached result instead of re-hitting Coinglass,
//    so growing the watchlist doesn't multiply sustained request rate 1:1
//    with how often the page is opened.

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://open-api-v4.coinglass.com/api';
const RANGES = ['5m', '1h', '4h', '24h'];
const LEADERBOARD_RANGE = '1h';
const LEADERBOARD_REVALIDATE_SECONDS = 300;
const LEADERBOARD_WATCHLIST = [
  'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'TRX',
  'BNB', 'TON', 'LTC', 'BCH', 'UNI', 'AAVE', 'ARB', 'ATOM',
];

async function fetchTakerFlow(symbol, range, apiKey, { revalidateSeconds = 60, rateLimitSink } = {}) {
  const res = await fetch(`${BASE_URL}/futures/taker-buy-sell-volume/exchange-list?symbol=${symbol}&range=${range}`, {
    headers: { 'CG-API-KEY': apiKey, Accept: 'application/json' },
    next: { revalidate: revalidateSeconds },
  });

  if (rateLimitSink) {
    const max = res.headers.get('api-key-max-limit');
    const used = res.headers.get('api-key-use-limit');
    if (max != null) rateLimitSink.max = max;
    if (used != null) rateLimitSink.used = used;
  }

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

async function fetchSymbol(symbol, apiKey, opts) {
  const results = await Promise.all(RANGES.map((r) => fetchTakerFlow(symbol, r, apiKey, opts)));
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

async function fetchLeaderboardRow(symbol, apiKey, opts) {
  const r = await fetchTakerFlow(symbol, LEADERBOARD_RANGE, apiKey, opts);
  if (r.error) return { symbol, error: r.error };
  const { byExchange, ...rest } = r;
  return { symbol, ...rest };
}

function buildLeaderboard(pool) {
  const sorted = [...pool].sort((a, b) => b.buyRatio - a.buyRatio);
  const topBuys = sorted.slice(0, 2);
  // Only take the tail as "top sells" once the pool is big enough that it
  // can't just be re-showing the same tickers already listed as top buys.
  const topSells = sorted.length > 2 ? sorted.slice(-2).reverse() : [];
  return {
    range: LEADERBOARD_RANGE,
    topBuys,
    topSells,
    poolSize: pool.length,
    watchlistSize: LEADERBOARD_WATCHLIST.length + 2, // + BTC, ETH
  };
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
      const rateLimitSink = {};
      const result = await fetchSymbol(requestedSymbol, apiKey, { revalidateSeconds: 60, rateLimitSink });
      if (Object.keys(result.byRange).length === 0) {
        return Response.json(
          {
            error: `Coinglass has no taker buy/sell data for ${requestedSymbol} — it may not be listed as a futures market there.`,
            detail: JSON.stringify(result.rangesFailed).slice(0, 800),
          },
          { status: 502 }
        );
      }
      return Response.json({
        assets: { [requestedSymbol]: result },
        rateLimit: rateLimitSink.max != null ? rateLimitSink : null,
        fetchedAt: new Date().toISOString(),
      });
    }

    const rateLimitSink = {};
    const [btc, eth, ...watchlistResults] = await Promise.all([
      fetchSymbol('BTC', apiKey, { revalidateSeconds: 60, rateLimitSink }),
      fetchSymbol('ETH', apiKey, { revalidateSeconds: 60, rateLimitSink }),
      ...LEADERBOARD_WATCHLIST.map((s) =>
        fetchLeaderboardRow(s, apiKey, { revalidateSeconds: LEADERBOARD_REVALIDATE_SECONDS, rateLimitSink })
      ),
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

    const pool = [];
    const leaderboardFailed = [];
    for (const r of watchlistResults) {
      if (r.error) leaderboardFailed.push(r);
      else pool.push(r);
    }
    if (btc.byRange[LEADERBOARD_RANGE]) {
      const { byExchange, ...rest } = btc.byRange[LEADERBOARD_RANGE];
      pool.push({ symbol: 'BTC', ...rest });
    }
    if (eth.byRange[LEADERBOARD_RANGE]) {
      const { byExchange, ...rest } = eth.byRange[LEADERBOARD_RANGE];
      pool.push({ symbol: 'ETH', ...rest });
    }

    const leaderboard = { ...buildLeaderboard(pool), tickersFailed: leaderboardFailed };

    return Response.json({
      assets: { BTC: btc, ETH: eth },
      leaderboard,
      rateLimit: rateLimitSink.max != null ? rateLimitSink : null,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
