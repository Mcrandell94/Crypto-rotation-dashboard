// RRG tail pattern read and projected path.
//
// Pattern: the quadrant a tail sits in plus which way RS-Momentum has moved
// over the last LOOKBACK bars — the classic RRG reads (rolling over,
// hooks, bottoming, failed improvement...). Each pattern names the move it
// tends to lead to, and trackRecord() measures how often that move actually
// followed within HORIZON bars in the history on screen, next to the base
// rate for any tail in that quadrant, so the read is never a bare claim.
//
// Projection: the last step's velocity carried forward, shrinking by
// DAMPING each bar. Tested on real /api/rrg data (~70-80 tickers vs BTC,
// tuned Balanced settings), it named the right quadrant 3 bars ahead
// 57% (1D), 57% (4H), 60% (1W) of the time vs 47% / 51% / 51% for "stays
// where it is"; extrapolating the tail's curl (classic clockwise
// rotation) did no better than standing still, and lighter or heavier
// damping did slightly worse.
//
// Both describe where a tail tends to move on the chart. Neither is a price
// forecast: RS-Momentum is the rate of change of RS-Ratio, so part of this
// is mechanical, and being on the right of the chart did not predict the
// next few bars' relative return on 1D or 4H data.

import { quadrantOf } from './rrgMath.js';

export const LOOKBACK = 3;
export const HORIZON = 5;
export const DAMPING = 0.8;
export const PROJECT_STEPS = 3;

const NEXT = { improving: 'leading', leading: 'weakening', weakening: 'lagging', lagging: 'improving' };
const PREV = { leading: 'improving', weakening: 'leading', lagging: 'weakening', improving: 'lagging' };

// expect: { to, within } = reaches quadrant `to` within HORIZON bars;
//         { stay } = still in that quadrant HORIZON bars later.
export const PATTERNS = {
  'leading-strengthening': {
    name: 'Leading, strengthening', quadrant: 'leading', expect: { stay: 'leading' },
    read: 'Outperforming with momentum still rising — the strongest spot on the chart.',
  },
  'rolling-over': {
    name: 'Rolling over', quadrant: 'leading', expect: { to: 'weakening' },
    read: 'Still outperforming, but momentum is fading; tails like this usually move into Weakening next.',
  },
  'bullish-hook': {
    name: 'Hook back up', quadrant: 'weakening', expect: { to: 'leading' },
    read: 'Momentum turning back up before reaching Lagging — a classic re-acceleration that can re-enter Leading.',
  },
  fading: {
    name: 'Fading', quadrant: 'weakening', expect: { to: 'lagging' },
    read: 'Relative momentum still falling; the usual path from here is into Lagging.',
  },
  bottoming: {
    name: 'Bottoming', quadrant: 'lagging', expect: { to: 'improving' },
    read: 'Still underperforming, but momentum is turning up; tails like this usually move into Improving next.',
  },
  sinking: {
    name: 'Lagging, sinking', quadrant: 'lagging', expect: { stay: 'lagging' },
    read: 'Underperforming with momentum still falling — no sign of a turn yet.',
  },
  'failed-improvement': {
    name: 'Failed improvement', quadrant: 'improving', expect: { to: 'lagging' },
    read: 'Momentum rolling back over before reaching Leading; often drops back into Lagging.',
  },
  improving: {
    name: 'Improving', quadrant: 'improving', expect: { to: 'leading' },
    read: 'Momentum rising and catching up on trend; the usual next step is Leading.',
  },
};

// Pattern key for the tail ending at index i of a full series ([{x, y}]),
// or null when there aren't LOOKBACK earlier points.
export function patternAt(series, i) {
  if (i < LOOKBACK || !series[i] || !series[i - LOOKBACK]) return null;
  const p = series[i];
  const dy = p.y - series[i - LOOKBACK].y;
  const q = quadrantOf(p.x, p.y);
  if (q === 'leading') return dy >= 0 ? 'leading-strengthening' : 'rolling-over';
  if (q === 'weakening') return dy > 0 ? 'bullish-hook' : 'fading';
  if (q === 'lagging') return dy > 0 ? 'bottoming' : 'sinking';
  return dy < 0 ? 'failed-improvement' : 'improving';
}

export function rotationOf(fromQ, toQ) {
  if (!fromQ || fromQ === toQ) return null;
  if (NEXT[fromQ] === toQ) return 'clockwise';
  if (PREV[fromQ] === toQ) return 'counter-clockwise';
  return 'diagonal';
}

// Did the pattern's expected move happen in series[i+1 .. i+HORIZON]?
// null when the series doesn't reach that far yet.
export function expectationMet(series, i, expect, horizon = HORIZON) {
  if (i + horizon >= series.length) return null;
  const fut = series.slice(i + 1, i + horizon + 1).map((p) => quadrantOf(p.x, p.y));
  if (expect.stay) return fut[fut.length - 1] === expect.stay;
  return fut.includes(expect.to);
}

// Projected next `steps` points from the last two points of a tail.
export function projectPath(pts, steps = PROJECT_STEPS, damping = DAMPING) {
  const n = pts.length;
  if (n < 2) return [];
  let vx = pts[n - 1].x - pts[n - 2].x;
  let vy = pts[n - 1].y - pts[n - 2].y;
  let { x, y } = pts[n - 1];
  const out = [];
  for (let k = 0; k < steps; k++) {
    vx *= damping;
    vy *= damping;
    x += vx;
    y += vy;
    out.push({ x, y });
  }
  return out;
}

// Track record over a set of full series (each [{x, y}], all sharing the
// same valid range from `from` up to their last index):
// - patterns[key] = { n, hits, baseN, baseHits }: how often the pattern's
//   expected move followed within HORIZON bars, and the same outcome's rate
//   for any tail in that quadrant.
// - projection = { n, hits, stayHits }: how often the PROJECT_STEPS-bar
//   projection named the right quadrant, vs assuming the tail stays put.
export function trackRecord(seriesList, from) {
  const patterns = Object.fromEntries(Object.keys(PATTERNS).map((k) => [k, { n: 0, hits: 0, baseN: 0, baseHits: 0 }]));
  const projection = { n: 0, hits: 0, stayHits: 0 };
  for (const s of seriesList) {
    for (let i = Math.max(from + LOOKBACK, 1); i < s.length; i++) {
      const q = quadrantOf(s[i].x, s[i].y);
      const key = patternAt(s, i);
      if (key) {
        for (const [k, pat] of Object.entries(PATTERNS)) {
          if (pat.quadrant !== q) continue;
          const met = expectationMet(s, i, pat.expect);
          if (met === null) continue;
          patterns[k].baseN++;
          if (met) patterns[k].baseHits++;
          if (k === key) {
            patterns[k].n++;
            if (met) patterns[k].hits++;
          }
        }
      }
      if (i + PROJECT_STEPS < s.length && i - 1 >= from) {
        const proj = projectPath([s[i - 1], s[i]])[PROJECT_STEPS - 1];
        const actual = quadrantOf(s[i + PROJECT_STEPS].x, s[i + PROJECT_STEPS].y);
        projection.n++;
        if (quadrantOf(proj.x, proj.y) === actual) projection.hits++;
        if (q === actual) projection.stayHits++;
      }
    }
  }
  return { patterns, projection };
}
