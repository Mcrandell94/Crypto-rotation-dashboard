// Hand-maintained from liquidation heatmap screenshots the user uploads
// (Coinglass, BitcoinCounterFlow, or similar — whatever they're looking at).
// There's no working free live API for this data (see this session's history
// with Coinglass's $699+/mo Professional gate, BitcoinCounterFlow's
// Nakamoto PRO key-generation gate, and OpenMarket.xyz's "included in free
// tier" claim turning out to reject the actual heatmap type) — so instead of
// chasing another provider, price levels get read off a screenshot by eye
// and entered here directly.
//
// Organized per-asset (BTC, ETH — LiquidationLevelsTracker has an asset
// picker), then within each asset as independent horizons, since a hit on
// a near-term magnet is a today-event and a hit on a 1-year magnet is a
// much bigger structural move — each is tracked (and its own "map update
// required" banner) separately in LiquidationLevelsTracker:
//   shortTerm  — near-term magnets, from currently-open positions
//   mediumTerm — magnets over the past week
//   monthTerm  — magnets over the past month
//   longTerm   — structural magnets, read off a 1-year heatmap
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

// shortTerm blends two chart types across five venues: Coinglass's
// per-price liquidation LEVERAGE distribution (actual numeric x-axis,
// bar height = leverage volume, from currently-open positions — Binance +
// Bybit) plus BitcoinCounterFlow's own Heatmap Terminal (24h, numeric
// price axis — OKX, Bitget, Hyperliquid), which sharpened the near-spot
// long level from a 5-way cross-check. A bright band right at BCF's
// chart's top edge was NOT used as a level — it's likely a rendering
// artifact (heatmaps often bin everything above the visible range into
// the top row) rather than a genuine standalone cluster.
// mediumTerm — BitcoinCounterFlow's Heatmap Terminal, 1-week view, across
// OKX, Bitget, and Hyperliquid — same tool as shortTerm's BCF read, just a
// wider time window. Its ~$74.5K band is the single brightest feature on
// all three exchanges' weekly view, strongly reinforcing shortTerm's
// $74.5K level (previously backed by only one exchange's leverage chart).
// monthTerm — BitcoinCounterFlow's Heatmap Terminal, 1-month view, same
// three exchanges. The ~$74.5K band is now the single most robustly
// confirmed level in this entire dataset — the brightest feature on all
// three exchanges at all THREE timeframes (24h, 1-week, and 1-month), and
// wider/more saturated the longer the window gets.
// longTerm — Coinglass's 1-year liquidation HEATMAP (color intensity
// over time, Bybit + Binance) — still an eyeballed pixel-intensity read,
// treat exact prices as approximate (±0.5-1%).
const CAPTURED_AT = '2026-09-20T19:00:00Z';
const SPOT_AT_CAPTURE = 81200;
const MEDIUM_CAPTURED_AT = '2026-09-21T00:27:00Z';
const MEDIUM_SPOT_AT_CAPTURE = 81220;
const MONTH_CAPTURED_AT = '2026-09-21T00:30:00Z';
const MONTH_SPOT_AT_CAPTURE = 81140;

