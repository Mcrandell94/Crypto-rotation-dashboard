// Tests for CryptoDataAPI parsing. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { liquidationWindows, takerLegs, positioningOf, whaleSummaryOf, gexOf } = require('./cryptoDataApi');

// Live responses, 2026-10-17 15:19 UTC (free-tier key).
const liq = {
  data: [{
    symbol: 'BTC',
    liquidation_usd_24h: 22661654.92349996, liquidation_usd_12h: 214542.54363999996, liquidation_usd_4h: 179598.41612999997, liquidation_usd_1h: 654.3448000000001,
    long_liquidation_usd_24h: 21388873.55982996, long_liquidation_usd_12h: 190949.67230999997, long_liquidation_usd_4h: 178944.07132999998, long_liquidation_usd_1h: 0,
    short_liquidation_usd_24h: 1272781.3636699999, short_liquidation_usd_12h: 23592.871329999998, short_liquidation_usd_4h: 654.3448000000001, short_liquidation_usd_1h: 654.3448000000001,
    count: 2170, source: 'bybit+hyperliquid+okx',
  }],
  as_of: 1792250233,
  coverage: { venues: ['okx', 'bybit', 'hyperliquid'], excludes: ['binance'], windows: ['1h', '4h', '12h', '24h'] },
};
const taker = {
  data: [{ symbol: 'BTC', exchange_list: [{ symbol: 'BTC', buy_ratio: 42.86, exchange_list: [{ exchange: 'Binance', buy_ratio: 42.86 }, { exchange: 'Hyperliquid', buy_ratio: 52.01 }] }] }],
};

test('liquidation windows read long/short per trailing window', () => {
  const r = liquidationWindows(liq, 'BTC');
  assert.deepEqual(r.windows.map((w) => w.window), ['1h', '4h', '12h', '24h']);
  const day = r.windows[3];
  assert.equal(Math.round(day.longUsd), 21388874);
  assert.equal(Math.round(day.shortUsd), 1272781);
  assert.equal(r.windows[0].longUsd, 0); // a real zero stays a zero
  assert.equal(r.events24h, 2170);
  assert.deepEqual(r.excludes, ['binance']);
  assert.equal(r.asOf, '2026-10-17T15:17:13.000Z');
  assert.equal(liquidationWindows(liq, 'ETH'), null);
  assert.equal(liquidationWindows({ data: [{ symbol: 'BTC' }] }, 'BTC'), null);
});

test('taker flow reads each exchange leg, not the coin-level figure', () => {
  assert.deepEqual(takerLegs(taker, 'BTC'), { window: '4h', legs: [{ exchange: 'Binance', buyPct: 42.86 }, { exchange: 'Hyperliquid', buyPct: 52.01 }] });
  assert.equal(takerLegs(taker, 'ETH'), null);
  // an out-of-range ratio is dropped rather than drawn
  const bad = { data: [{ symbol: 'BTC', exchange_list: [{ exchange: 'X', buy_ratio: 140 }] }] };
  assert.equal(takerLegs(bad, 'BTC'), null);
});

// Pro responses, live 2026-10-17 15:45-15:48 UTC.
const positioning = { coins: { BTC: { mark: 81434.5, positions_as_of: 1792251751695,
  by_type: {
    market_maker: { long_usd: 31683009.07, short_usd: 192578799.06, net_usd: -160895789.99, n_accounts: 107 },
    whale: { long_usd: 788333154.71, short_usd: 306032891.36, net_usd: 482300263.36, n_accounts: 65 },
    other: { long_usd: 436217062.75, short_usd: 875804922.63, net_usd: -439587859.88, n_accounts: 1023 },
    all: { long_usd: 1256233226.53, short_usd: 1374416613.04, net_usd: -118183386.51, n_accounts: 1195 },
  },
  by_tag: {
    smart_money: { long_usd: 77790027, short_usd: 989732946.42, net_usd: -911942919.41, n_accounts: 220 },
    high_leverage: { long_usd: 595300440.37, short_usd: 351120117.15, net_usd: 244180323.22, n_accounts: 408 },
  } } } };
const whales = { summary: { accounts_tracked: 3454, total_long_usd: 3737512897.84, total_short_usd: 4615573549.63, long_pct: 44.7, long_short_ratio: 0.81, net_bias: 'short' } };
const gex = { coins: { BTC: { mark: 81396.5, mm_net_delta: -160575554.48, mm_n_accounts: 106, gamma_flip: 101930.627621, dist_to_flip_pct: 25.227,
  levels: [
    { price: 82006.97375, dist_pct: 0.75, total_usd: 6977460.96, side: 'short', n_accounts: 1 },
    { price: 80786.02625, dist_pct: -0.75, total_usd: 71032.53, side: 'long', n_accounts: 2 },
    { price: 80379.04375, dist_pct: -1.25, total_usd: 110483561.85, side: 'long', n_accounts: 3 },
    { price: 82820.93875, dist_pct: 1.75, total_usd: 18388.8, side: 'short', n_accounts: 1 },
    { price: 79972.06125, dist_pct: -1.75, total_usd: 2680097.55, side: 'long', n_accounts: 2 },
    { price: 83227.92125, dist_pct: 2.25, total_usd: 6785778.15, side: 'short', n_accounts: 3 },
  ],
  regime: { state: 'dampen', score: -0.45, confidence: 1, coverage: 'full', rationale: 'funding near baseline; no cluster near mark; flip line far from mark', since: '2026-10-17T15:47:40.226000Z' } } } };

test('positioning rows by trader type, in display order', () => {
  const p = positioningOf(positioning, 'BTC');
  assert.deepEqual(p.rows.map((r) => r.label), ['Whales', 'Smart money', 'High leverage', 'Market makers', 'Everyone else', 'All accounts']);
  assert.equal(Math.round(p.rows[0].netUsd), 482300263);
  assert.equal(p.rows[1].nAccounts, 220);
  assert.equal(positioningOf(positioning, 'ETH'), null);
});

test('whale summary reads the whole-book bias', () => {
  assert.deepEqual(whaleSummaryOf(whales), { accounts: 3454, longPct: 44.7, longShortRatio: 0.81, netBias: 'short', longUsd: 3737512897.84, shortUsd: 4615573549.63 });
  assert.equal(whaleSummaryOf({}), null);
});

test('dealer gamma: regime, flip, and the nearest clusters either side', () => {
  const g = gexOf(gex, 'BTC');
  assert.equal(g.state, 'dampen');
  assert.equal(Math.round(g.flipPrice), 101931);
  assert.deepEqual(g.above.map((l) => l.distPct), [0.75, 1.75]);
  assert.deepEqual(g.below.map((l) => l.distPct), [-0.75, -1.25]);
  assert.equal(Math.round(g.below[1].totalUsd), 110483562);
  assert.equal(gexOf(gex, 'ETH'), null);
  assert.equal(gexOf({ coins: { BTC: { mark: 1 } } }, 'BTC'), null); // no regime, no read
});
