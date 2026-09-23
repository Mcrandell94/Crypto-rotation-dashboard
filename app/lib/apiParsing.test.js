// Fixture-based tests for the defensive parsing helpers shared by every
// route calling an API whose response shape is unconfirmed or only
// defensively guessed (CoinLobster, TronScan, Solscan). These are exactly
// the functions most likely to silently misbehave when a provider changes
// a field name or an edge-case value shows up — worth locking down with
// real assertions instead of only catching regressions live in
// production, the way every fix this session so far was found.
//
// Run with: npm test (node's built-in test runner — no extra dependency).

const test = require('node:test');
const assert = require('node:assert/strict');
const { pick, extractArray, normalizeTimeMs, scaleAmount } = require('./apiParsing');

test('pick', async (t) => {
  await t.test('returns the first key present with a non-null value', () => {
    assert.equal(pick({ a: 1, b: 2 }, ['a', 'b']), 1);
    assert.equal(pick({ b: 2 }, ['a', 'b']), 2);
  });

  await t.test('skips null/undefined values and keeps looking', () => {
    assert.equal(pick({ a: null, b: undefined, c: 3 }, ['a', 'b', 'c']), 3);
  });

  await t.test('treats 0, "", and false as present (not null)', () => {
    assert.equal(pick({ a: 0 }, ['a', 'b']), 0);
    assert.equal(pick({ a: '' }, ['a', 'b']), '');
    assert.equal(pick({ a: false }, ['a', 'b']), false);
  });

  await t.test('returns null when no key matches', () => {
    assert.equal(pick({ x: 1 }, ['a', 'b']), null);
  });

  await t.test('handles a null/undefined object without throwing', () => {
    assert.equal(pick(null, ['a']), null);
    assert.equal(pick(undefined, ['a']), null);
  });
});

test('extractArray', async (t) => {
  await t.test('returns a bare array as-is', () => {
    assert.deepEqual(extractArray([1, 2, 3], ['data']), [1, 2, 3]);
  });

  await t.test('finds an array under the first matching wrapper key', () => {
    assert.deepEqual(extractArray({ data: [1, 2] }, ['results', 'data']), [1, 2]);
  });

  await t.test('tries wrapper keys in order and uses the first array found', () => {
    assert.deepEqual(extractArray({ results: [1], data: [2] }, ['results', 'data']), [1]);
  });

  await t.test('returns null when nothing array-shaped is found', () => {
    assert.equal(extractArray({ foo: 'bar' }, ['data', 'results']), null);
    assert.equal(extractArray({ data: 'not an array' }, ['data']), null);
  });

  await t.test('handles null/undefined json without throwing', () => {
    assert.equal(extractArray(null, ['data']), null);
    assert.equal(extractArray(undefined, ['data']), null);
  });
});

test('normalizeTimeMs', async (t) => {
  await t.test('treats a number under 1e12 as unix seconds', () => {
    assert.equal(normalizeTimeMs(1720171655), 1720171655000);
  });

  await t.test('treats a number at/above 1e12 as already-ms', () => {
    assert.equal(normalizeTimeMs(1720171655000), 1720171655000);
  });

  await t.test('treats a numeric string the same as a number', () => {
    assert.equal(normalizeTimeMs('1720171655'), 1720171655000);
    assert.equal(normalizeTimeMs('1720171655000'), 1720171655000);
  });

  await t.test('falls back to Date.parse for a genuine date string', () => {
    assert.equal(normalizeTimeMs('2024-07-05T09:27:35.000Z'), Date.parse('2024-07-05T09:27:35.000Z'));
  });

  await t.test('returns null for null/undefined', () => {
    assert.equal(normalizeTimeMs(null), null);
    assert.equal(normalizeTimeMs(undefined), null);
  });

  await t.test('returns null for garbage that parses as neither', () => {
    assert.equal(normalizeTimeMs('not a date'), null);
  });
});

test('scaleAmount', async (t) => {
  await t.test('divides a decimal-string base-unit amount by 10^decimals', () => {
    assert.equal(scaleAmount('1500000', 6), 1.5);
  });

  await t.test('divides a plain number the same way', () => {
    assert.equal(scaleAmount(1500000, 6), 1.5);
  });

  await t.test('handles a hex string (raw ERC-20 log data)', () => {
    // 0x...f4240 == 1_000_000 in decimal, scaled by 6 decimals == 1
    assert.equal(scaleAmount('0xf4240', 6), 1);
  });

  await t.test('handles wei-scale values beyond Number.MAX_SAFE_INTEGER via BigInt', () => {
    // 123456789012345678 wei, at 18 decimals, == ~0.123456789012346
    const result = scaleAmount('123456789012345678', 18);
    assert.ok(Math.abs(result - 0.123456789012345678) < 1e-9);
  });

  await t.test('returns null for a raw value BigInt/Number both reject', () => {
    assert.equal(scaleAmount('not a number', 6), null);
  });

  await t.test('returns null when rawValue or decimals is null/undefined', () => {
    assert.equal(scaleAmount(null, 6), null);
    assert.equal(scaleAmount('100', null), null);
    assert.equal(scaleAmount(undefined, 6), null);
  });

  await t.test('zero is a valid amount, not treated as missing', () => {
    assert.equal(scaleAmount('0', 6), 0);
    assert.equal(scaleAmount(0, 6), 0);
  });
});
