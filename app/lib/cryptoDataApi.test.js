// Tests for CryptoDataAPI parsing. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { liquidationWindows, takerLegs } = require('./cryptoDataApi');

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
