// Tests for provider ticker aliases. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { toProviderSymbol, fromProviderResults } = require('./symbolAliases');

test('TON is looked up as GRAM and comes back as TON', () => {
  assert.equal(toProviderSymbol('TON'), 'GRAM');
  assert.equal(toProviderSymbol('BTC'), 'BTC');
  const out = fromProviderResults(['BTC', 'TON'], { BTC: { price: 1 }, GRAM: { price: 1.63 } });
  assert.deepEqual(out, { BTC: { price: 1 }, TON: { price: 1.63 } });
});

test('a same-ticker token in different case is dropped', () => {
  // Live CoinMarketCap response on 2026-09-28 for symbol=TON: key "Ton",
  // price $25.50, market cap $14.8K (not Toncoin).
  const out = fromProviderResults(['BTC', 'TON'], { BTC: { price: 1 }, Ton: { price: 25.5 } });
  assert.deepEqual(out, { BTC: { price: 1 } });
});
