// Hand-maintained from liquidation heatmap screenshots the user uploads
// (Coinglass, BitcoinCounterFlow, or similar — whatever they're looking at).
// There's no working free live API for this data (see this session's history
// with Coinglass's $699+/mo Professional gate, BitcoinCounterFlow's
// Nakamoto PRO key-generation gate, and OpenMarket.xyz's "included in free
// tier" claim turning out to reject the actual heatmap type) — so instead of
// chasing another provider, price levels get read off a screenshot by eye
// and entered here directly.
//
// Update this file each time a new screenshot comes in: replace CAPTURED_AT,
// SPOT_AT_CAPTURE, and LEVELS wholesale (don't try to merge/diff against the
// old set — a new screenshot is a new snapshot of the book, not an update to
// the old one). Bump CAPTURED_AT to the screenshot's own timestamp if it's
// shown, otherwise the time it was received.
//
// LEVELS entries:
//   { kind: 'level', price, side: 'long' | 'short', label }
//     A single liquidation cluster. `side` is which position type gets
//     liquidated there — 'long' clusters sit below spot, 'short' above.
//   { kind: 'zone', zoneLow, zoneHigh, label }
//     A squeeze zone — a price range with unusually thin liquidity where
//     price could move through quickly. No `side`; hit once price enters
//     the range from either direction.
//
// A level's `side` should match which side of SPOT_AT_CAPTURE it was on
// when captured (long below, short above) — that relationship is what
// LiquidationLevelsTracker uses to decide whether current price has
// crossed it.

// First capture. Read by eye off a BitcoinCounterFlow heatmap chart
// (BTCUSDT, 4h, Binance Futures) — pixel color intensity, not a precise
// vendor extraction, so treat exact prices as approximate (±0.5-1%) until
// refined against the other exchanges' copies. The bright orange/yellow
// band around $82.5K was the one clearly dominant cluster on the chart;
// the rest are moderate green bands. The two zones are stretches that
// read as visibly thin/dark between the marked clusters.
export const CAPTURED_AT = '2026-09-20T22:30:00Z';
export const SPOT_AT_CAPTURE = 80679.71;
export const SOURCE = 'BitcoinCounterFlow heatmap — BTCUSDT 4h, Binance Futures (read by eye from screenshot)';
export const LEVELS = [
  { kind: 'level', price: 82500, side: 'short', label: 'Dominant cluster on the chart — brightest band, just above spot' },
  { kind: 'level', price: 78700, side: 'long', label: 'Moderate cluster, just below spot' },
  { kind: 'level', price: 72300, side: 'long', label: 'Moderate cluster near the early-Aug breakout zone' },
  { kind: 'level', price: 67000, side: 'long', label: 'Moderate cluster, mid-July range' },
  { kind: 'level', price: 62000, side: 'long', label: 'Moderate cluster near the June lows' },
  { kind: 'zone', zoneLow: 80700, zoneHigh: 82400, label: 'Thin band between spot and the $82.5K cluster' },
  { kind: 'zone', zoneLow: 73000, zoneHigh: 78500, label: 'Thin band below the $78.7K cluster' },
];
