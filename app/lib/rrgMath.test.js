// Tests for the RRG math. The key regression: with smoothing off (1), the
// readings must match the original in-component implementation exactly.
// Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ema, computeSeries, firstValidIndex, quadrantOf, countFlips, quadrantStreak, heading,
} = require('./rrgMath');

// The original computeSeries from RelativeRotationGraph.js (before the math
// moved into app/lib), kept verbatim as the reference.
function legacyComputeSeries(asset, bench, n, m, zscore) {
  const sma = (arr, i, w) => { const s = arr.slice(Math.max(0, i - w + 1), i + 1); return s.reduce((a, b) => a + b, 0) / s.length; };
  const stdev = (arr, i, w) => {
    const s = arr.slice(Math.max(0, i - w + 1), i + 1);
    if (s.length < 2) return 0;
    const mm = s.reduce((a, b) => a + b, 0) / s.length;
    return Math.sqrt(s.reduce((a, b) => a + (b - mm) ** 2, 0) / (s.length - 1));
  };
  const ratio = asset.map((v, i) => v / bench[i]);
  const rsRatio = zscore
    ? ratio.map((r, i) => { const sd = stdev(ratio, i, n); return sd > 0 ? 100 + (r - sma(ratio, i, n)) / sd : 100; })
    : ratio.map((r, i) => 100 * (r / sma(ratio, i, n)));
  const rsMom = zscore
    ? rsRatio.map((r, i) => { const sd = stdev(rsRatio, i, m); return sd > 0 ? 100 + (r - sma(rsRatio, i, m)) / sd : 100; })
    : rsRatio.map((r, i) => 100 * (r / sma(rsRatio, i, m)));
  return rsRatio.map((_, i) => ({ x: rsRatio[i], y: rsMom[i] }));
}

// Deterministic pseudo-random price paths.
function path(seed, len, drift) {
  let s = seed; let p = 100;
  return Array.from({ length: len }, () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    p *= 1 + drift + (s / 4294967296 - 0.5) * 0.08;
    return p;
  });
}

const bench = path(1, 100, 0.001);
const asset = path(7, 100, 0.003);

test('smoothing off reproduces the original readings exactly (z-score and simple)', () => {
  for (const zscore of [true, false]) {
    const got = computeSeries(asset, bench, { trendWindow: 14, momentumWindow: 5, zscore, smoothing: 1 });
    const want = legacyComputeSeries(asset, bench, 14, 5, zscore);
    assert.deepEqual(got, want);
  }
});

test('ema: span <= 1 is a no-op; otherwise it lags toward the new level', () => {
  assert.deepEqual(ema([1, 2, 3], 1), [1, 2, 3]);
  const e = ema([0, 0, 10, 10, 10], 3); // alpha = 0.5
  assert.deepEqual(e, [0, 0, 5, 7.5, 8.75]);
});

test('smoothing changes readings but keeps the same length', () => {
  const s3 = computeSeries(asset, bench, { trendWindow: 14, momentumWindow: 5, smoothing: 3 });
  const s1 = computeSeries(asset, bench, { trendWindow: 14, momentumWindow: 5, smoothing: 1 });
  assert.equal(s3.length, 100);
  assert.notDeepEqual(s3[99], s1[99]);
});

test('firstValidIndex covers both rolling windows plus EMA warm-up', () => {
  assert.equal(firstValidIndex({ trendWindow: 14, momentumWindow: 5, smoothing: 1 }), 17);
  assert.equal(firstValidIndex({ trendWindow: 14, momentumWindow: 5, smoothing: 3 }), 26);
});

test('quadrantOf splits at 100/100 with ties going to the stronger side', () => {
  assert.equal(quadrantOf(101, 101), 'leading');
  assert.equal(quadrantOf(101, 99), 'weakening');
  assert.equal(quadrantOf(99, 99), 'lagging');
  assert.equal(quadrantOf(99, 101), 'improving');
  assert.equal(quadrantOf(100, 100), 'leading');
});

test('countFlips and quadrantStreak', () => {
  const pts = [
    { x: 99, y: 101 }, // improving
    { x: 101, y: 101 }, // leading
    { x: 102, y: 101 }, // leading
    { x: 102, y: 102 }, // leading
  ];
  assert.equal(countFlips(pts), 1);
  assert.deepEqual(quadrantStreak(pts), { days: 3, from: 'improving' });
  assert.deepEqual(quadrantStreak(pts.slice(1)), { days: 3, from: null });
  assert.deepEqual(quadrantStreak([]), { days: 0, from: null });
});

test('heading uses the net move over the lookback', () => {
  const up = heading([{ x: 100, y: 100 }, { x: 100, y: 101 }, { x: 100, y: 102 }], 2);
  assert.equal(up.arrow, '↑');
  const ne = heading([{ x: 100, y: 100 }, { x: 101, y: 101 }], 1);
  assert.equal(ne.arrow, '↗');
  const sw = heading([{ x: 100, y: 100 }, { x: 99, y: 99 }], 1);
  assert.equal(sw.arrow, '↙');
  assert.equal(heading([{ x: 1, y: 1 }]), null);
  assert.equal(heading([{ x: 1, y: 1 }, { x: 1, y: 1 }]), null);
});

test('presets leave most of the 100-day history plottable', () => {
  const { RRG_PRESETS } = require('./rrgMath');
  assert.deepEqual(RRG_PRESETS.map((p) => p.key), ['fast', 'balanced', 'steady']);
  for (const p of RRG_PRESETS) {
    const warm = firstValidIndex(p.settings);
    assert.ok(warm + p.settings.tailLength <= 50, `${p.key} warm-up ${warm} + tail ${p.settings.tailLength}`);
  }
});
