// Server-side only — requires a CoinLobster API key (coinlobster.com).
// Hourly whale buy vs. sell volume for one coin, CEX/DEX split. See
// app/lib/coinlobster.js for sourcing/verification notes.
//
// Response field names below are no longer a guess — confirmed live via
// a CoinLobster MCP connector this session: {rows: [{t (epoch ms),
// buyUsd, sellUsd, cexBuyUsd, cexSellUsd, dexBuyUsd, dexSellUsd, ...}],
// summary, ...}.
//
// Defaults to BTC on load; other coins are fetched on demand via
// ?coin=XYZ, same credit-conscious pattern used elsewhere for this API.

export const dynamic = 'force-dynamic';

import { fetchCoinLobster, extractArray, pick, normalizeTimeMs } from '../../lib/coinlobster';

export async function GET(request) {
  const apiKey = process.env.COINLOBSTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINLOBSTER_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const coin = (searchParams.get('coin') || 'BTC').trim().toUpperCase();

  try {
    const json = await fetchCoinLobster('whale_flow', { coin, hours: 12 }, apiKey, { revalidateSeconds: 300 });
    const rows = extractArray(json, ['rows', 'hours', 'flow', 'data', 'results', 'items']);

    if (!rows) {
      return Response.json(
        { error: `CoinLobster's whale_flow response for ${coin} didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` },
        { status: 502 }
      );
    }

    const hours = rows
      .map((h) => ({
        timestamp: normalizeTimeMs(pick(h, ['t', 'hour', 'time', 'timestamp', 'ts'])),
        buyUsd: Number(pick(h, ['buyUsd', 'buy_usd', 'buys_usd', 'buy'])) || 0,
        sellUsd: Number(pick(h, ['sellUsd', 'sell_usd', 'sells_usd', 'sell'])) || 0,
        cexBuyUsd: Number(pick(h, ['cexBuyUsd', 'cex_buy_usd', 'cex_buy'])) || null,
        cexSellUsd: Number(pick(h, ['cexSellUsd', 'cex_sell_usd', 'cex_sell'])) || null,
        dexBuyUsd: Number(pick(h, ['dexBuyUsd', 'dex_buy_usd', 'dex_buy'])) || null,
        dexSellUsd: Number(pick(h, ['dexSellUsd', 'dex_sell_usd', 'dex_sell'])) || null,
      }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return Response.json({ coin, summary: json.summary || null, hours, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
