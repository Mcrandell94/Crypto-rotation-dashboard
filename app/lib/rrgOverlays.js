// Optional RRG overlays. None of these change a ticker's RS-Ratio /
// RS-Momentum position — the JdK method is price-only, and blending other
// inputs into the coordinates would distort it. They add confirmation
// layers on top (marker size, hollow marker, a flag) or change how a sector
// composite is weighted. All pure functions, tested in rrgOverlays.test.js.

function mean(arr) {
  const v = arr.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// Relative volume at `end`: average daily volume over the last `short`
// days vs the last `long` days. 1 = normal, 2 = twice normal. null when
// there isn't enough real volume data.
export function relativeVolume(volumes, end, short = 7, long = 30) {
  if (!Array.isArray(volumes) || end < long - 1) return null;
  const recent = mean(volumes.slice(end - short + 1, end + 1));
  const base = mean(volumes.slice(end - long + 1, end + 1));
  if (!recent || !base) return null;
  return recent / base;
}

// Absolute trend: is the price at `end` above its own `window`-day simple
// average (in USD, or index units for sector composites)? An RRG only shows
// strength *relative* to the benchmark, so an asset can sit in Leading
// while falling in dollars, just less than BTC.
export function absoluteTrend(prices, end, window = 20) {
  if (!Array.isArray(prices) || end < window - 1) return null;
  const avg = mean(prices.slice(end - window + 1, end + 1));
  const p = prices[end];
  if (!avg || !Number.isFinite(p)) return null;
  return { above: p >= avg, pct: (p / avg - 1) * 100 };
}

// Sector composites, both rebased so day 0 = 1.0. `members` is an array of
// price arrays aligned to the same days.
// - equal: average of each member's return since day 0 (each counts the same)
// - cap-weighted: each member's return weighted by its market cap on day 0,
//   i.e. a buy-and-hold basket where bigger coins count for more. Members
//   without a day-0 market cap are left out of the weighting.
export function equalWeightComposite(members) {
  const n = members[0]?.length || 0;
  return Array.from({ length: n }, (_, d) => mean(members.map((m) => m[d] / m[0])));
}

export function capWeightComposite(members, day0Caps) {
  const idx = members.map((_, i) => i).filter((i) => Number.isFinite(day0Caps[i]) && day0Caps[i] > 0);
  if (idx.length === 0) return null;
  const total = idx.reduce((a, i) => a + day0Caps[i], 0);
  const n = members[0].length;
  return Array.from({ length: n }, (_, d) => idx.reduce((a, i) => a + (day0Caps[i] / total) * (members[i][d] / members[i][0]), 0));
}

export function capWeights(day0Caps) {
  const total = day0Caps.filter((c) => Number.isFinite(c) && c > 0).reduce((a, b) => a + b, 0);
  return day0Caps.map((c) => (Number.isFinite(c) && c > 0 && total ? c / total : null));
}

// Funding flag from a perpetual's annualized funding rate (%/yr). Hyperliquid's
// neutral baseline is ~11%/yr (0.00125%/hr), so 3x that marks crowded longs;
// negative funding means shorts are paying longs.
export const FUNDING_HOT = 33;
export function fundingFlag(annualizedPct) {
  if (!Number.isFinite(annualizedPct)) return null;
  if (annualizedPct >= FUNDING_HOT) return 'crowded-long';
  if (annualizedPct < 0) return 'shorts-paying';
  return 'neutral';
}
