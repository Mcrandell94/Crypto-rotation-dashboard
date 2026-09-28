// Tests for ETF flow cleanup. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { dropUnreported, usEasternDate } = require('./etfFlows');

// The live Coinglass ETH ETF series on Monday 2026-09-28 ended with a 0
// row for that same day, before any flows were reported.
const days = [
  { date: '2026-09-24', netInflow: 66100000 },
  { date: '2026-09-25', netInflow: 87000000 },
  { date: '2026-09-28', netInflow: 0 },
];

test("drops today's not-yet-reported row (US Eastern date)", () => {
  const now = new Date('2026-09-28T16:21:00Z'); // 12:21pm ET
  assert.deepEqual(dropUnreported(days, now).map((d) => d.date), ['2026-09-24', '2026-09-25']);
});

test('keeps a finished day, including a real $0 day', () => {
  const now = new Date('2026-09-29T14:00:00Z');
  assert.equal(dropUnreported(days, now).length, 3);
});

test('uses the Eastern date, not UTC', () => {
  // 01:00 UTC on the 29th is still the 28th in New York.
  assert.equal(usEasternDate(new Date('2026-09-29T01:00:00Z')), '2026-09-28');
});

test('skips rows without a number', () => {
  assert.equal(dropUnreported([{ date: '2026-09-01', netInflow: NaN }], new Date('2026-09-28T16:00:00Z')).length, 0);
});
