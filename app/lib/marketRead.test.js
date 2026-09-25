// Tests for the Market Read header, fed with response shapes taken from
// the live production API on 2026-09-25. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeMarketRead, openInterestChange24h, sectorQuadrants } = require('./marketRead');

// /api/options and /api/seasonality are per asset ({ assets: { BTC, ETH } }).
const optionsData = {
  assets: {
    BTC: {
      price: 85486.13, callsPct: 62.2,
      expiries: [{ date: 'Sep 25', type: 'quarterly', maxPain: 78000 }],
    },
  },
};
const septRow = (v) => Object.assign(Array(12).fill(null), { 8: v });
const seasonalityData = {
  assets: {
    BTC: {
      years: [2022, 2023, 2024, 2025, 2026],
      monthlyReturns: { 2022: septRow(0.5), 2023: septRow(7.9), 2024: septRow(4.6), 2025: septRow(6.1), 2026: septRow(9.3) },
      currentYear: 2026, currentMonth: 8,
    },
  },
};
const texts = (read) => read.factors.map((f) => f.text).join('\n');

test('reads BTC out of the per-asset options and seasonality responses', () => {
  const t = texts(computeMarketRead({ optionsData, seasonalityData }));
  assert.match(t, /Options book is 62.2% calls/);
  assert.match(t, /Max pain for the nearest quarterly sits 8.8% below spot/);
  // 4 completed Septembers; September 2026 (in progress) is left out.
  assert.match(t, /averages \+4.8% over 4 completed years/);
});

test('funding uses the same crowded-long line as the RRG overlay (33%/yr)', () => {
  const at = (v) => texts(computeMarketRead({ fundingData: { data: { BTC: { fundingRateAnnualized: v } } } }));
  assert.doesNotMatch(at(25), /running hot/);
  assert.match(at(40), /running hot at 40.0%/);
});

test('open interest change is summed across venues', () => {
  const oi = { assets: { BTC: { byExchange: [
    { openInterestUsd: 110, change24h: 10 }, // 100 -> 110
    { openInterestUsd: 90, change24h: -10 }, // 100 -> 90
    { openInterestUsd: 50, change24h: null }, // no change figure: skipped
  ] } } };
  assert.equal(openInterestChange24h(oi).toFixed(6), '0.000000');
  assert.equal(openInterestChange24h(null), null);
});

test('leverage factor only fires when OI rises with a real move', () => {
  const oi = (c) => ({ assets: { BTC: { byExchange: [{ openInterestUsd: 100, change24h: c }] } } });
  const read = (c, move) => texts(computeMarketRead({ openInterestData: oi(c), btcTicker: { percentChange24h: move } }));
  assert.match(read(3, 2), /open interest up 3.0% in 24h with price up/);
  assert.match(read(3, -2), /with price down — shorts pressing/);
  assert.doesNotMatch(read(-3, 2), /open interest/);
  assert.doesNotMatch(read(1, 2), /open interest/);
});

test('7-day liquidation skew (live BTC: $480M shorts vs $223M longs)', () => {
  const liq = (l, s) => ({ assets: { BTC: { last7dLong: l, last7dShort: s } } });
  assert.match(texts(computeMarketRead({ liquidationsData: liq(222742828, 479577135) })), /Shorts squeezed: \$480M short vs \$223M long/);
  assert.match(texts(computeMarketRead({ liquidationsData: liq(500e6, 100e6) })), /Longs flushed/);
  assert.doesNotMatch(texts(computeMarketRead({ liquidationsData: liq(300e6, 200e6) })), /liquidations/);
});

test('sector quadrants from the sectors-vs-BTC composites', () => {
  const n = 60;
  const bench = Array.from({ length: n }, () => 100);
  // Accelerating outperformance -> leading. A fall that has flattened out in
  // z-score terms reads as improving (momentum turning up while still weak).
  const up = Array.from({ length: n }, (_, i) => 100 * Math.exp(0.0002 * i * i));
  const down = Array.from({ length: n }, (_, i) => 100 * Math.exp(-0.0002 * i * i));
  const q = sectorQuadrants({ benchmark: 'BTC', prices: { BTC: bench, DeFi: up, 'Meme & Culture': down } });
  assert.deepEqual(q.leading, ['DeFi']);
  assert.deepEqual(q.improving, ['Meme']); // labels are the sectors' short names
  assert.deepEqual(q.lagging, []);
  assert.equal(sectorQuadrants(null), null);
});
