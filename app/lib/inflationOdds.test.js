// Tests for reading Kalshi's CPI/PPI ladders. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { ladderOf, readLadder, nextEvent } = require('./inflationOdds');

// One rung as Kalshi returns it (fields as seen live on 2026-10-11).
const rung = (strike, bid, ask, volume = 0, close = '2026-10-14T12:25:00Z') => ({
  ticker: `X-T${strike}`,
  strike_type: 'greater',
  floor_strike: strike,
  yes_bid_dollars: bid.toFixed(4),
  yes_ask_dollars: ask.toFixed(4),
  volume_fp: volume.toFixed(2),
  status: 'active',
  close_time: close,
});

// KXCPI-26SEP, "CPI in September" (headline m/m), live 2026-10-11.
const cpiMom = [
  rung(-0.4, 0.99, 1, 4726), rung(-0.3, 0.99, 1, 5915), rung(-0.2, 0.99, 1, 14449), rung(-0.1, 0.99, 1, 7735),
  rung(0, 0.99, 1, 10680), rung(0.1, 0.99, 1, 15876), rung(0.2, 0.98, 0.99, 28796), rung(0.3, 0.97, 0.98, 41953),
  rung(0.4, 0.9, 0.92, 261343), rung(0.5, 0.64, 0.66, 587164), rung(0.6, 0.16, 0.2, 216530), rung(0.7, 0.01, 0.02, 28700),
  rung(0.8, 0, 0.01, 38606), rung(0.9, 0, 0.01, 13716),
];

// KXUSPPI-26OCT15, "PPI MoM in September", same day: a few hundred
// contracts in all, bids and asks up to $1 apart.
const ppiMom = [
  rung(-0.3, 0, 1), rung(-0.2, 0, 1), rung(-0.1, 0, 1), rung(0, 0, 1), rung(0.1, 0, 1),
  rung(0.2, 0.24, 1), rung(0.3, 0.24, 1, 100), rung(0.4, 0.24, 0.94, 212), rung(0.5, 0.27, 0.96, 17),
  rung(0.6, 0, 1), rung(0.7, 0, 0.97, 165), rung(0.8, 0.21, 0.98, 110), rung(0.9, 0, 0.5, 100),
];

test('a liquid CPI ladder reads as the likeliest printed values', () => {
  const r = readLadder(cpiMom);
  assert.equal(r.readable, true);
  // P(0.6%) = P(above 0.5) - P(above 0.6) = 0.65 - 0.18, and so on
  assert.deepEqual(r.likeliest.map((b) => b.label), ['0.6%', '0.5%', '0.7%']);
  assert.equal(r.likeliest[0].pct, 47);
  assert.equal(r.likeliest[1].pct, 26);
  assert.ok(r.volume > 1_000_000);
});

test('a thin PPI ladder is reported as unreadable, not turned into odds', () => {
  const r = readLadder(ppiMom);
  assert.equal(r.readable, false);
  assert.equal(r.reason, 'thin');
  assert.equal(r.widestSpreadCents, 100);
  assert.equal(r.volume, 704);
});

test('the ladder ignores other strike types and closed rungs, and needs two rungs', () => {
  const extra = [{ ...rung(0.5, 0.5, 0.52), strike_type: 'between' }, { ...rung(0.55, 0.5, 0.52), status: 'closed' }];
  assert.equal(ladderOf([...cpiMom, ...extra]).length, cpiMom.length);
  assert.deepEqual(readLadder([rung(0.5, 0.64, 0.66)]), { readable: false, reason: 'no-ladder' });
});

test('wobbling mids never produce a negative bucket, and wide gaps become ranges', () => {
  // above 0.3 priced a cent over above 0.2: treated as equal, not -1%
  const r = readLadder([rung(0.2, 0.6, 0.62), rung(0.3, 0.61, 0.63), rung(0.5, 0.2, 0.22), rung(0.6, 0, 0.01)]);
  assert.equal(r.readable, true);
  assert.ok(r.likeliest.every((b) => b.pct >= 0));
  assert.equal(r.likeliest[0].label, '0.3–0.5%');
  assert.equal(r.likeliest[0].pct, 40);
});

test('nextEvent picks the soonest release that has not closed', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const ev = (t, close) => ({ event_ticker: t, markets: [rung(0.5, 0.5, 0.52, 0, close)] });
  const events = [ev('KXCPI-26OCT', '2026-11-10T13:25:00Z'), ev('KXCPI-26SEP', '2026-10-14T12:25:00Z'), ev('KXCPI-26AUG', '2026-09-11T12:25:00Z')];
  assert.equal(nextEvent(events, now).e.event_ticker, 'KXCPI-26SEP');
  assert.equal(nextEvent([ev('KXCPI-26AUG', '2026-09-11T12:25:00Z')], now), null);
  assert.equal(nextEvent([], now), null);
});
