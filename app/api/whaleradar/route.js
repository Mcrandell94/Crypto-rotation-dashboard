// Server-side only — requires a CoinLobster API key (coinlobster.com).
// Which coins are showing unusual whale activity right now, over 1h, 4h,
// and 24h windows. See app/lib/coinlobster.js for sourcing/verification
// notes.
//
// Confirmed live via a CoinLobster MCP connector this session: the tool
// takes no arguments and always returns all three windows in one call —
// {summary, windows: {"1h": [...], "4h": [...], "24h": [...]}, ...}. So
// unlike the earlier design (which assumed a per-window ?window= param
// worth fetching separately), this route fetches once and returns every
// window; the panel switches between them client-side with no extra
// calls or credit spend.

export const dynamic = 'force-dynamic';

import { fetchCoinLobster, pick } from '../../lib/coinlobster';

function normalizeWindow(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((c) => ({
    coin: pick(c, ['coin', 'symbol', 'asset', 'ticker']),
    direction: pick(c, ['direction']),
    netUsd: Number(pick(c, ['netUsd', 'net_flow_usd', 'net_usd', 'flow_usd'])) || null,
    buyUsd: Number(pick(c, ['buyUsd', 'buy_usd', 'buys_usd'])) || null,
    sellUsd: Number(pick(c, ['sellUsd', 'sell_usd', 'sells_usd'])) || null,
    multiple: Number(pick(c, ['multiple', 'score', 'magnitude', 'unusual_score'])) || null,
    unusual: c.unusual ?? null,
  }));
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
    const json = await fetchCoinLobster('whale_radar', {}, apiKey, { revalidateSeconds: 300 });
    const rawWindows = json.windows;

    if (!rawWindows || typeof rawWindows !== 'object') {
      return Response.json(
        { error: `CoinLobster's whale_radar response didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` },
        { status: 502 }
      );
    }

    return Response.json({
      summary: json.summary || null,
      windows: {
        '1h': normalizeWindow(rawWindows['1h']),
        '4h': normalizeWindow(rawWindows['4h']),
        '24h': normalizeWindow(rawWindows['24h']),
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
