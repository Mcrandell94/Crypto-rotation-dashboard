// Tests for the non-crypto market filter. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { isNonCryptoMarket } = require('./nonCryptoMarkets');

test('flags the stock and commodity perps seen in the live feed', () => {
  // From MarginPad's feed on 2026-09-25.
  for (const s of ['SNDK', 'SOXL', 'CL', 'XAU', 'XAG', 'SKHYNIX', 'BZ', 'xyz:NVDA']) assert.equal(isNonCryptoMarket(s), true, s);
});

test('leaves crypto alone, including look-alike tickers', () => {
  for (const s of ['BTC', 'ETH', 'ZEC', 'NEAR', 'HYPE', '1000PEPE', 'ONDO', 'LSK', 'NIL', 'SAGA', 'XPL', 'AKE', 'PUMP', 'SPX', 'PAXG']) {
    assert.equal(isNonCryptoMarket(s), false, s);
  }
});
