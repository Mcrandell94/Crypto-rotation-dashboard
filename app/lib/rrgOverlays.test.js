// Tests for the optional RRG overlays. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  relativeVolume, absoluteTrend, equalWeightComposite, capWeightComposite, capWeights, fundingFlag,
} = require('./rrgOverlays');

test('relativeVolume: recent vs longer average, null without enough data', () => {
  const flat = Array(30).fill(100);
  assert.equal(relativeVolume(flat, 29), 1);
  const spike = [...Array(23).fill(100), ...Array(7).fill(300)];
  // recent 7 = 300; last 30 = (23*100 + 7*300) / 30
  assert.equal(relativeVolume(spike, 29).toFixed(4), (300 / ((2300 + 2100) / 30)).toFixed(4));
  assert.equal(relativeVolume(flat, 10), null);
  assert.equal(relativeVolume(null, 29), null);
  assert.equal(relativeVolume(Array(30).fill(null), 29), null);
});

test('absoluteTrend: price vs its own 20-day average', () => {
  const rising = Array.from({ length: 25 }, (_, i) => 100 + i);
  assert.equal(absoluteTrend(rising, 24).above, true);
  const falling = Array.from({ length: 25 }, (_, i) => 100 - i);
  const t = absoluteTrend(falling, 24);
  assert.equal(t.above, false);
  assert.ok(t.pct < 0);
  assert.equal(absoluteTrend(rising, 5), null);
});

test('composites: equal weight vs cap weight', () => {
  const big = [100, 110]; // +10%
  const small = [1, 1.5]; // +50%
  assert.deepEqual(equalWeightComposite([big, small]), [1, 1.3]);
  // caps 900 vs 100 -> weights 0.9 / 0.1 -> 0.9*1.1 + 0.1*1.5 = 1.14
  const cw = capWeightComposite([big, small], [900, 100]);
  assert.equal(cw[0], 1);
  assert.equal(cw[1].toFixed(6), '1.140000');
  // a member with no cap is left out of the weighting
  assert.equal(capWeightComposite([big, small], [900, null])[1].toFixed(6), '1.100000');
  assert.equal(capWeightComposite([big, small], [null, undefined]), null);
  assert.deepEqual(capWeights([900, 100, null]), [0.9, 0.1, null]);
});

test('fundingFlag thresholds', () => {
  assert.equal(fundingFlag(10.95), 'neutral');
  assert.equal(fundingFlag(40), 'crowded-long');
  assert.equal(fundingFlag(-5), 'shorts-paying');
  assert.equal(fundingFlag(undefined), null);
});
