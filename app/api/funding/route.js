// Server-side, but no secret involved — Hyperliquid's public /info endpoint
// is fully keyless (no wallet/account needed for market data reads). One
// POST returns funding rate + open interest for every perpetual they list.
//
// Only tickers whose name matches a Hyperliquid market exactly are
// returned — no alias guessing (e.g. Hyperliquid sometimes lists low-price
// coins under a "k"-prefixed scaled name like kPEPE; without verifying each
// one we'd risk mismatching a ticker to the wrong market, so those are
// reported as "not listed" instead of guessed).
//
// Hyperliquid's /info only accepts POST, and Next.js's fetch cache never
// caches POST — so `next: { revalidate }` alone did nothing and every page
// load (this feeds the always-visible header) hit Hyperliquid. The call is
// cached with unstable_cache instead. A failed call throws, and thrown
// results aren't cached, so an outage clears on the next request.

import { unstable_cache } from 'next/cache';
import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

const HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info';

class UpstreamError extends Error {
  constructor(status, detail) {
    super(`Hyperliquid returned ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

const fetchMetaAndAssetCtxs = unstable_cache(
  async () => {
    const res = await fetch(HYPERLIQUID_INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      cache: 'no-store',
    });
    if (!res.ok) throw new UpstreamError(res.status, await res.text());
    return res.json();
  },
  ['hyperliquid-metaAndAssetCtxs'],
  { revalidate: 300 }
);

async function handler(request) {
  const { searchParams } = new URL(request.url);
  const requested = (searchParams.get('symbols') || 'BTC,ETH')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const [meta, assetCtxs] = await fetchMetaAndAssetCtxs();
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
    if (err instanceof UpstreamError) {
      return Response.json({ error: err.message, detail: err.detail }, { status: err.status });
    }
    return Response.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}

export const GET = withCdnCache(handler, 300);
