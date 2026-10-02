const test = require('node:test');
const assert = require('node:assert/strict');
const { SECTORS } = require('./sectors.js');
const { COINGECKO_IDS } = require('./coingecko-ids.js');

test('every sector ticker has a CoinGecko id (the RRG prices come from it)', () => {
  for (const s of SECTORS) {
    for (const t of s.tickers) assert.ok(COINGECKO_IDS[t], `${s.key}: ${t} has no CoinGecko id`);
  }
});

test('no ticker sits in two sectors, and no sector outgrows the RRG styles', () => {
  const seen = new Map();
  for (const s of SECTORS) {
    assert.equal(new Set(s.tickers).size, s.tickers.length, `${s.key} repeats a ticker`);
    assert.ok(s.tickers.length <= 16, `${s.key} has ${s.tickers.length} tickers; the RRG has 16 distinct styles`);
    for (const t of s.tickers) {
      assert.ok(!seen.has(t), `${t} is in both ${seen.get(t)} and ${s.key}`);
      seen.set(t, s.key);
    }
  }
  // two tickers can't share a CoinGecko id (that would plot one coin twice)
  const ids = [...seen.keys()].map((t) => COINGECKO_IDS[t]);
  assert.equal(new Set(ids).size, ids.length);
});
