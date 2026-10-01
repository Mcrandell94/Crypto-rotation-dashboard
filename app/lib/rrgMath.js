// Pure RRG math, shared by RelativeRotationGraph and its tests. Everything
// here is deterministic on the daily price arrays the API returns — no
// fetching, no React — so the readings can be unit-tested directly.
//
// RS-Ratio / RS-Momentum are a standard open approximation of the JdK
// method, not the proprietary formula:
//   ratio      = asset / benchmark (optionally EMA-smoothed)
//   RS-Ratio   = zscore: 100 + (ratio - SMA_n) / SD_n
//                simple: 100 * ratio / SMA_n
//   RS-Mom     = the same transform applied to RS-Ratio over m days
// 100/100 is the benchmark; quadrants split at 100 on both axes.

export const QUADRANT_ORDER = ['leading', 'weakening', 'lagging', 'improving'];

function sma(arr, i, w) {
  const s = arr.slice(Math.max(0, i - w + 1), i + 1);
  return s.reduce((a, b) => a + b, 0) / s.length;
}

function stdev(arr, i, w) {
  const s = arr.slice(Math.max(0, i - w + 1), i + 1);
  if (s.length < 2) return 0;
  const m = s.reduce((a, b) => a + b, 0) / s.length;
  return Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / (s.length - 1));
}

// Exponential moving average with span `span` (alpha = 2 / (span + 1)).
// span <= 1 returns the input unchanged (smoothing off).
export function ema(arr, span) {
  if (!(span > 1)) return arr.slice();
  const alpha = 2 / (span + 1);
  const out = [];
  let prev = arr[0];
  for (let i = 0; i < arr.length; i++) {
    prev = i === 0 ? arr[0] : alpha * arr[i] + (1 - alpha) * prev;
    out.push(prev);
  }
  return out;
}

// First index whose point is built entirely from full windows. Earlier
// points use partial rolling windows (a 2-day stdev, an EMA still anchored
// on day one) and aren't meaningful, so the chart never shows them.
export function firstValidIndex({ trendWindow, momentumWindow, smoothing = 1 }) {
  const emaWarmup = smoothing > 1 ? 3 * smoothing : 0;
  return emaWarmup + (trendWindow - 1) + (momentumWindow - 1);
}

// Returns [{ x: RS-Ratio, y: RS-Momentum }, ...], one per day, same length
// as the inputs.
export function computeSeries(asset, bench, { trendWindow, momentumWindow, zscore = true, smoothing = 1 }) {
  const raw = asset.map((v, i) => v / bench[i]);
  const ratio = ema(raw, smoothing);
  const n = trendWindow;
  const m = momentumWindow;
  const rsRatio = zscore
    ? ratio.map((r, i) => {
        const sd = stdev(ratio, i, n);
        return sd > 0 ? 100 + (r - sma(ratio, i, n)) / sd : 100;
      })
    : ratio.map((r, i) => 100 * (r / sma(ratio, i, n)));
  const rsMom = zscore
    ? rsRatio.map((r, i) => {
        const sd = stdev(rsRatio, i, m);
        return sd > 0 ? 100 + (r - sma(rsRatio, i, m)) / sd : 100;
      })
    : rsRatio.map((r, i) => 100 * (r / sma(rsRatio, i, m)));
  return rsRatio.map((_, i) => ({ x: rsRatio[i], y: rsMom[i] }));
}

export function quadrantOf(x, y) {
  if (x >= 100 && y >= 100) return 'leading';
  if (x >= 100 && y < 100) return 'weakening';
  if (x < 100 && y < 100) return 'lagging';
  return 'improving';
}

export function countFlips(pts) {
  let f = 0;
  for (let i = 1; i < pts.length; i++) {
    if (quadrantOf(pts[i].x, pts[i].y) !== quadrantOf(pts[i - 1].x, pts[i - 1].y)) f++;
  }
  return f;
}

// How many consecutive days (ending at the last point) the series has sat
// in its current quadrant, and the quadrant it came from before that
// (null if it never changed within the given points).
export function quadrantStreak(pts) {
  if (pts.length === 0) return { days: 0, from: null };
  const q = quadrantOf(pts[pts.length - 1].x, pts[pts.length - 1].y);
  let days = 0;
  for (let i = pts.length - 1; i >= 0; i--) {
    if (quadrantOf(pts[i].x, pts[i].y) !== q) {
      return { days, from: quadrantOf(pts[i].x, pts[i].y) };
    }
    days++;
  }
  return { days, from: null };
}

// Direction of travel over the last `lookback` steps, as an arrow glyph
// and compass angle (0 = right/"strengthening trend", 90 = up/"rising
// momentum"). Uses the net move, so one noisy day doesn't flip it.
const ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];
export function heading(pts, lookback = 3) {
  if (pts.length < 2) return null;
  const a = pts[Math.max(0, pts.length - 1 - lookback)];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) === 0) return null;
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  return { deg, arrow: ARROWS[Math.round(deg / 45) % 8], dx, dy };
}

