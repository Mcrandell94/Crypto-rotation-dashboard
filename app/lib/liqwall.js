// Parsing for LiqWall's liquidation_map MCP tool (liqwall.com/mcp). Shape
// confirmed live on 2026-10-18 (keyless call):
//   { coin, name, hyperliquid: {...}, by_exchange: {
//       time_utc, price, level_step, exchanges: [...],
//       long_liquidations_below_usd: { within_5pct, within_10pct },
//       short_liquidations_above_usd: { within_5pct, within_10pct },
//       largest_levels_within_pct: 10,
//       largest_levels: { columns: ['side', 'price', 'usd', 'distance_pct',
//         'largest_exchange'], rows: [['short liquidations above', 87900,
//         18100000, 8.4, 'Hyperliquid'], ...] } },
//     note, page_url }
// `by_exchange` (Binance, OKX, Bybit, Hyperliquid, Gate and others) is
// preferred; `hyperliquid` alone is the fallback. A level's `price` is the
// lower edge of a `level_step`-wide bucket. Tested in liqwall.test.js.

export function liquidationMapOf(json) {
  const cross = json?.by_exchange?.largest_levels ? json.by_exchange : null;
  const view = cross || (json?.hyperliquid?.largest_levels ? json.hyperliquid : null);
  if (!view) return null;
  const cols = view.largest_levels.columns || [];
  const iSide = cols.indexOf('side');
  const iPrice = cols.indexOf('price');
  const iUsd = cols.indexOf('usd');
  const iDist = cols.indexOf('distance_pct');
  const iEx = cols.indexOf('largest_exchange');
  if (iSide < 0 || iPrice < 0 || iUsd < 0) return null;
  const levels = (view.largest_levels.rows || [])
    .map((r) => ({
      side: /short/i.test(r[iSide]) ? 'short' : /long/i.test(r[iSide]) ? 'long' : null,
      price: Number(r[iPrice]),
      usd: Number(r[iUsd]),
      distancePct: iDist >= 0 ? Number(r[iDist]) : null,
      exchange: iEx >= 0 ? r[iEx] : null,
    }))
    .filter((l) => l.side && Number.isFinite(l.price) && Number.isFinite(l.usd));
  if (!levels.length) return null;
  return {
    price: Number(view.price) || null,
    asOf: view.time_utc || null,
    levelStep: view.level_step ?? null,
    withinPct: view.largest_levels_within_pct ?? null,
    venues: cross ? (view.exchanges || []) : ['Hyperliquid'],
    longBelow: view.long_liquidations_below_usd || null,
    shortAbove: view.short_liquidations_above_usd || null,
    levels,
    pageUrl: json.page_url || null,
  };
}
