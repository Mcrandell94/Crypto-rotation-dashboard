// Server-side only — requires a CoinLobster API key (coinlobster.com).
// Which coins are showing unusual whale activity right now, over a
// window (1h/4h/24h). See app/lib/coinlobster.js for sourcing/
// verification notes and why fields are read defensively.
//
// Defaults to the 4h window on the initial (uncached) load — the other
// windows are fetched on demand via ?window=1h|24h when the viewer picks
// them, same credit-conscious on-demand pattern as the Taker Buy/Sell
// Volume panel's "other ticker" picker, since this API is credit-metered.

export const dynamic = 'force-dynamic';

import { fetchCoinLobster, extractArray, pick } from '../../lib/coinlobster';

const WINDOWS = ['1h', '4h', '24h'];

export async function GET(request) {
  const apiKey = process.env.COINLOBSTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINLOBSTER_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const window = WINDOWS.includes(searchParams.get('window')) ? searchParams.get('window') : '4h';

  try {
    const json = await fetchCoinLobster('whale_radar', { window }, apiKey, { revalidateSeconds: 300 });
    const rows = extractArray(json, ['coins', 'data', 'results', 'items']);

    if (!rows) {
      return Response.json(
        { error: `CoinLobster's whale_radar response didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` },
        { status: 502 }
      );
    }

    const coins = rows.map((c) => ({
      coin: pick(c, ['coin', 'symbol', 'asset', 'ticker']),
      netFlowUsd: Number(pick(c, ['net_flow_usd', 'net_usd', 'flow_usd', 'net_flow'])) || null,
      buyUsd: Number(pick(c, ['buy_usd', 'buys_usd'])) || null,
      sellUsd: Number(pick(c, ['sell_usd', 'sells_usd'])) || null,
      score: Number(pick(c, ['score', 'magnitude', 'unusual_score'])) || null,
    }));

    return Response.json({ window, coins, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
