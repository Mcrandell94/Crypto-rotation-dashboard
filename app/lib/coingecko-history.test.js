// Tests for grouping CoinGecko points into RRG bars. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { barKey, toBars, parseInterval } = require('./coingecko-history');

const t = (iso) => Date.parse(iso);

test('4-hour bars are labelled by their UTC start', () => {
  assert.equal(barKey(t('2026-10-01T00:05:12Z'), '4h'), '2026-10-01 00:00');
  assert.equal(barKey(t('2026-10-01T03:59:59Z'), '4h'), '2026-10-01 00:00');
  assert.equal(barKey(t('2026-10-01T04:00:00Z'), '4h'), '2026-10-01 04:00');
  assert.equal(barKey(t('2026-10-01T23:30:00Z'), '4h'), '2026-10-01 20:00');
});

test('weeks start on Monday (UTC)', () => {
  assert.equal(barKey(t('2026-09-28T00:00:00Z'), '1w'), '2026-09-28'); // Monday
  assert.equal(barKey(t('2026-10-01T12:00:00Z'), '1w'), '2026-09-28'); // Thursday
  assert.equal(barKey(t('2026-10-04T23:59:00Z'), '1w'), '2026-09-28'); // Sunday
  assert.equal(barKey(t('2026-10-05T00:00:00Z'), '1w'), '2026-10-05'); // next Monday
  assert.equal(barKey(t('2027-01-01T00:00:00Z'), '1w'), '2026-12-28'); // across a year end
});

test('a bar takes its last point, whatever order they arrive in', () => {
  const hourly = [
    [t('2026-10-01T05:00:00Z'), 102],
    [t('2026-10-01T04:00:00Z'), 101],
    [t('2026-10-01T07:59:00Z'), 104],
    [t('2026-10-01T08:00:00Z'), 105],
  ];
  assert.deepEqual([...toBars(hourly, '4h')], [['2026-10-01 04:00', 104], ['2026-10-01 08:00', 105]]);
});

test('weekly volume is the mean of the week\'s daily figures', () => {
  const daily = [
    [t('2026-09-28T00:00:00Z'), 10],
    [t('2026-09-29T00:00:00Z'), 20],
    [t('2026-09-30T00:00:00Z'), 30],
    [t('2026-10-05T00:00:00Z'), 99],
  ];
  assert.deepEqual([...toBars(daily, '1w', 'mean')], [['2026-09-28', 20], ['2026-10-05', 99]]);
});

test('non-numbers are skipped; unknown intervals fall back to daily', () => {
  assert.deepEqual([...toBars([[t('2026-10-01T00:00:00Z'), null], [t('2026-10-01T01:00:00Z'), 5]], '1d')], [['2026-10-01', 5]]);
  assert.equal(parseInterval('4h'), '4h');
  assert.equal(parseInterval('1w'), '1w');
  assert.equal(parseInterval('15m'), '1d');
  assert.equal(parseInterval(null), '1d');
});
