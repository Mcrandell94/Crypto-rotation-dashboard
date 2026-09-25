// Tests for the Fed-decision parsing. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { decisionOutcomes } = require('./fedOdds');

const market = (groupItemTitle, yes, extra = {}) => ({
  groupItemTitle, question: `Will the Fed ${groupItemTitle}?`,
  outcomes: '["Yes","No"]', outcomePrices: JSON.stringify([String(yes), String(1 - yes)]), ...extra,
});

test('one labeled outcome per decision market, most likely first', () => {
  const out = decisionOutcomes([
    market('25 bps decrease', 0.04),
    market('No change', 0.955),
    market('25+ bps increase', 0.005),
  ]);
  assert.deepEqual(out.map((o) => o.label), ['No change', '25 bps decrease', '25+ bps increase']);
  assert.equal(out[0].pct, 95.5);
});

test('skips closed markets and ones without a Yes price', () => {
  const out = decisionOutcomes([
    market('No change', 0.9),
    market('50+ bps decrease', 0.01, { closed: true }),
    { groupItemTitle: 'Broken', outcomes: '["Up","Down"]', outcomePrices: '["0.5","0.5"]' },
    { groupItemTitle: 'Garbled', outcomes: 'not json' },
  ]);
  assert.deepEqual(out, [{ label: 'No change', pct: 90 }]);
});

test('falls back to the question when there is no group title', () => {
  const out = decisionOutcomes([{ question: 'Fed cuts in October?', outcomes: '["Yes","No"]', outcomePrices: '["0.2","0.8"]' }]);
  assert.deepEqual(out, [{ label: 'Fed cuts in October?', pct: 20 }]);
  assert.deepEqual(decisionOutcomes(undefined), []);
});
