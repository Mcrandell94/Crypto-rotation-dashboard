// Locks down the DST handling behind the central bank calendars' decision
// times. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { zonedTime } = require('./zonedTime');

test('Eastern daylight time (October FOMC) is UTC-4', () => {
  assert.equal(zonedTime('2026-10-28', '14:00:00', 'America/New_York').toISOString(), '2026-10-28T18:00:00.000Z');
});

test('Eastern standard time (December FOMC) is UTC-5', () => {
  assert.equal(zonedTime('2026-12-09', '14:00:00', 'America/New_York').toISOString(), '2026-12-09T19:00:00.000Z');
});

test('London summer time is UTC+1, winter is UTC+0', () => {
  assert.equal(zonedTime('2026-06-18', '12:00:00', 'Europe/London').toISOString(), '2026-06-18T11:00:00.000Z');
  assert.equal(zonedTime('2026-12-17', '12:00:00', 'Europe/London').toISOString(), '2026-12-17T12:00:00.000Z');
});
