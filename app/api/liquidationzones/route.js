// Server-side only — requires a CoinLobster API key (coinlobster.com).
// Projected liquidation levels for BTC and ETH — explicitly a MODEL,
// not executed trades or raw exchange liquidation-order data, per
// CoinLobster's own docs. Shown alongside the hand-curated, screenshot-
// derived Liquidation Levels Tracker as a live cross-check, not a
// replacement — the two sources use fundamentally different methods
// (a model here vs. reading real exchange heatmaps by eye there). See
// app/lib/coinlobster.js for sourcing/verification notes and why fields
// are read defensively.

export const dynamic = 'force-dynamic';

import { fetchCoinLobster, extractArray, pick } from '../../lib/coinlobster';

async function fetchZonesForCoin(coin, apiKey) {
  const json = await fetchCoinLobster('liq_zones', { coin }, apiKey, { revalidateSeconds: 300 });
  const rows = extractArray(json, ['zones', 'levels', 'data', 'results', 'items']);
  if (!rows) {
    return { coin, error: `CoinLobster's liq_zones response for ${coin} didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` };
  }
  const levels = rows.map((z) => ({
    price: Number(pick(z, ['price', 'level'])) || null,
    side: pick(z, ['side', 'direction']),
    usd: Number(pick(z, ['usd', 'amount_usd', 'magnitude', 'volume_usd'])) || null,
  })).filter((z) => z.price != null);
  return { coin, levels };
}

export async function GET() {
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

    return Response.json({ assets: { BTC: btc, ETH: eth }, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
