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

// Second capture, superseding the first. Read by eye off the same
// BitcoinCounterFlow chart (BTCUSDT, 4h, Binance Futures) with three more
// overlays turned on (Liq. Heatmap VPVR, Orderbook VPVR, Orderbook
// Heatmap) — much more textured than the first capture, and it changed
// the read materially: the mid-range clusters from the first pass
// (~$72.3K, ~$67K) don't hold up here, that stretch now reads as thin
// rather than clustered. Still an eyeballed pixel-intensity read, not a
// precise extraction — treat exact prices as approximate (±0.5-1%).
export const CAPTURED_AT = '2026-09-21T00:00:00Z';
export const SPOT_AT_CAPTURE = 81119.80;
export const SOURCE = 'BitcoinCounterFlow heatmap — BTCUSDT 4h, Binance Futures, with Liq. Heatmap VPVR + Orderbook VPVR + Orderbook Heatmap overlays (read by eye from screenshot)';
export const LEVELS = [
  { kind: 'level', price: 82300, side: 'short', label: 'Top edge of the dense hot zone surrounding spot' },
  { kind: 'level', price: 78300, side: 'long', label: 'Bottom edge of the dense hot zone surrounding spot' },
  { kind: 'level', price: 60000, side: 'long', label: 'Wide, persistent band — the single most consistent level on the chart, spans nearly the whole visible history' },
  { kind: 'zone', zoneLow: 70000, zoneHigh: 76000, label: 'Thin band between the dense zone around spot and the $60K level' },
];
