// Tests for picking the nearest liquidation clusters. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { nearestClusters } = require('./liquidationHeatmap');

const bin = (lo, longWeight, shortWeight = 0) => ({ priceLow: lo, priceHigh: lo + 500, longWeight, shortWeight });

// Shaped like the live Coinalyze BTC map on 2026-09-25 (spot ~84,800):
// slivers right next to spot, real clusters a few % away, and a huge
// stale long level far below.
const bins = [
  bin(61500, 245000), // stale, far outside the ±25% window
  bin(64000, 66000),
  bin(73700, 55000),
  bin(80200, 19600),
  bin(81300, 11100),
  bin(83100, 1300), // sliver next to spot
  bin(85400, 0, 1650), // sliver next to spot
  bin(87700, 0, 24600),
  bin(88900, 0, 40500),
  bin(91800, 0, 49000),
];

test('skips slivers next to spot and picks the nearest real cluster', () => {
  const { nearestLongCluster, nearestShortCluster } = nearestClusters(bins, 84800);
  assert.equal(nearestLongCluster.priceLow, 80200); // 19.6k >= 25% of 66k (window max)
  assert.equal(nearestShortCluster.priceLow, 87700); // 24.6k >= 25% of 49k
});

test('a stale far-away level does not hide nearby clusters', () => {
  // With the 245k bin counted, 25% would be 61k and only 64k/61.5k qualify.
  const { nearestLongCluster } = nearestClusters(bins, 84800, { windowPct: 1 });
  assert.equal(nearestLongCluster.priceLow, 64000);
});

test('falls back to the whole side when nothing is inside the window', () => {
  const { nearestLongCluster, nearestShortCluster } = nearestClusters([bin(40000, 10), bin(45000, 2)], 84800);
  assert.equal(nearestLongCluster.priceLow, 40000);
  assert.equal(nearestShortCluster, null);
});
