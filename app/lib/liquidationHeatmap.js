// A synthetic BTC liquidation-clustering estimate, computed here from real
// price and open-interest data — not pulled from a paid vendor. Coinglass
// gates its own liquidation heatmap/map behind its $699+/mo Professional
// plan; this is the same idea as this project's own options max-pain and
// seasonality panels: compute it ourselves from real underlying data
// rather than pay for someone else's number.
//
// Method adapted from a public open-source project
// (github.com/minchillo4/btc-liquidation-heatmap, read directly since it
// has no published docs site): detect open-interest anomalies relative to
// their own rolling average, classify into three severity tiers, project
// liquidation prices across several leverage levels for each tier, and
// accumulate that OI-weighted value into price buckets — clearing a
// bucket once price actually wicks through it, since those levels would
// have been liquidated for real.
//
// Two adaptations from the original:
// 1. It used hourly bars; ours uses 4-hour bars (the floor both Kraken's
//    ~720-candle cap and this project's Coinglass plan's interval
//    restriction allow), so the rolling-average window is expressed in
//    real hours and converted to a bar count, not hardcoded as a period
//    count — an equivalent lookback window at a coarser resolution.
// 2. The original's long/short column labels have the liquidation
//    direction swapped from the standard convention (a leveraged long is
//    liquidated by a price *drop*, a short by a price *rise*); this
//    implementation uses the standard convention throughout.

const LEV_RATES = { 100: 0.01, 50: 0.02, 25: 0.04, 10: 0.1, 5: 0.2 };
const TIER_LEVERAGE = {
  h3: [100, 50, 25, 10, 5],
  h2: [100, 50, 25, 10],
  h1: [100, 50, 25],
};
const TIER_MULTIPLIER = { h3: 3, h2: 2, h1: 1.2 };
const TIER_THRESHOLD = { h3: 3.0, h2: 2.0, h1: 1.2 };
const MA_WINDOW_HOURS = 60;
export const NUM_BINS = 90;

function rollingMean(values, window) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

// rows: [{ time, close, high, low, closeOi }], oldest first.
// barHours: candle size in hours, used to scale the rolling window from
// the original project's real-time span (60 hours) to a bar count.
export function computeFeatures(rows, barHours) {
  const maWindow = Math.max(1, Math.round(MA_WINDOW_HOURS / barHours));
  const oiDelta = rows.map((r, i) => (i === 0 ? null : r.closeOi - rows[i - 1].closeOi));
  const oiDeltaAbs = oiDelta.map((v) => (v == null ? null : Math.abs(v)));
  const ma = rollingMean(oiDeltaAbs.map((v) => v ?? 0), maWindow);

  return rows.map((r, i) => {
    const delta = oiDelta[i];
    const deltaAbs = oiDeltaAbs[i];
    const maVal = i >= maWindow ? ma[i] : null;
    let tier = null;
    if (delta != null && delta > 0 && maVal != null && maVal > 0) {
      if (deltaAbs >= maVal * TIER_THRESHOLD.h3) tier = 'h3';
      else if (deltaAbs >= maVal * TIER_THRESHOLD.h2) tier = 'h2';
      else if (deltaAbs >= maVal * TIER_THRESHOLD.h1) tier = 'h1';
    }
    return { ...r, oiDelta: delta, oiDeltaAbs: deltaAbs, tier };
  });
}

// Standard convention: a long is liquidated below entry, a short above.
export function computeLiquidationPrices(rows) {
  return rows.map((r) => {
    if (!r.tier) return { ...r, longLiqPrices: [], shortLiqPrices: [] };
    const levels = TIER_LEVERAGE[r.tier];
    return {
      ...r,
      longLiqPrices: levels.map((lev) => r.close * (1 - LEV_RATES[lev])),
      shortLiqPrices: levels.map((lev) => r.close * (1 + LEV_RATES[lev])),
    };
  });
}

export function computeHeatmap(rows) {
  const h3Rows = rows.filter((r) => r.tier === 'h3');
  const lows = h3Rows.map((r) => r.close * (1 - LEV_RATES[5]));
  const highs = h3Rows.map((r) => r.close * (1 + LEV_RATES[5]));
  // Fall back to a plain range around the latest close if no h3 anomaly
  // ever fired, so the bucket range is never empty.
  const lastClose = rows[rows.length - 1]?.close;
  const minLiq = lows.length ? Math.min(...lows) : lastClose * 0.8;
  const maxLiq = highs.length ? Math.max(...highs) : lastClose * 1.2;

  const binEdges = Array.from({ length: NUM_BINS + 1 }, (_, i) => minLiq + ((maxLiq - minLiq) * i) / NUM_BINS);
  const bucketOf = (price) => {
    let bi = 0;
    while (bi < NUM_BINS - 1 && price > binEdges[bi + 1]) bi++;
    return bi;
  };

  const longs = new Array(NUM_BINS).fill(0);
  const shorts = new Array(NUM_BINS).fill(0);

  for (const r of rows) {
    if (r.tier) {
      const weight = r.oiDeltaAbs * TIER_MULTIPLIER[r.tier];
      for (const p of r.longLiqPrices) longs[bucketOf(p)] += weight;
      for (const p of r.shortLiqPrices) shorts[bucketOf(p)] += weight;
    }
    // Clear any bucket this candle's range actually wicked through —
    // those levels would have been liquidated for real, not just modeled.
    for (let bi = 0; bi < NUM_BINS; bi++) {
      if (binEdges[bi] <= r.high && r.low <= binEdges[bi + 1]) {
        longs[bi] = 0;
        shorts[bi] = 0;
      }
    }
  }

  return Array.from({ length: NUM_BINS }, (_, i) => ({
    priceLow: binEdges[i],
    priceHigh: binEdges[i + 1],
    longWeight: longs[i],
    shortWeight: shorts[i],
  }));
}

export function runLiquidationHeatmap(rows, barHours) {
  const withFeatures = computeFeatures(rows, barHours);
  const withPrices = computeLiquidationPrices(withFeatures);
  return computeHeatmap(withPrices);
}
