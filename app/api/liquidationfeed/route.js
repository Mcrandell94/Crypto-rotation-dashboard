// Server-side. MarginPad's public liquidation feed — genuinely free and
// keyless (no account or API key needed for market-data endpoints).
// Verified against MarginPad's own official Python SDK source
// (github.com/cocchako-ops/marginpad, sdk/python/marginpad/__init__.py)
// for the endpoint itself, since marginpad.io's own docs site is
// unreachable from this sandbox like most providers hit so far.
//
// The response SHAPE was confirmed by reading a real failure sample off
// the live deployment (this route's own defensive-parsing error surfaces
// a raw sample when nothing matches — see app/api/liquidationheatmap-bcf
// for the same pattern). It is NOT a list of individual events with a
// price/timestamp each — it's a running session-cumulative snapshot,
// consistent with what MarginPad's own ecosystem docs describe ("session
// totals... observed after collector start; no fabricated history"):
//   { ok: true, data: { ts, src, market: { long, short }, <array of
//     { s: symbol, liq: total liquidated, long: long-side liquidated } > } }
// The array's own key name wasn't visible in the sample (line-wrapped out
// of view), so it's located by scanning `data` for its one array-valued
// property rather than a hardcoded key.

import { withCdnCache } from '../../lib/cdnCache';
import { isNonCryptoMarket } from '../../lib/nonCryptoMarkets';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://marginpad.io';

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
  }
  return null;
}

async function handler() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/liquidations`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `MarginPad returned ${res.status}`, detail: detail.slice(0, 500) }, { status: res.status });
    }

    const json = await res.json();
    if (json?.ok === false) {
      return Response.json(
        { error: `MarginPad API error: ${json.error?.message || json.error?.code || 'unknown error'}` },
        { status: 502 }
      );
    }

    const data = json?.data ?? json;
    const market = data?.market;
    const coinsArray = data && typeof data === 'object' ? Object.values(data).find((v) => Array.isArray(v)) : null;

    if (!market || !coinsArray) {
      const detail = JSON.stringify(json).slice(0, 800);
      return Response.json(
        { error: `MarginPad's liquidations response didn't match the expected shape. Raw sample: ${detail}`, detail },
        { status: 502 }
      );
    }

    const coins = coinsArray
      .map((c) => {
        const totalUsd = Number(pick(c, ['liq', 'total'])) || 0;
        const longUsd = Number(pick(c, ['long'])) || 0;
        return {
          symbol: pick(c, ['s', 'symbol']),
          totalUsd,
          longUsd,
          // Derived rather than trusting an unconfirmed `short` field name:
          // self-consistent as long as `liq` really is long+short.
          shortUsd: Math.max(0, totalUsd - longUsd),
        };
      })
      .filter((c) => c.symbol && c.totalUsd > 0)
      .sort((a, b) => b.totalUsd - a.totalUsd);

    if (coins.length === 0) {
      const detail = JSON.stringify(coinsArray[0]).slice(0, 500);
      return Response.json(
        { error: `MarginPad's per-coin liquidation data didn't match the expected field shape. Raw sample: ${detail}`, detail },
        { status: 502 }
      );
    }

    // Stock/commodity/FX perps are dropped from the list and taken out of
    // the market totals (which include every market in the feed; the listed
    // coins sum to less than the totals, so they're part of them).
    const nonCrypto = coins.filter((c) => isNonCryptoMarket(c.symbol));
    const sum = (key) => nonCrypto.reduce((a, c) => a + c[key], 0);

    return Response.json({
      asOf: data.ts ? new Date(Number(data.ts)).toISOString() : new Date().toISOString(),
      marketLongUsd: Math.max(0, (Number(market.long) || 0) - sum('longUsd')),
      marketShortUsd: Math.max(0, (Number(market.short) || 0) - sum('shortUsd')),
      coins: coins.filter((c) => !isNonCryptoMarket(c.symbol)),
      excludedNonCrypto: nonCrypto.map((c) => c.symbol),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}

export const GET = withCdnCache(handler, 60);
