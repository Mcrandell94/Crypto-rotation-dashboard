// Tests for options strike levels. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { callWalls, downsideInsuranceStrike } = require('./optionsLevels');

const now = new Date('2026-09-25T02:00:00Z');
const later = new Date('2026-10-30T08:00:00Z');
const opt = (type, strike, openInterest, expiry = later) => ({ type, strike, openInterest, expiry });

test('call walls sit above spot, summed across expiries', () => {
  const book = [
    opt('call', 70000, 30000), // deep in the money: not a wall
    opt('call', 80000, 20000),
    opt('call', 95000, 15000),
    opt('call', 95000, 10000, new Date('2026-12-25T08:00:00Z')), // 25k total at 95k
    opt('call', 90000, 19000),
    opt('call', 100000, 12000),
  ];
  assert.deepEqual(callWalls(book, 85486, 2, now), [90000, 95000]);
});

test('expired instruments are ignored', () => {
  const book = [opt('call', 90000, 50000, new Date('2026-09-24T08:00:00Z')), opt('call', 100000, 1)];
  assert.deepEqual(callWalls(book, 85000, 2, now), [100000]);
});

test('downside insurance is the heaviest put strike below spot', () => {
  const book = [opt('put', 90000, 99999), opt('put', 70000, 500), opt('put', 70000, 600), opt('put', 75000, 900)];
  assert.equal(downsideInsuranceStrike(book, 85000, now), 70000);
  assert.equal(downsideInsuranceStrike([], 85000, now), null);
});
