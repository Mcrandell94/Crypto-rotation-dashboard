// Server-side only — same CoinGecko Demo key as the RRG/Macro routes.
//
// The standard "Altcoin Season Index" (as popularized by blockchaincenter.net)
// is the % of the top 50 non-stablecoin alts that outperformed BTC over the
// trailing 90 days. CoinGecko's /coins/markets endpoint can return a coin's
// % change for a batch of coins in one request — cheap and fast — but its
// price_change_percentage parameter only accepts 1h/24h/7d/14d/30d/200d/1y,
// not 90d. Rather than fake a 90-day figure, this uses the real 30-day
// change it actually returns and labels it as a 30-day window throughout —
// same underlying idea (breadth of outperformance vs BTC), honestly
// different lookback than the original index.

import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

// Not alts: stablecoins, and tokens that track another asset — $1
// tokenized treasuries and credit (Figure HELOC sat at #9 in October 2026),
// gold tokens, wrapped and staked BTC/ETH. A $1 token reads as "lost to
// BTC" whenever BTC is up and "beat BTC" whenever it's down, so leaving
// one in skews the index. This list covers the asset-tracking tokens and
// the stablecoins seen so far; CoinGecko's own stablecoin category is
// fetched live on top of it to catch new ones.
const NOT_ALT_IDS = new Set([
  'tether', 'usd-coin', 'dai', 'true-usd', 'frax', 'first-digital-usd',
  'usds', 'ethena-usde', 'paypal-usd', 'usdd', 'gemini-dollar',
  'binance-usd', 'paxos-standard', 'susds', 'staked-usde', 'usdx-money-usdx',
  'usd1-wlfi', 'global-dollar', 'ripple-usd',
  'hashnote-usyc', 'ondo-us-dollar-yield', 'blackrock-usd-institutional-digital-liquidity-fund', 'figure-heloc',
  'pax-gold', 'tether-gold',
  'wrapped-bitcoin', 'coinbase-wrapped-btc', 'staked-ether', 'wrapped-steth', 'weth', 'wrapped-eeth',
]);

const CG_HEADERS = (apiKey) => ({ 'x-cg-demo-api-key': apiKey, Accept: 'application/json' });

// Ids in CoinGecko's stablecoin category, or null if that call fails (the
// list above still applies; the response says the live list was missed).
async function fetchStablecoinIds(apiKey) {
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=stablecoins&order=market_cap_desc&per_page=250&page=1';
    const res = await fetch(url, { headers: CG_HEADERS(apiKey), next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? new Set(rows.map((r) => r.id)) : null;
  } catch {
    return null;
  }
}

const TOP_N = 50;

async function handler() {
  const apiKey = process.env.COINGECKO_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINGECKO_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=30d&sparkline=false';
    const [res, stablecoinIds] = await Promise.all([
      fetch(url, { headers: CG_HEADERS(apiKey), next: { revalidate: 1800 } }),
      fetchStablecoinIds(apiKey),
    ]);
    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `CoinGecko returned ${res.status}`, detail }, { status: res.status });
    }

    const coins = await res.json();
    const btc = coins.find((c) => c.id === 'bitcoin');
    const btcChange = btc?.price_change_percentage_30d_in_currency;
    if (btcChange == null) {
      return Response.json({ error: "CoinGecko response didn't include BTC's 30d change" }, { status: 502 });
    }

    const alts = coins
      .filter((c) => c.id !== 'bitcoin' && !NOT_ALT_IDS.has(c.id) && !stablecoinIds?.has(c.id) && c.price_change_percentage_30d_in_currency != null)
      .slice(0, TOP_N);

    const outperforming = alts.filter((c) => c.price_change_percentage_30d_in_currency > btcChange);
    const index = alts.length ? Math.round((outperforming.length / alts.length) * 100) : null;

    return Response.json({
      index,
      windowDays: 30,
      sampleSize: alts.length,
      outperformingCount: outperforming.length,
      btcChange30d: Math.round(btcChange * 10) / 10,
      stablecoinCategoryLoaded: Boolean(stablecoinIds),
      leaders: outperforming
        .sort((a, b) => b.price_change_percentage_30d_in_currency - a.price_change_percentage_30d_in_currency)
        .slice(0, 5)
        .map((c) => ({ symbol: c.symbol.toUpperCase(), change30d: Math.round(c.price_change_percentage_30d_in_currency * 10) / 10 })),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}

export const GET = withCdnCache(handler, 1800);
