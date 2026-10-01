// Tests for Polymarket event classification. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, isBitcoinOnly } = require('./polymarketBuckets');

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
