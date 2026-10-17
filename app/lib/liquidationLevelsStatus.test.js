// Tests for liquidation-level status. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { crossedNow, horizonAge } = require('./liquidationLevelsStatus');

// The BTC 7-day horizon as captured on 2026-09-21 (spot $86,533), checked
// with BTC at $81,208 on 2026-10-17 — the case that showed "0 / 4 hit".
const medium = {
  key: 'mediumTerm',
  capturedAt: '2026-09-21T19:15:00Z',
  spotAtCapture: 86533,
  levels: [
    { kind: 'level', price: 84000, side: 'long' },
    { kind: 'level', price: 83000, side: 'long' },
    { kind: 'level', price: 81000, side: 'long' },
    { kind: 'level', price: 78300, side: 'long' },
  ],
};

test('levels live price is already past count as crossed', () => {
  const hit = medium.levels.filter((l) => crossedNow(l, 81208, medium.spotAtCapture)).map((l) => l.price);
  assert.deepEqual(hit, [84000, 83000]);
  // a short cluster above spot is crossed once price reaches it
  assert.equal(crossedNow({ kind: 'level', price: 88500, side: 'short' }, 88600, 86516), true);
  assert.equal(crossedNow({ kind: 'level', price: 88500, side: 'short' }, 88400, 86516), false);
  // a zone, while price is inside it
  assert.equal(crossedNow({ kind: 'zone', zoneLow: 80000, zoneHigh: 82000 }, 81208), true);
  // no price yet, no verdict
  assert.equal(crossedNow(medium.levels[0], null, medium.spotAtCapture), false);
});

test('a horizon reports its age and the move since capture', () => {
  const a = horizonAge(medium, 81208, Date.parse('2026-10-17T16:30:00Z'));
  assert.equal(a.ageDays, 26);
  assert.equal(a.movePct.toFixed(1), '-6.2');
  assert.equal(horizonAge(medium, null, Date.parse('2026-09-21T20:00:00Z')).movePct, null);
  assert.equal(horizonAge({ key: 'mediumTerm' }, 1), null);
});