const BTC_HORIZONS = {
  shortTerm: {
    key: 'shortTerm',
    label: 'Near-Term (live leverage map)',
    capturedAt: CAPTURED_AT,
    spotAtCapture: SPOT_AT_CAPTURE,
    source: 'Coinglass Binance+Bybit liquidation leverage distribution (numeric axis) plus BitcoinCounterFlow\'s own Heatmap Terminal across OKX, Bitget, and Hyperliquid (24h view) — cross-checked across 5 venues near spot',
    levels: [
      { kind: 'level', price: 84000, side: 'short', label: 'Secondary cluster further above spot — Bybit wide view (~220M)' },
      { kind: 'level', price: 82400, side: 'short', label: 'Dominant cluster just above spot — tallest or near-tallest bar on both Binance and Bybit' },
      { kind: 'zone', zoneLow: 80600, zoneHigh: 82000, label: 'Thin gap between spot and the dominant cluster above — confirmed on Binance, Bybit, and BCF\'s OKX/Bitget/Hyperliquid views' },
      { kind: 'level', price: 78850, side: 'long', label: 'Sharpest, most-confirmed near-term magnet — single hottest line on BCF\'s heatmap across OKX, Bitget, AND Hyperliquid independently, refining the earlier ~$79.7K read' },
      { kind: 'level', price: 74500, side: 'long', label: "Very large cluster further below spot — largest bar on Bybit's wide view, and now also the single brightest band on the 1-week horizon across OKX, Bitget, AND Hyperliquid" },
      { kind: 'level', price: 70700, side: 'long', label: 'Large cluster further out, Binance wide view (~170M)' },
    ],
  },
  mediumTerm: {
    key: 'mediumTerm',
    label: 'Medium-Term (1-week)',
    capturedAt: MEDIUM_CAPTURED_AT,
    spotAtCapture: MEDIUM_SPOT_AT_CAPTURE,
    source: "BitcoinCounterFlow's Heatmap Terminal, 1-week view, cross-checked across OKX, Bitget, and Hyperliquid",
    levels: [
      { kind: 'level', price: 83000, side: 'short', label: 'Moderate band above spot, consistent across all three exchanges' },
      { kind: 'zone', zoneLow: 80300, zoneHigh: 82150, label: 'Thin, dark stretch between spot and the band above — all three exchanges' },
      { kind: 'level', price: 78300, side: 'long', label: 'Moderate band, all three exchanges — overlaps the near-term horizon\'s $78.85K magnet' },
      { kind: 'level', price: 74500, side: 'long', label: 'Dominant, brightest cluster on all three exchanges\' weekly view by a wide margin — the single strongest magnet in this whole horizon' },
    ],
  },
  monthTerm: {
    key: 'monthTerm',
    label: 'Monthly (1-month)',
    capturedAt: MONTH_CAPTURED_AT,
    spotAtCapture: MONTH_SPOT_AT_CAPTURE,
    source: "BitcoinCounterFlow's Heatmap Terminal, 1-month view, cross-checked across OKX, Bitget, and Hyperliquid",
    levels: [
      { kind: 'level', price: 82700, side: 'short', label: 'Consistent moderate band above spot, all three exchanges over the full month' },
      { kind: 'zone', zoneLow: 76800, zoneHigh: 80600, label: 'Broad thin/dark stretch below spot before the dominant band, all three exchanges' },
      { kind: 'level', price: 74500, side: 'long', label: 'The most robustly confirmed level in this entire dataset — brightest, widest band on all three exchanges, and it strengthens the longer the window: present and dominant at 24h, 1-week, AND 1-month' },
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

// ETH horizons — same shape as BTC's. Source: Coinfuty's ETH liquidation
// heatmap, "All exchanges" view — a genuine aggregate across ~17 venues
// (Binance, OKX, Bybit, Bitfinex, Bitmex, Kraken, KuCoin, BingX, Coinbase,
// Crypto.com, MEXC, Gate, Hyperliquid, HTX, Bitget, Lighter, Aster),
// confirmed via the tool's own exchange picker. This is ONE already-
// aggregated chart, not several independent per-exchange charts compared
// against each other the way BCF's BTC reads were — so labeled as an
// aggregate, not as cross-exchange-confirmed. Eyeballed pixel-intensity
// read, same as every other heatmap source here — treat exact prices as
// approximate (±0.5-1%).
//
// Second, cleaner capture — replaces an earlier pass whose screenshots
// didn't show the timeframe selector clearly. These show it explicitly
// (1Y, 1M, 1W, 24H, 4H), so shortTerm now blends the 4H and 24H views
// (near-identical, cross-confirmed) and longTerm is populated for the
// first time. The standout: ~$2.2K is the dominant band on the 1-year,
// 1-month, AND 1-week views — nearly unbroken across the whole year,
// the ETH analog of BTC's $60.5K super-magnet.
const ETH_SOURCE = "Coinfuty — ETH liquidation heatmap, \"All exchanges\" aggregate across ~17 venues (Binance, OKX, Bybit, Bitfinex, Bitmex, Kraken, KuCoin, BingX, Coinbase, Crypto.com, MEXC, Gate, Hyperliquid, HTX, Bitget, Lighter, Aster)";
const ETH_SPOT = 2670;
const ETH_CAPTURED_AT = '2026-09-21T01:33:00Z';

const ETH_HORIZONS = {
  shortTerm: {
    key: 'shortTerm',
    label: 'Near-Term (live leverage map)',
    capturedAt: ETH_CAPTURED_AT,
    spotAtCapture: ETH_SPOT,
    source: ETH_SOURCE + ' — 4H and 24H views, near-identical',
    levels: [
      { kind: 'level', price: 2750, side: 'short', label: 'Thin but consistent line, both 4H and 24H windows' },
      { kind: 'level', price: 2700, side: 'short', label: 'Dominant, wide, solid band right above spot — the most solid feature in both near-term windows' },
      { kind: 'level', price: 2550, side: 'long', label: 'Solid, bright band below spot, both windows' },
      { kind: 'level', price: 2350, side: 'long', label: 'Bright band, both windows' },
      { kind: 'level', price: 2300, side: 'long', label: 'Bright, wide, dominant band, both windows' },
    ],
  },
  mediumTerm: {
    key: 'mediumTerm',
    label: 'Medium-Term (1-week)',
    capturedAt: ETH_CAPTURED_AT,
    spotAtCapture: ETH_SPOT,
    source: ETH_SOURCE + ' — 1-week view',
    levels: [
      { kind: 'level', price: 2780, side: 'short', label: 'Bright band above spot, strongest in the recent portion of the week' },
      { kind: 'level', price: 2700, side: 'short', label: 'Band tight to spot' },
      { kind: 'zone', zoneLow: 2400, zoneHigh: 2520, label: 'Thinner, faint stretch between the near-spot bands and the $2.3K band, most of the week' },
      { kind: 'level', price: 2300, side: 'long', label: 'Bright, wide, persistent band spanning most of the week' },
      { kind: 'level', price: 2200, side: 'long', label: 'Extremely bright, dominant band at the bottom — matches the monthly and yearly views exactly' },
    ],
  },
  monthTerm: {
    key: 'monthTerm',
    label: 'Monthly (1-month)',
    capturedAt: ETH_CAPTURED_AT,
    spotAtCapture: ETH_SPOT,
    source: ETH_SOURCE + ' — 1-month view',
    levels: [
      { kind: 'level', price: 2980, side: 'short', label: 'Weak-moderate band right at the top edge, recent period only — treat cautiously, possible edge effect' },
      { kind: 'level', price: 2750, side: 'short', label: 'Very bright, dominant band just above spot, spans nearly the whole month' },
      { kind: 'level', price: 2600, side: 'long', label: 'Solid band near/below spot' },
      { kind: 'zone', zoneLow: 2400, zoneHigh: 2520, label: 'Thin, faint stretch between the $2.6K and $2.3K bands' },
      { kind: 'level', price: 2300, side: 'long', label: 'Bright, wide, persistent band spanning nearly the whole month' },
      { kind: 'level', price: 2200, side: 'long', label: 'The single most dominant band in this view — extremely bright and wide; also the dominant band on the 1-year view' },
    ],
  },
  longTerm: {
    key: 'longTerm',
    label: '1-Year (structural)',
    capturedAt: ETH_CAPTURED_AT,
    spotAtCapture: ETH_SPOT,
    source: ETH_SOURCE + ' — 1-year view',
    levels: [
      { kind: 'level', price: 3600, side: 'short', label: 'Moderate band, mid-year (Feb-May), faded by now' },
      { kind: 'level', price: 2800, side: 'short', label: 'Solid, wide band just above spot, persistent since around May' },
      { kind: 'level', price: 2200, side: 'long', label: "Dominant, nearly unbroken band spanning almost the entire year — by far the strongest magnet on the chart, the ETH analog of BTC's $60.5K super-magnet" },
      { kind: 'level', price: 1700, side: 'long', label: 'Weaker patches near the bottom edge, mostly in the older (last Sep-early this year) portion of the chart' },
    ],
  },
};

export const LEVELS_BY_ASSET = {
  BTC: BTC_HORIZONS,
  ETH: ETH_HORIZONS,
};
