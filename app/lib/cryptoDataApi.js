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

// --- Pro: Hyperliquid positioning (accounts >= $100k) -------------------

const TYPE_ROWS = [
  ['whale', 'Whales', 'by_type'],
  ['smart_money', 'Smart money', 'by_tag'],
  ['high_leverage', 'High leverage', 'by_tag'],
  ['market_maker', 'Market makers', 'by_type'],
  ['other', 'Everyone else', 'by_type'],
  ['all', 'All accounts', 'by_type'],
];

// /api/v1/quant/positioning?symbol=X: { coins: { X: { mark, positions_as_of,
//   by_type: { market_maker|whale|other|all: { long_usd, short_usd, net_usd,
//   n_accounts } }, by_tag: { smart_money, high_leverage } } } }.
// by_type classes sum to `all`; by_tag groups overlap them.
export function positioningOf(json, symbol) {
  const c = json?.coins?.[symbol];
  if (!c) return null;
  const rows = TYPE_ROWS.map(([key, label, group]) => {
    const r = c[group]?.[key];
    if (!r) return null;
    return { key, label, longUsd: num(r.long_usd), shortUsd: num(r.short_usd), netUsd: num(r.net_usd), nAccounts: num(r.n_accounts) };
  }).filter((r) => r && r.longUsd != null && r.shortUsd != null);
  if (!rows.length) return null;
  return { mark: num(c.mark), rows, asOf: num(c.positions_as_of) ? new Date(c.positions_as_of).toISOString() : null };
}

// /api/v1/quant/whales: the whole >= $100k book in one read.
export function whaleSummaryOf(json) {
  const s = json?.summary;
  if (!s) return null;
  return {
    accounts: num(s.accounts_tracked),
    longPct: num(s.long_pct),
    longShortRatio: num(s.long_short_ratio),
    netBias: s.net_bias || null,
    longUsd: num(s.total_long_usd),
    shortUsd: num(s.total_short_usd),
  };
}

// --- Pro: dealer gamma (Hyperliquid market-maker accounts) --------------

// /api/v1/quant/gex?symbol=X: { coins: { X: { mark, mm_net_delta,
//   mm_n_accounts, gamma_flip, dist_to_flip_pct, levels: [{ price,
//   dist_pct, total_usd, side, n_accounts }], regime: { state, score,
//   confidence, coverage, rationale, since } } } }.
// `levels` are the nearest market-maker liquidation clusters either side
// of the mark (side = which positions liquidate there).
export function gexOf(json, symbol, perSide = 2) {
  const c = json?.coins?.[symbol];
  if (!c || !c.regime?.state) return null;
  const levels = (c.levels || [])
    .map((l) => ({ price: num(l.price), distPct: num(l.dist_pct), totalUsd: num(l.total_usd), side: l.side, nAccounts: num(l.n_accounts) }))
    .filter((l) => l.price != null && l.distPct != null && l.totalUsd != null);
  const byDist = (a, b) => Math.abs(a.distPct) - Math.abs(b.distPct);
  return {
    mark: num(c.mark),
    state: c.regime.state,
    score: num(c.regime.score),
    confidence: num(c.regime.confidence),
    coverage: c.regime.coverage || null,
    rationale: c.regime.rationale || null,
    since: c.regime.since || null,
    flipPrice: num(c.gamma_flip),
    distToFlipPct: num(c.dist_to_flip_pct),
    mmNetDeltaUsd: num(c.mm_net_delta),
    mmAccounts: num(c.mm_n_accounts),
    above: levels.filter((l) => l.distPct > 0).sort(byDist).slice(0, perSide),
    below: levels.filter((l) => l.distPct < 0).sort(byDist).slice(0, perSide),
  };
}
