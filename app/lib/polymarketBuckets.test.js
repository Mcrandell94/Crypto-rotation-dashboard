// Tests for Polymarket event classification. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, isBitcoinOnly, isHourly, hasEnded, dailyRank } = require('./polymarketBuckets');

test('classifies the live title formats', () => {
  // Titles seen live in September 2026.
  assert.equal(classify('What price will Bitcoin hit September 21-27?'), 'weekly');
  assert.equal(classify('What price will Bitcoin hit in September?'), 'monthly');
  assert.equal(classify('What price will Bitcoin hit in 2026?'), 'yearly');
  assert.equal(classify('Bitcoin Up or Down on September 25?'), 'daily');
  assert.equal(classify('Bitcoin Up or Down - September 28, 12PM ET'), 'daily');
});

test('a week that crosses months is still weekly', () => {
  assert.equal(classify('What price will Bitcoin hit September 28-October 4?'), 'weekly');
  assert.equal(classify('What price will Bitcoin hit December 28 - January 3?'), 'weekly');
});

test('skips intraday ranges and other assets', () => {
  assert.equal(classify('Bitcoin Up or Down - September 28, 12:00PM-12:15PM ET'), null);
  assert.equal(isBitcoinOnly('What price will Ethereum hit in September?'), false);
  assert.equal(isBitcoinOnly('What price will Bitcoin hit in September?'), true);
});

test('an ended event is skipped even while Gamma still lists it as open', () => {
  // Seen live 2026-10-10: the 1PM ET hourly market, fetched 18:32Z, still
  // open and pinned at 100% "Up".
  const now = Date.parse('2026-10-10T18:32:55Z');
  assert.equal(hasEnded('2026-10-10T18:00:00Z', now), true);
  assert.equal(hasEnded('2026-10-12T04:00:00Z', now), false);
  assert.equal(hasEnded(undefined, now), false);
});

test('"Today" prefers a whole-day market, then the soonest to resolve', () => {
  assert.equal(isHourly('Bitcoin Up or Down - October 10, 1PM ET'), true);
  assert.equal(isHourly('Bitcoin Up or Down on October 10?'), false);
  const hourSoon = { title: 'Bitcoin Up or Down - October 10, 3PM ET', endDate: '2026-10-10T20:00:00Z' };
  const hourLater = { title: 'Bitcoin Up or Down - October 10, 4PM ET', endDate: '2026-10-10T21:00:00Z' };
  const day = { title: 'Bitcoin Up or Down on October 11?', endDate: '2026-10-11T16:00:00Z' };
  const pick = (list) => [...list].sort((a, b) => dailyRank(a) - dailyRank(b))[0];
  assert.equal(pick([hourLater, hourSoon, day]), day);
  assert.equal(pick([hourLater, hourSoon]), hourSoon);
});