// Preset reads, tuned jointly on simulated crypto data with known regime
// switches (100 days of history, 3-4.5% daily idiosyncratic vol, 0.4-1.2%/day
// relative drift, regimes of 8-45 days). Measured against the previous
// default (Trend 14 / Momentum 5 / no smoothing: ~2.5 quadrant flips per
// 7 days, ~3.2 days to catch a real switch):
// - fast:     ~2.1 flips / 7d, ~2.3d to catch a switch (quickest, noisier)
// - balanced: ~1.7 flips / 7d, ~3.1d — same speed and accuracy as before,
//             about a third fewer false flips (the default)
// - steady:   ~1.3 flips / 7d, ~4d — calmest; misses more short-lived moves
// Momentum 10 beat 5 at every trend/smoothing combination tested.
export const RRG_PRESETS = [
  {
    key: 'fast', label: 'Fast', blurb: 'Quick turns, noisier',
    note: 'Fast: catches turns about a day sooner, with more false flips. For short-term reads.',
    settings: { trendWindow: 7, momentumWindow: 10, smoothing: 2, tailLength: 5 },
  },
  {
    key: 'balanced', label: 'Balanced', blurb: 'Default',
    note: 'Balanced: the default — same speed as the old settings with about a third fewer false quadrant flips.',
    settings: { trendWindow: 10, momentumWindow: 10, smoothing: 3, tailLength: 7 },
  },
  {
    key: 'steady', label: 'Steady', blurb: 'Big picture, calmest',
    note: 'Steady: the calmest tails, for the bigger picture; slower, and can miss short-lived moves.',
    settings: { trendWindow: 14, momentumWindow: 10, smoothing: 5, tailLength: 10 },
  },
];

// Presets per bar size. The windows are counted in bars, and the best
// trade-off between noise and speed depends on how noisy a bar is relative
// to the trend, so 4-hour and weekly bars have their own tuning rather than
// reusing the daily numbers.
//
// Tuned on real data (live /api/rrg vs BTC, 80 tickers, Oct 2026): the
// real series' per-bar relative volatility and variance ratios (how much
// moves add up vs reverse over 2-20 bars) were fitted with a regime-drift +
// random-walk + mean-reverting-swing model; each Trend/Momentum/Smoothing
// combination was scored on 300 simulated paths with those statistics
// (quadrant flips per 7 bars, share of bars on the right side of 100, bars
// to catch a regime change), then checked on the real series. The same
// method run on real daily data lands on or next to the daily presets
// above. Tails were not tuned (same 5/7/10 bars as daily).
//
// 4H (126 bars, ~1.7% relative vol per bar, regimes ~12-24 bars): a longer
// momentum window (14) won throughout. vs the daily numbers reused on 4H:
// - fast     5/14/2:  same noise (~2.1 flips / 7 bars), ~1.9 vs 2.3 bars to catch a turn
// - balanced 7/14/3:  same noise (~1.7), ~2.7 vs 3.2 bars, fewer missed turns (0.8% vs 2.4%)
// - steady   10/14/5: ~1.4 vs 1.4 flips, ~3.6 vs 4.2 bars, more accurate (56% vs 55%)
//
// 1W (53 bars, ~9.9% relative vol per week, regimes ~24-48 weeks; a
// warm-up over ~35 weeks leaves too little to scrub). vs daily numbers on 1W:
// - fast     7/14/3:  ~1.9 vs 2.1 real flips / 7 weeks, ~2.7 vs 2.4 weeks to catch a turn
// - balanced 14/10/3: ~1.5 vs 1.8 real flips, ~4.7 vs 3.6 weeks, most accurate (62.5% vs 61.7%)
// - steady   14/14/3: ~1.4 vs 1.3 real flips, ~4.7 vs 5.7 weeks, 35- vs 37-week warm-up
export const RRG_PRESETS_BY_INTERVAL = {
  '1d': { tuned: true, presets: RRG_PRESETS },
  '4h': {
    tuned: true,
    presets: [
      {
        key: 'fast', label: 'Fast', blurb: 'Quick turns, noisier',
        note: 'Fast: tuned for 4-hour bars — catches a turn in about 2 bars (~8h), with the most quadrant flips. For intraday reads.',
        settings: { trendWindow: 5, momentumWindow: 14, smoothing: 2, tailLength: 5 },
      },
      {
        key: 'balanced', label: 'Balanced', blurb: 'Default',
        note: 'Balanced: the 4H default, tuned on real 4-hour data — catches a turn in under 3 bars (~11h) with the same noise the daily settings would give here.',
        settings: { trendWindow: 7, momentumWindow: 14, smoothing: 3, tailLength: 7 },
      },
      {
        key: 'steady', label: 'Steady', blurb: 'Big picture, calmest',
        note: 'Steady: the calmest 4H tails, for the multi-day picture; about 3-4 bars (~14h) to catch a turn.',
        settings: { trendWindow: 10, momentumWindow: 14, smoothing: 5, tailLength: 10 },
      },
    ],
  },
  '1w': {
    tuned: true,
    presets: [
      {
        key: 'fast', label: 'Fast', blurb: 'Quick turns, noisier',
        note: 'Fast: tuned for weekly bars — catches a turn in under 3 weeks, with more quadrant flips.',
        settings: { trendWindow: 7, momentumWindow: 14, smoothing: 3, tailLength: 5 },
      },
      {
        key: 'balanced', label: 'Balanced', blurb: 'Default',
        note: 'Balanced: the weekly default, tuned on a year of real weekly data — fewer week-to-week quadrant flips than the daily settings would give, about a week slower to turn.',
        settings: { trendWindow: 14, momentumWindow: 10, smoothing: 3, tailLength: 7 },
      },
      {
        key: 'steady', label: 'Steady', blurb: 'Big picture, calmest',
        note: 'Steady: the calmest weekly tails; its 35-week warm-up leaves the last ~4 months to scrub.',
        settings: { trendWindow: 14, momentumWindow: 14, smoothing: 3, tailLength: 10 },
      },
    ],
  },
};

export function presetsFor(interval) {
  return (RRG_PRESETS_BY_INTERVAL[interval] || RRG_PRESETS_BY_INTERVAL['1d']).presets;
}

export function defaultSettingsFor(interval) {
  return { zscore: true, ...presetsFor(interval).find((p) => p.key === 'balanced').settings };
}
