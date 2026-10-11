// Reading Kalshi's CPI and PPI markets (see app/api/inflationodds). Tested
// in inflationOdds.test.js.
//
// Each release is a ladder of binary "Above X%" markets (strike_type
// "greater", floor_strike X): YES pays $1 if the printed figure is above
// X, so a rung's price is the market's probability of that. Prices come as
// dollar strings ("0.6400"), volumes as "587164.17".
//
// The odds for one printed value (BLS rounds to 0.1) are the difference
// between neighbouring rungs: P(prints 0.6%) = P(above 0.5%) - P(above
// 0.6%). That only means something if every rung is really trading. On
// 2026-10-11 Kalshi's CPI ladders had 1-2¢ spreads and hundreds of
// thousands of contracts traded; its PPI ladders had bids and asks up to
// $1 apart, a few hundred contracts and prices that contradicted each
// other (above 5.3% bid higher than above 5.0%) — those are reported as
// too thin to read rather than turned into numbers.

// Within 3¢ of $0 or $1: the market treats it as settled either way.
const PINNED = 0.03;
// The widest bid/ask gap a rung can have and still count as a price.
export const MAX_SPREAD = 0.1;

function num(v) {
  const n = v == null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
}

// The "Above X%" rungs, lowest strike first.
export function ladderOf(markets) {
  return (markets || [])
    .filter((m) => m.strike_type === 'greater' && num(m.floor_strike) != null && (m.status == null || m.status === 'active'))
    .map((m) => {
      const bid = num(m.yes_bid_dollars) ?? 0;
      const ask = num(m.yes_ask_dollars) ?? 1;
      return { strike: num(m.floor_strike), bid, ask, mid: (bid + ask) / 2, volume: num(m.volume_fp) ?? 0 };
    })
    .sort((a, b) => a.strike - b.strike);
}

const isPinned = (r) => r.bid >= 1 - PINNED || r.ask <= PINNED;
const isTight = (r) => r.bid > 0 && r.ask < 1 && r.ask - r.bid <= MAX_SPREAD;
const fmt = (x) => x.toFixed(1);

// The likeliest printed values, most likely first, or why there aren't any:
// { readable: true, likeliest: [{ label: '0.6%', pct: 47 }, ...], volume }
// { readable: false, reason: 'thin', widestSpreadCents, volume }
// { readable: false, reason: 'no-ladder' }
export function readLadder(markets, top = 3) {
  const rungs = ladderOf(markets);
  if (rungs.length < 2) return { readable: false, reason: 'no-ladder' };
  const volume = Math.round(rungs.reduce((s, r) => s + r.volume, 0));
  const loose = rungs.filter((r) => !isPinned(r) && !isTight(r));
  if (loose.length) {
    const widest = Math.max(...loose.map((r) => r.ask - r.bid));
    return { readable: false, reason: 'thin', widestSpreadCents: Math.round(widest * 100), volume };
  }

  // P(above X) can only fall as X rises; tight mids can still wobble a cent.
  const p = rungs.map((r) => r.mid);
  for (let i = 1; i < p.length; i++) p[i] = Math.min(p[i], p[i - 1]);

  const last = rungs.length - 1;
  const buckets = [{ label: `${fmt(rungs[0].strike)}% or lower`, p: 1 - p[0] }];
  for (let i = 0; i < last; i++) {
    const lo = rungs[i].strike;
    const hi = rungs[i + 1].strike;
    // a 0.1 step is one printed value; a wider gap is a range
    const label = Math.abs(hi - lo - 0.1) < 1e-9 ? `${fmt(hi)}%` : `${fmt(lo)}–${fmt(hi)}%`;
    buckets.push({ label, p: p[i] - p[i + 1] });
  }
  buckets.push({ label: `above ${fmt(rungs[last].strike)}%`, p: p[last] });

  const likeliest = buckets
    .map((b) => ({ label: b.label, pct: Math.round(b.p * 100) }))
    .filter((b) => b.pct >= 1)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, top);
  return { readable: true, likeliest, volume };
}

// The event for the next release: the open one whose markets close soonest
// but haven't closed yet. Kalshi closes them minutes before BLS publishes.
export function nextEvent(events, now = Date.now()) {
  const closeOf = (e) => Math.min(...(e.markets || []).map((m) => Date.parse(m.close_time)).filter(Number.isFinite));
  return (events || [])
    .map((e) => ({ e, close: closeOf(e) }))
    .filter((x) => Number.isFinite(x.close) && x.close > now)
    .sort((a, b) => a.close - b.close)[0] || null;
}
