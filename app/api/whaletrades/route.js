// Server-side only — requires a CoinLobster API key (coinlobster.com).
// Real individual whale-sized trades merged across 15 CEX, Hyperliquid,
// and on-chain DEX swaps (Ethereum/Base/Arbitrum), newest first — not an
// aggregate ratio like the Taker Buy/Sell Volume panel, actual single
// trades. See app/lib/coinlobster.js for sourcing/verification notes and
// why the exact field names below are read defensively.

export const dynamic = 'force-dynamic';

import { fetchCoinLobster, extractArray, pick, normalizeTimeMs } from '../../lib/coinlobster';

export async function GET() {
  const apiKey = process.env.COINLOBSTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINLOBSTER_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const json = await fetchCoinLobster('whale_trades', { source: 'all', limit: 50 }, apiKey, { revalidateSeconds: 60 });
    const rows = extractArray(json, ['trades', 'data', 'results', 'items']);

    if (!rows) {
      return Response.json(
        { error: `CoinLobster's whale_trades response didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` },
        { status: 502 }
      );
    }

    const trades = rows.map((t) => ({
      coin: pick(t, ['coin', 'symbol', 'asset', 'ticker']),
      side: pick(t, ['side', 'direction']),
      usd: Number(pick(t, ['usd', 'amount_usd', 'value_usd', 'usd_value', 'notional_usd'])) || null,
      price: Number(pick(t, ['price', 'px'])) || null,
      exchange: pick(t, ['exchange', 'venue', 'source_name', 'market']),
      chain: pick(t, ['chain', 'network']),
      wallet: pick(t, ['wallet', 'address', 'trader']),
      txHash: pick(t, ['tx_hash', 'hash', 'txid']),
      timestamp: normalizeTimeMs(pick(t, ['time', 'timestamp', 'ts', 'time_iso', 'created_at'])),
    }));

    return Response.json({ trades, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
