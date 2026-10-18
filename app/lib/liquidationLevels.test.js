// Checks on the hand-entered levels. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { LEVELS_BY_ASSET } = require('./liquidationLevels');

test('every hand-entered level sits on its own side of spot at capture', () => {
  for (const [asset, horizons] of Object.entries(LEVELS_BY_ASSET)) {
    for (const h of Object.values(horizons)) {
      if (h.live) continue;
      assert.ok(Number.isFinite(Date.parse(h.capturedAt)), `${asset} ${h.key} capturedAt`);
      for (const l of h.levels) {
        if (l.kind === 'zone') continue;
        const ok = l.side === 'long' ? l.price < h.spotAtCapture : l.price > h.spotAtCapture;
        assert.ok(ok, `${asset} ${h.key} ${l.side} ${l.price} vs spot ${h.spotAtCapture}`);
      }
    }
  }
});

test('both assets offer the same horizons, live first', () => {
  const keys = Object.keys(LEVELS_BY_ASSET.BTC);
  assert.deepEqual(Object.keys(LEVELS_BY_ASSET.ETH), keys);
  assert.equal(keys[0], 'live');
});
