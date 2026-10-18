// Server-side only — requires a CoinLobster API key (coinlobster.com).
// Projected liquidation levels for BTC and ETH — explicitly a MODEL,
// not executed trades or raw exchange liquidation-order data, per
// CoinLobster's own docs. Shown alongside the Liquidation Levels Tracker
// as a cross-check, not a replacement.
//
// The old REST endpoint (/api/ai/v1/liq_zones) is gone from CoinLobster's
// REST API — a valid Pro key now gets "Authentication required." there.
// The same data lives in their MCP tool `liquidations` with scope
// `projected` (the old `liq_zones` tool name maps to it), called here over
// their MCP endpoint with the same Bearer key (lib/coinlobster). Answer shape confirmed live
// 2026-10-18: {pair, as_of, projection: {price, bands: [{price, side,
// intensityUsd, leverage}], stats}, ...}. Each answer spends 20-100
// credits from the plan's monthly balance — shared with the trading bot's
// own CoinLobster use — so this refreshes once an hour at most: the Data
// Cache holds the upstream answers, and the CDN holds this route's
// response, so page views never trigger a paid call on their own.

export const dynamic = 'force-dynamic';

import { callCoinLobsterTool, extractArray, pick } from '../../lib/coinlobster';
import { withCdnCache } from '../../lib/cdnCache';

const REVALIDATE = 3600;

async function fetchZonesForCoin(coin, apiKey) {
  const json = await callCoinLobsterTool('liquidations', { coin, scope: 'projected', detail: 'full' }, apiKey, { revalidateSeconds: REVALIDATE });
  const rows = Array.isArray(json?.projection?.bands)
    ? json.projection.bands
    : extractArray(json, ['zones', 'levels', 'data', 'results', 'items']);

  if (!rows) {
    return { coin, error: `CoinLobster's projected-liquidations answer for ${coin} didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` };
  }

  const levels = rows.map((z) => ({
    price: Number(pick(z, ['price', 'level'])) || null,
    side: pick(z, ['side', 'direction']),
    usd: Number(pick(z, ['intensityUsd', 'usd', 'amount_usd', 'magnitude', 'volume_usd'])) || null,
  })).filter((z) => z.price != null);

  return { coin, levels, currentPrice: json?.projection?.price ?? null, asOf: json?.as_of ?? null };
}

async function handler() {
  const apiKey = process.env.COINLOBSTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINLOBSTER_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const [btc, eth] = await Promise.all([
      fetchZonesForCoin('BTC', apiKey),
      fetchZonesForCoin('ETH', apiKey),
    ]);

    if (btc.error && eth.error) {
      return Response.json(
        { error: `CoinLobster liq_zones failed for both BTC and ETH: ${btc.error} | ${eth.error}` },
        { status: 502 }
      );
    }

    // A coin that failed is listed in `failed` too, so lib/cdnCache won't
    // hold a half-empty answer at the edge for the whole hour.
    const failed = [btc, eth].filter((a) => a.error).map((a) => ({ coin: a.coin, error: a.error }));
    return Response.json({ assets: { BTC: btc, ETH: eth }, failed, fetchedAt: new Date().toISOString() });
  } catch (err) {
    // CoinLobster's own status goes in the message; this route answers 502
    // (bad upstream), since passing its 401 through reads as this site's
    // own login wall.
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status ? 502 : 500 }
    );
  }
}

export const GET = withCdnCache(handler, REVALIDATE);
