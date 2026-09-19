// Server-side, but no secret involved — Hyperliquid's public /info endpoint
// is fully keyless (no wallet/account needed for market data reads). One
// POST returns funding rate + open interest for every perpetual they list.
//
// Only tickers whose name matches a Hyperliquid market exactly are
// returned — no alias guessing (e.g. Hyperliquid sometimes lists low-price
// coins under a "k"-prefixed scaled name like kPEPE; without verifying each
// one we'd risk mismatching a ticker to the wrong market, so those are
// reported as "not listed" instead of guessed).

const HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requested = (searchParams.get('symbols') || 'BTC,ETH')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const res = await fetch(HYPERLIQUID_INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `Hyperliquid returned ${res.status}`, detail }, { status: res.status });
    }

    const [meta, assetCtxs] = await res.json();
    const universe = meta?.universe || [];

    const bySymbol = {};
    universe.forEach((asset, i) => {
      bySymbol[asset.name] = assetCtxs[i];
    });

    const data = {};
    const notListed = [];
    for (const sym of requested) {
      const ctx = bySymbol[sym];
      if (!ctx) {
        notListed.push(sym);
        continue;
      }
      const fundingRate = parseFloat(ctx.funding); // hourly rate, e.g. 0.0000125 = 0.00125%
      const markPx = parseFloat(ctx.markPx);
      const openInterestCoins = parseFloat(ctx.openInterest);
      data[sym] = {
        fundingRateHourly: fundingRate,
        fundingRateAnnualized: fundingRate * 24 * 365 * 100, // %
        markPrice: markPx,
        openInterestUsd: openInterestCoins * markPx,
        dayVolumeUsd: parseFloat(ctx.dayNtlVlm),
      };
    }

    return Response.json({ data, notListed, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
