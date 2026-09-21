// Server-side only — requires a CoinLobster API key (coinlobster.com).
// CoinLobster's tracked Hyperliquid accounts: equity, open position size,
// leverage, and long/short bias per named wallet — Hyperliquid's own
// public feed names the wallet on both sides of every fill, which is what
// makes this kind of named-account tracking possible there specifically.
// See app/lib/coinlobster.js for sourcing/verification notes and why
// fields are read defensively.

export const dynamic = 'force-dynamic';

import { fetchCoinLobster, extractArray, pick } from '../../lib/coinlobster';

export async function GET() {
  const apiKey = process.env.COINLOBSTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINLOBSTER_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const json = await fetchCoinLobster('hl_board', {}, apiKey, { revalidateSeconds: 300 });
    const rows = extractArray(json, ['accounts', 'wallets', 'data', 'results', 'items']);

    if (!rows) {
      return Response.json(
        { error: `CoinLobster's hl_board response didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` },
        { status: 502 }
      );
    }

    const accounts = rows.map((a) => ({
      wallet: pick(a, ['wallet', 'address', 'account']),
      label: pick(a, ['label', 'name', 'tag']),
      equityUsd: Number(pick(a, ['equity_usd', 'equity'])) || null,
      positionUsd: Number(pick(a, ['position_usd', 'size_usd', 'notional_usd'])) || null,
      leverage: Number(pick(a, ['leverage', 'avg_leverage'])) || null,
      bias: pick(a, ['bias', 'direction', 'side']),
    }));

    return Response.json({ accounts, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
