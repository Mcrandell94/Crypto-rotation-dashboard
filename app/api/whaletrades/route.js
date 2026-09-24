// Server-side only — requires a CoinLobster API key (coinlobster.com).
// Real individual whale-sized trades merged across 15 CEX, Hyperliquid,
// and on-chain DEX swaps (Ethereum/Base/Arbitrum), newest first — not an
// aggregate ratio like the Taker Buy/Sell Volume panel, actual single
// trades. See app/lib/coinlobster.js for sourcing/verification notes.
//
// Response field names below are no longer a guess — confirmed live via
// a CoinLobster MCP connector this session: {trades: [{pair, exchange,
// price, quantity_quote, isBuy, timestamp, source, ...}], count, ...}.
// The dashboard's own REST calls (separate API-key auth) still parse
// defensively as a safety net in case the REST envelope differs from
// what MCP returned.

export const dynamic = 'force-dynamic';

import { fetchCoinLobster, extractArray, pick, normalizeTimeMs } from '../../lib/coinlobster';
import { withCdnCache } from '../../lib/cdnCache';

async function handler() {
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

    const trades = rows.map((t) => {
      const pair = pick(t, ['pair', 'symbol']);
      const coin = pair ? String(pair).split('/')[0] : pick(t, ['coin', 'asset', 'ticker']);
      const isBuy = typeof t.isBuy === 'boolean' ? t.isBuy : null;
      return {
        coin,
        side: isBuy != null ? (isBuy ? 'buy' : 'sell') : pick(t, ['side', 'direction']),
        usd: Number(pick(t, ['quantity_quote', 'usd', 'amount_usd', 'value_usd', 'usd_value', 'notional_usd'])) || null,
        price: Number(pick(t, ['price', 'px'])) || null,
        exchange: pick(t, ['exchange', 'venue', 'source_name', 'market']),
        chain: pick(t, ['chain', 'network']),
        wallet: pick(t, ['wallet', 'address', 'trader']),
        txHash: pick(t, ['tx_hash', 'txHash', 'hash', 'txid']),
        timestamp: normalizeTimeMs(pick(t, ['timestamp', 'time', 'ts', 'time_iso', 'created_at'])),
      };
    });

    return Response.json({ trades, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}

export const GET = withCdnCache(handler, 60);
