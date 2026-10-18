// Levels for the Liquidation Levels Tracker, per asset (BTC, ETH — the
// tracker has an asset picker), then per horizon. Each horizon is tracked
// (and gets its own "map update required" banner) separately, since a hit
// on a 1-day magnet is a today-event and a hit on a 1-year magnet is a much
// bigger structural move:
//   live    — filled at runtime from LiqWall's live liquidation map
//             (/api/liquidationmap); no hand-entered levels
//   day1, day3, week1, month1, month3, year1
//           — hand-maintained, read by eye off liquidation heatmap
//             screenshots the user sends
//
// Update a hand-entered horizon's capturedAt/spotAtCapture/source/levels
// wholesale when a new screenshot for that horizon comes in (don't
// merge/diff against the old set — a new screenshot is a new snapshot, not
// an update to the old one). Other horizons are untouched unless a new
// screenshot for them also comes in.
//
// levels entries:
//   { kind: 'level', price, side: 'long' | 'short', label }
//     A single liquidation cluster. `side` is which position type gets
//     liquidated there — 'long' clusters sit below spot, 'short' above.
//   { kind: 'zone', zoneLow, zoneHigh, label }
//     A squeeze zone — a price range with unusually thin liquidity where
//     price could move through quickly. No `side`; hit once price enters
//     the range from either direction.
//
// A level's `side` should match which side of that horizon's
// spotAtCapture it was on when captured (long below, short above) — that
// relationship is what LiquidationLevelsTracker uses to decide whether
// current price has crossed it.
//
// Current hand-entered set: Datawallet's liquidation heatmap, one
// screenshot per timeframe (1D, 3D, 1W, 1M, 3M, 1Y) for each asset, all
// sent 2026-10-18 around 15:00 UTC. Datawallet's own note: "Liquidation
// data is estimated based on open interest and common leverage ratios" —
// a model, like every heatmap of this kind. Bands that ended on the chart
// (price already traded through them) are left out. Eyeballed pixel read
// against each chart's price axis — treat exact prices as approximate
// (about ±0.5% on the short views, ±1% on the 1-year view).

const DATAWALLET = 'Datawallet liquidation heatmap (estimated from open interest and common leverage ratios)';
const CAPTURED_AT = '2026-10-18T15:00:00Z';

const LIVE = {
  key: 'live',
  label: 'Live',
  live: true,
  levels: [],
};

