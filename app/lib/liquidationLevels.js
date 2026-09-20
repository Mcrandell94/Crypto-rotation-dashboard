// Hand-maintained from liquidation heatmap screenshots the user uploads
// (Coinglass, BitcoinCounterFlow, or similar — whatever they're looking at).
// There's no working free live API for this data (see this session's history
// with Coinglass's $699+/mo Professional gate, BitcoinCounterFlow's
// Nakamoto PRO key-generation gate, and OpenMarket.xyz's "included in free
// tier" claim turning out to reject the actual heatmap type) — so instead of
// chasing another provider, price levels get read off a screenshot by eye
// and entered here directly.
//
// Organized as two independent horizons, since a hit on a near-term magnet
// is a today-event and a hit on a 1-year magnet is a much bigger structural
// move — each is tracked (and its own "map update required" banner)
// separately in LiquidationLevelsTracker:
//   shortTerm — near-term magnets, from currently-open positions
//   longTerm  — structural magnets, read off a 1-year heatmap
//
// Update a horizon's capturedAt/spotAtCapture/source/levels wholesale when
// a new screenshot for that horizon comes in (don't merge/diff against the
// old set — a new screenshot is a new snapshot, not an update to the old
// one). The other horizon is untouched unless a new screenshot for it also
// comes in.
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

// Two different chart types feed the two horizons, both cross-checked
// across Bybit AND Binance:
//   shortTerm — Coinglass's per-price liquidation LEVERAGE distribution
//     (actual numeric x-axis, bar height = leverage volume at that price,
//     from currently-open positions) — precise, not eyeballed color, and
//     the more reliable of the two chart types. Superseded an earlier,
//     less precise eyeballed read off a 24h heatmap.
//   longTerm — Coinglass's 1-year liquidation HEATMAP (color intensity
//     over time) — still an eyeballed pixel-intensity read, treat exact
//     prices as approximate (±0.5-1%).
const CAPTURED_AT = '2026-09-20T19:00:00Z';
const SPOT_AT_CAPTURE = 81200;

export const HORIZONS = {
  shortTerm: {
    key: 'shortTerm',
    label: 'Near-Term (live leverage map)',
    capturedAt: CAPTURED_AT,
    spotAtCapture: SPOT_AT_CAPTURE,
    source: 'Coinglass — Binance + Bybit BTC/USDT liquidation leverage distribution by price (current open positions, wide + zoomed views), cross-checked',
    levels: [
      { kind: 'level', price: 84000, side: 'short', label: 'Secondary cluster further above spot — Bybit wide view (~220M)' },
      { kind: 'level', price: 82400, side: 'short', label: 'Dominant cluster just above spot — tallest or near-tallest bar on both Binance and Bybit' },
      { kind: 'zone', zoneLow: 80600, zoneHigh: 82000, label: 'Thin gap between spot and the dominant cluster above, both exchanges' },
      { kind: 'level', price: 79700, side: 'long', label: 'Dense wall of leveraged positions just below spot, both exchanges' },
      { kind: 'level', price: 74500, side: 'long', label: "Very large cluster further below spot — single largest bar on Bybit's wide view (~350M), less prominent on Binance" },
      { kind: 'level', price: 70700, side: 'long', label: 'Large cluster further out, Binance wide view (~170M)' },
    ],
  },
  longTerm: {
    key: 'longTerm',
    label: '1-Year (structural)',
    capturedAt: CAPTURED_AT,
    spotAtCapture: SPOT_AT_CAPTURE,
    source: 'Coinglass — Bybit + Binance BTC/USDT 1-year liquidation heatmaps, cross-checked (read by eye from screenshot)',
    levels: [
      { kind: 'level', price: 119000, side: 'short', label: "Fading band from last year's highs (Sep-Dec), both exchanges" },
      { kind: 'level', price: 97500, side: 'short', label: 'Distinct, still-active band running Feb-Sep — sharper on Binance, present on Bybit' },
      { kind: 'level', price: 83500, side: 'short', label: 'Moderate cluster near recent price action, both exchanges' },
      { kind: 'level', price: 64000, side: 'long', label: 'Bright recent cluster near the current date, both exchanges' },
      { kind: 'level', price: 60500, side: 'long', label: 'Dominant, unbroken band spanning the entire year — by far the strongest magnet on either chart' },
      { kind: 'zone', zoneLow: 65000, zoneHigh: 95000, label: 'Broad, mostly-thin stretch between the $64K cluster and the $97.5K band' },
    ],
  },
};
