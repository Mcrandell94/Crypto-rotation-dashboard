// Parsing for CryptoDataAPI's market-intelligence endpoints (see
// app/api/derivativesflow). Shapes confirmed against live responses on
// 2026-10-17 (free-tier key). Tested in cryptoDataApi.test.js.

const WINDOWS = ['1h', '4h', '12h', '24h'];

function num(v) {
  const n = v == null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
}

// /api/v1/market-intelligence/liquidations?symbol=X:
// { data: [{ symbol, liquidation_usd_24h, long_liquidation_usd_4h, ... ,
//   count, source }], as_of, coverage: { venues, excludes } }
// Each window is a trailing level (the last 1h, 4h...), not a flow.
export function liquidationWindows(json, symbol) {
  const row = (json?.data || []).find((r) => String(r.symbol).toUpperCase() === symbol);
  if (!row) return null;
  const windows = WINDOWS.map((w) => ({
    window: w,
    longUsd: num(row[`long_liquidation_usd_${w}`]),
    shortUsd: num(row[`short_liquidation_usd_${w}`]),
    totalUsd: num(row[`liquidation_usd_${w}`]),
  })).filter((w) => w.totalUsd != null || w.longUsd != null || w.shortUsd != null);
  if (!windows.length) return null;
  return {
    windows,
    events24h: num(row.count),
    venues: json.coverage?.venues || (row.source ? String(row.source).split('+') : []),
    excludes: json.coverage?.excludes || [],
    asOf: num(json.as_of) ? new Date(json.as_of * 1000).toISOString() : null,
  };
}

// /api/v1/market-intelligence/taker-buy-sell?symbol=X: per-exchange legs
// nested under the coin, each with buy_ratio as a percent (0-100) of
// taker volume that was buying over the trailing 4h:
// { data: [{ symbol, exchange_list: [{ symbol, buy_ratio,
//   exchange_list: [{ exchange: 'Binance', buy_ratio }, ...] }] }] }
// The coin-level buy_ratio isn't a blend of the legs (on BTC it equals the
// Binance leg), so only the legs are used.
export function takerLegs(json, symbol) {
  const entry = (json?.data || []).find((r) => String(r.symbol).toUpperCase() === symbol);
  if (!entry) return null;
  const legs = [];
  const walk = (node) => {
    for (const item of node?.exchange_list || []) {
      const pct = num(item.buy_ratio);
      if (item.exchange && pct != null && pct >= 0 && pct <= 100) legs.push({ exchange: item.exchange, buyPct: pct });
      walk(item);
    }
  };
  walk(entry);
  return legs.length ? { window: '4h', legs } : null;
}