const BTC_HORIZONS = {
  live: LIVE,
  day1: {
    key: 'day1',
    label: '1-Day',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 81147,
    source: `${DATAWALLET}, 1-day view`,
    levels: [
      { kind: 'level', price: 83350, side: 'short', label: 'Pink band, building since about 07:30 UTC' },
      { kind: 'level', price: 82500, side: 'short', label: 'Brightest band above price on the 1-day map' },
      { kind: 'level', price: 82150, side: 'short', label: 'Band just under the $82.5K one' },
      { kind: 'level', price: 80900, side: 'long', label: 'Pink band just under price' },
      { kind: 'level', price: 80500, side: 'long', label: 'Brightest spot on the whole 1-day map, at the right edge' },
      { kind: 'level', price: 80300, side: 'long', label: 'Band under the $80.5K one' },
      { kind: 'level', price: 79500, side: 'long', label: 'Cluster of fainter bands, about $79.3K–$79.7K' },
    ],
  },
  day3: {
    key: 'day3',
    label: '3-Day',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 81078,
    source: `${DATAWALLET}, 3-day view`,
    levels: [
      { kind: 'level', price: 84000, side: 'short', label: 'Wide purple band, about $83.9K–$84.1K' },
      { kind: 'level', price: 83250, side: 'short', label: 'Bright pink band, there since 16 Oct' },
      { kind: 'level', price: 82750, side: 'short', label: 'Orange band, since 17 Oct' },
      { kind: 'level', price: 82500, side: 'short', label: 'Brightest band on the 3-day map, at the right edge (18 Oct)' },
      { kind: 'level', price: 80550, side: 'long', label: 'Pink band just under price' },
      { kind: 'level', price: 80300, side: 'long', label: 'Bright band, since 17 Oct' },
      { kind: 'level', price: 80000, side: 'long', label: 'Band at $80K' },
    ],
  },
  week1: {
    key: 'week1',
    label: '7-Day',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 81056,
    source: `${DATAWALLET}, 1-week view`,
    levels: [
      { kind: 'level', price: 85400, side: 'short', label: 'Purple bands, about $85.2K–$85.6K' },
      { kind: 'level', price: 84550, side: 'short', label: 'Brightest band on the 7-day map, there since 13 Oct' },
      { kind: 'level', price: 83700, side: 'short', label: 'Pink band' },
      { kind: 'level', price: 83250, side: 'short', label: 'Second-brightest band, since 16 Oct' },
      { kind: 'level', price: 82450, side: 'short', label: 'Pink band' },
      { kind: 'level', price: 80100, side: 'long', label: 'Pink band near $80K' },
      { kind: 'level', price: 79200, side: 'long', label: 'Purple band' },
      { kind: 'level', price: 78300, side: 'long', label: 'Purple band' },
    ],
  },
  month1: {
    key: 'month1',
    label: '1-Month',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 81084,
    source: `${DATAWALLET}, 1-month view`,
    levels: [
      { kind: 'level', price: 87500, side: 'short', label: 'Brightest band on the 1-month map, there since 2 Oct' },
      { kind: 'level', price: 85500, side: 'short', label: 'Band' },
      { kind: 'level', price: 84700, side: 'short', label: 'Bright orange band, since about 12 Oct' },
      { kind: 'level', price: 79600, side: 'long', label: 'Pink band, since 14 Oct — the main band below price' },
    ],
  },
  month3: {
    key: 'month3',
    label: '3-Month',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 81079,
    source: `${DATAWALLET}, 3-month view`,
    levels: [
      { kind: 'level', price: 87600, side: 'short', label: 'Pink band, since early October' },
      { kind: 'level', price: 84700, side: 'short', label: 'Pink band, since about 9 Oct' },
      { kind: 'level', price: 79700, side: 'long', label: 'Pink band just under price' },
      { kind: 'level', price: 75000, side: 'long', label: 'Bands about $74.7K–$75.0K, since late August' },
      { kind: 'level', price: 67400, side: 'long', label: 'Bands' },
      { kind: 'level', price: 64500, side: 'long', label: 'Bands' },
      { kind: 'level', price: 62200, side: 'long', label: 'Brightest band on the 3-month map, since mid-August' },
    ],
  },
  year1: {
    key: 'year1',
    label: '1-Year',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 81130,
    source: `${DATAWALLET}, 1-year view`,
    levels: [
      { kind: 'level', price: 112000, side: 'short', label: 'Long-standing band from last November\'s range' },
      { kind: 'level', price: 104000, side: 'short', label: 'Band' },
      { kind: 'level', price: 98300, side: 'short', label: 'Band' },
      { kind: 'level', price: 93500, side: 'short', label: 'Band' },
      { kind: 'level', price: 87500, side: 'short', label: 'Pink band from the September–October highs' },
      { kind: 'level', price: 75000, side: 'long', label: 'Band' },
      { kind: 'level', price: 69000, side: 'long', label: 'Band' },
      { kind: 'level', price: 62000, side: 'long', label: 'Brightest band on the whole 1-year map, since August' },
      { kind: 'level', price: 58000, side: 'long', label: 'Band near the bottom of the range' },
    ],
  },
};

