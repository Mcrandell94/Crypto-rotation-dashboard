// Server-side. Live liquidation map for BTC and ETH from LiqWall's MCP
// server (liqwall.com/mcp, tool `liquidation_map`): the largest long
// liquidation levels below price and short levels above it, within 10%,
// across Binance, OKX, Bybit, Hyperliquid and Gate. That tool answers
// without a key; LIQWALL_API_KEY (an `lw_…` key, sent as
// `Authorization: Bearer`) is passed when set. Parsing in lib/liqwall.
// Feeds the Live horizon of the Liquidation Levels Tracker.

import { withCdnCache } from '../../lib/cdnCache';
import { callMcpTool } from '../../lib/mcpClient';
import { liquidationMapOf } from '../../lib/liqwall';

export const dynamic = 'force-dynamic';

const MCP_URL = 'https://liqwall.com/mcp';
const ASSETS = ['BTC', 'ETH'];
const REVALIDATE = 180;

async function handler() {
  const key = (process.env.LIQWALL_API_KEY || '').trim() || undefined;
  const assets = {};
  const failed = [];

  await Promise.all(
    ASSETS.map(async (coin) => {
      try {
        const json = await callMcpTool(MCP_URL, 'liquidation_map', { coin }, { key, revalidateSeconds: REVALIDATE });
        const map = liquidationMapOf(json);
        if (map) assets[coin] = map;
        else failed.push({ coin, error: `LiqWall's liquidation_map answer for ${coin} had no levels. Raw sample: ${JSON.stringify(json).slice(0, 300)}` });
      } catch (e) {
        failed.push({ coin, error: e.message });
      }
    })
  );

  if (!Object.keys(assets).length) {
    return Response.json({ error: `LiqWall returned nothing usable: ${failed.map((f) => f.error).join(' | ').slice(0, 600)}` }, { status: 502 });
  }
  return Response.json({ assets, failed, source: 'LiqWall', fetchedAt: new Date().toISOString() });
}

export const GET = withCdnCache(handler, REVALIDATE);
