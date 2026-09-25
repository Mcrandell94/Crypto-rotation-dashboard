// Tests for seasonality averages. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { monthStats } = require('./seasonality');

// BTC September returns from the live table on 2026-09-25; 2026 is in progress.
const row = (sep) => Object.assign(Array(12).fill(null), { 8: sep });
const data = {
  years: [2022, 2023, 2024, 2025, 2026],
  monthlyReturns: { 2022: row(0.5), 2023: row(7.9), 2024: row(4.6), 2025: row(6.1), 2026: row(9.3) },
  currentYear: 2026,
  currentMonth: 8,
};

test('the in-progress month is left out of the average and green count', () => {
  const s = monthStats(data, 8);
  assert.equal(s.count, 4);
  assert.equal(s.green, 4);
  assert.equal(s.avg.toFixed(3), ((0.5 + 7.9 + 4.6 + 6.1) / 4).toFixed(3));
});

test('completed months of the current year still count', () => {
  const d = { ...data, currentMonth: 9 }; // October: September 2026 is now complete
  assert.equal(monthStats(d, 8).count, 5);
});

test('no data gives a null average', () => {
  assert.deepEqual(monthStats(data, 0), { avg: null, count: 0, green: 0 });
});