const ETH_HORIZONS = {
  live: LIVE,
  day1: {
    key: 'day1',
    label: '1-Day',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 2380,
    source: `${DATAWALLET}, 1-day view`,
    levels: [
      { kind: 'level', price: 2451, side: 'short', label: 'Pink band' },
      { kind: 'level', price: 2444, side: 'short', label: 'Brightest band on the 1-day map, at the right edge' },
      { kind: 'level', price: 2434, side: 'short', label: 'Pink bands, about $2,430–$2,437' },
      { kind: 'level', price: 2400, side: 'short', label: 'Band at $2,400' },
      { kind: 'level', price: 2369, side: 'long', label: 'Bright band just under price' },
      { kind: 'level', price: 2354, side: 'long', label: 'Red-orange band, since about 21:00 UTC on 17 Oct' },
      { kind: 'level', price: 2345, side: 'long', label: 'Pink band' },
    ],
  },
  day3: {
    key: 'day3',
    label: '3-Day',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 2377,
    source: `${DATAWALLET}, 3-day view`,
    levels: [
      { kind: 'level', price: 2525, side: 'short', label: 'Purple bands' },
      { kind: 'level', price: 2500, side: 'short', label: 'Orange band, since 16 Oct' },
      { kind: 'level', price: 2466, side: 'short', label: 'Pink band' },
      { kind: 'level', price: 2452, side: 'short', label: 'Brightest band on the 3-day map (18 Oct)' },
      { kind: 'level', price: 2385, side: 'short', label: 'Pink band just above price' },
      { kind: 'level', price: 2369, side: 'long', label: 'Bright band just under price' },
      { kind: 'level', price: 2347, side: 'long', label: 'Orange band, since 22:00 UTC on 17 Oct' },
    ],
  },
  week1: {
    key: 'week1',
    label: '7-Day',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 2373,
    source: `${DATAWALLET}, 1-week view`,
    levels: [
      { kind: 'level', price: 2584, side: 'short', label: 'Bright band, since 12 Oct' },
      { kind: 'level', price: 2558, side: 'short', label: 'Brightest band on the 7-day map' },
      { kind: 'level', price: 2534, side: 'short', label: 'Pink band' },
      { kind: 'level', price: 2500, side: 'short', label: 'Bright band' },
      { kind: 'level', price: 2450, side: 'short', label: 'Pink band' },
      { kind: 'level', price: 2420, side: 'short', label: 'Pink band, since 16 Oct' },
      { kind: 'level', price: 2348, side: 'long', label: 'Pink band under price' },
      { kind: 'level', price: 2320, side: 'long', label: 'Band' },
    ],
  },
  month1: {
    key: 'month1',
    label: '1-Month',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 2374,
    source: `${DATAWALLET}, 1-month view`,
    levels: [
      { kind: 'level', price: 2790, side: 'short', label: 'Brightest bands on the 1-month map, about $2,785–$2,800, since 2 Oct' },
      { kind: 'level', price: 2740, side: 'short', label: 'Pink band' },
      { kind: 'level', price: 2635, side: 'short', label: 'Orange-pink band, since about 7 Oct' },
      { kind: 'level', price: 2590, side: 'short', label: 'Pink band, since about 13 Oct' },
      { kind: 'level', price: 2330, side: 'long', label: 'Purple band under price — the below-price side is thin this month' },
    ],
  },
  month3: {
    key: 'month3',
    label: '3-Month',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 2376,
    source: `${DATAWALLET}, 3-month view`,
    levels: [
      { kind: 'level', price: 2790, side: 'short', label: 'Bright bands, about $2,787–$2,800, since early October' },
      { kind: 'level', price: 2635, side: 'short', label: 'Pink band, since about 6 Oct' },
      { kind: 'level', price: 2585, side: 'short', label: 'Band' },
      { kind: 'level', price: 2270, side: 'long', label: 'Purple bands, about $2,245–$2,275' },
      { kind: 'level', price: 2060, side: 'long', label: 'Purple bands' },
      { kind: 'level', price: 1905, side: 'long', label: 'Band' },
      { kind: 'level', price: 1850, side: 'long', label: 'Brightest band on the 3-month map, since mid-August' },
    ],
  },
  year1: {
    key: 'year1',
    label: '1-Year',
    capturedAt: CAPTURED_AT,
    spotAtCapture: 2377,
    source: `${DATAWALLET}, 1-year view`,
    levels: [
      { kind: 'level', price: 3990, side: 'short', label: 'Cluster about $3,930–$4,050, from last November–December\'s range' },
      { kind: 'level', price: 3650, side: 'short', label: 'Band' },
      { kind: 'level', price: 3440, side: 'short', label: 'Band' },
      { kind: 'level', price: 3040, side: 'short', label: 'Band' },
      { kind: 'level', price: 2820, side: 'short', label: 'Band from the September–October highs' },
      { kind: 'level', price: 2420, side: 'short', label: 'Pink band just above price, since about late April' },
      { kind: 'level', price: 1860, side: 'long', label: 'Brightest band on the whole 1-year map, since August' },
      { kind: 'level', price: 1675, side: 'long', label: 'Band' },
      { kind: 'level', price: 1550, side: 'long', label: 'Band near the bottom of the range' },
    ],
  },
};

export const LEVELS_BY_ASSET = {
  BTC: BTC_HORIZONS,
  ETH: ETH_HORIZONS,
};
