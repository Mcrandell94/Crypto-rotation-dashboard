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

// BTC horizons — replaced wholesale with a fresh Binance BTC/USDT capture
// (Coinglass): two chart types per horizon, the per-price liquidation
// LEVERAGE distribution (bar height = leverage volume from currently-open
// positions, split into 5x/10x/25x/50x/100x bands, with running cumulative
// long/short lines) plus Binance's own liquidation HEATMAP (color
// intensity over time, with its own aggregated per-price side panel).
// Spot has moved meaningfully since the previous (BCF/multi-exchange)
// capture — ~$79-81K then, ~$86.5K now — so this is a fresh read, not a
// diff against the old levels. All four horizons came from Binance
// specifically this round, not a cross-exchange comparison, so
// "confirmed" here means "shows up on both the bar chart AND the heatmap
// for that horizon," not "confirmed across multiple exchanges." $84K and
// $82K-ish clusters recur across every single horizon (24h through
// 1-year) — the closest thing to a standout magnet in this dataset.
// Eyeballed pixel/bar-height read, same as every other source here —
// treat exact prices as approximate (±0.5-1%). The short (above-spot)
// side stays thin at the shorter horizons (24h/1-week/1-month) — real
// short-liquidation clusters only show up once the 1-year view is wide
// enough to include price action from well above current spot.
const BTC_CAPTURED_AT = '2026-09-21T19:15:00Z';
const SHORT_SPOT = 86516;
const MEDIUM_SPOT = 86533;
const MONTH_SPOT = 86571;
const LONG_SPOT = 86533;

const BTC_HORIZONS = {
  shortTerm: {
    key: 'shortTerm',
    label: 'Near-Term (live leverage map)',
    capturedAt: BTC_CAPTURED_AT,
    spotAtCapture: SHORT_SPOT,
    source: "Coinglass Binance BTC/USDT liquidation leverage distribution + Binance's own liquidation heatmap, 24h view",
    levels: [
      { kind: 'level', price: 88500, side: 'short', label: 'Only thin/moderate short-side liquidity has built up above spot so far at this timeframe — light 10x-25x bars, no dominant single level yet' },
      { kind: 'level', price: 86200, side: 'long', label: 'Thin band right below spot, heatmap' },
      { kind: 'level', price: 84000, side: 'long', label: 'Dominant, brightest cluster — tallest bar on the leverage chart AND the brightest, longest band on the heatmap' },
      { kind: 'level', price: 82600, side: 'long', label: 'Secondary cluster, heatmap' },
    ],
  },
  mediumTerm: {
    key: 'mediumTerm',
    label: 'Medium-Term (7-day)',
    capturedAt: BTC_CAPTURED_AT,
    spotAtCapture: MEDIUM_SPOT,
    source: "Coinglass Binance BTC/USDT liquidation leverage distribution + Binance's own liquidation heatmap, 7-day view",
    levels: [
      { kind: 'level', price: 84000, side: 'long', label: 'Cross-confirms the near-term horizon\'s dominant $84K cluster — visible on the 7-day heatmap too' },
      { kind: 'level', price: 83000, side: 'long', label: 'Leverage-chart spike, ~$77M' },
      { kind: 'level', price: 81000, side: 'long', label: 'Brightest, longest band on the 7-day heatmap — the single strongest feature in this horizon' },
      { kind: 'level', price: 78300, side: 'long', label: 'Leverage-chart spike (~$82M) overlapping a heatmap band at the same level' },
    ],
  },
  monthTerm: {
    key: 'monthTerm',
    label: 'Monthly (1-month)',
    capturedAt: BTC_CAPTURED_AT,
    spotAtCapture: MONTH_SPOT,
    source: "Coinglass Binance BTC/USDT liquidation leverage distribution + Binance's own liquidation heatmap, 1-month view",
    levels: [
      { kind: 'level', price: 84000, side: 'long', label: 'Cross-confirms the shorter horizons\' $84K cluster — still visible a month out, heatmap' },
      { kind: 'level', price: 82100, side: 'long', label: 'Single tallest spike on the whole 1-month leverage chart, ~$150M — the dominant level at this horizon' },
      { kind: 'level', price: 81000, side: 'long', label: 'Brightest, longest band on the 1-month heatmap, same level as the 7-day horizon\'s dominant band' },
      { kind: 'level', price: 78900, side: 'long', label: 'Leverage-chart cluster spanning roughly $78.3K-$79.4K' },
      { kind: 'level', price: 77300, side: 'long', label: 'Leverage-chart spike, ~$100M+' },
    ],
  },
  longTerm: {
    key: 'longTerm',
    label: '1-Year (structural)',
    capturedAt: BTC_CAPTURED_AT,
    spotAtCapture: LONG_SPOT,
    source: "Coinglass Binance BTC/USDT liquidation leverage distribution + Binance's own liquidation heatmap, 1-year view",
    levels: [
      { kind: 'level', price: 100000, side: 'short', label: 'Long-standing, historical band on the 1-year heatmap' },
      { kind: 'level', price: 96300, side: 'short', label: 'Leverage-chart spike above spot' },
      { kind: 'level', price: 94600, side: 'short', label: 'Leverage-chart spike above spot' },
      { kind: 'level', price: 93300, side: 'short', label: 'Leverage-chart spike above spot' },
      { kind: 'level', price: 90600, side: 'short', label: 'Leverage-chart spike closest to spot on the short side' },
      { kind: 'level', price: 82300, side: 'long', label: 'Single tallest spike across the ENTIRE dataset, ~$330M on the 1-year leverage chart — by far the most dominant level found at any horizon' },
      { kind: 'level', price: 80000, side: 'long', label: 'Bright, recent band on the 1-year heatmap' },
      { kind: 'level', price: 70000, side: 'long', label: 'Leverage-chart cluster spanning roughly $68.9K-$70.8K, older/deeper price action' },
      { kind: 'level', price: 60000, side: 'long', label: 'Major long-standing support band on the 1-year heatmap, from well before this capture\'s price range' },
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
