const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PATTERNS, LOOKBACK, HORIZON, patternAt, rotationOf, expectationMet, projectPath, trackRecord,
} = require('./rrgPatterns.js');

const pt = (x, y) => ({ x, y });

test('patternAt reads quadrant plus momentum direction over the lookback', () => {
  // in Leading, momentum falling -> rolling over; rising -> strengthening
  assert.equal(patternAt([pt(101, 103), pt(101, 102.5), pt(101.2, 102), pt(101.5, 101)], 3), 'rolling-over');
  assert.equal(patternAt([pt(101, 100.5), pt(101, 101), pt(101.2, 101.2), pt(101.5, 101.5)], 3), 'leading-strengthening');
  // Weakening with momentum turning up -> hook; Lagging rising -> bottoming
  assert.equal(patternAt([pt(101, 98), pt(101, 98.5), pt(100.8, 99), pt(100.6, 99.5)], 3), 'bullish-hook');
  assert.equal(patternAt([pt(98, 97), pt(98, 98), pt(98.2, 98.5), pt(98.5, 99)], 3), 'bottoming');
  // Improving with momentum rolling over -> failed improvement
  assert.equal(patternAt([pt(98, 102), pt(98.5, 101.5), pt(99, 101), pt(99.2, 100.5)], 3), 'failed-improvement');
  assert.equal(patternAt([pt(98, 100), pt(98, 100.5)], 1), null); // not enough history
  for (const k of Object.keys(PATTERNS)) assert.ok(PATTERNS[k].read && PATTERNS[k].name);
});

test('rotationOf names the direction of a quadrant change', () => {
  assert.equal(rotationOf('improving', 'leading'), 'clockwise');
  assert.equal(rotationOf('leading', 'improving'), 'counter-clockwise');
  assert.equal(rotationOf('leading', 'lagging'), 'diagonal');
  assert.equal(rotationOf('leading', 'leading'), null);
});

test('expectationMet checks the next HORIZON bars and waits for them', () => {
  const s = [pt(101, 101), ...Array.from({ length: HORIZON }, (_, k) => pt(101, 100.5 - k))];
  assert.equal(expectationMet(s, 0, { to: 'weakening' }), true);
  assert.equal(expectationMet(s, 0, { stay: 'leading' }), false);
  assert.equal(expectationMet(s, 1, { to: 'weakening' }), null);
});

test('projectPath carries the last step forward, damped', () => {
  const p = projectPath([pt(100, 100), pt(101, 102)], 3, 0.5);
  assert.deepEqual(p, [pt(101.5, 103), pt(101.75, 103.5), pt(101.875, 103.75)]);
  assert.deepEqual(projectPath([pt(100, 100)]), []);
});

test('trackRecord counts pattern outcomes against the quadrant base rate', () => {
  // A tail that rolls over in Leading and drops into Weakening, then Lagging.
  const s = [];
  for (let k = 0; k < 30; k++) s.push(pt(100 + 2 * Math.cos(-k / 4), 100 + 2 * Math.sin(-k / 4) + 1));
  const r = trackRecord([s], 0);
  const ro = r.patterns['rolling-over'];
  assert.ok(ro.n > 0 && ro.hits <= ro.n && ro.baseN >= ro.n);
  assert.ok(r.projection.n > 0 && r.projection.hits <= r.projection.n);
  // the smooth clockwise circle is exactly what the projection should beat "stay put" on
  assert.ok(r.projection.hits >= r.projection.stayHits);
  assert.equal(LOOKBACK, 3);
});
