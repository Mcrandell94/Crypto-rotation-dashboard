// Status of the hand-entered liquidation levels (lib/liquidationLevels) —
// whether live price has crossed a level, whether price has touched it at
// any point since the screenshot, and how old a horizon's screenshot is.
// Tested in liquidationLevelsStatus.test.js.

const DAY = 86400000;

export function levelId(l) {
  return l.kind === 'zone' ? `zone-${l.zoneLow}-${l.zoneHigh}` : `level-${l.side}-${l.price}`;
}

// Whether one candle's range reaches a level: a long cluster (below spot at
// capture) once the low gets down to it, a short cluster once the high gets
// up to it, a zone once the range overlaps it.
function candleTouches(level, high, low, spotAtCapture) {
  if (level.kind === 'zone') return low <= level.zoneHigh && high >= level.zoneLow;
  return level.price < spotAtCapture ? low <= level.price : high >= level.price;
}

// First time price touched each level after capture, from OHLC candles
// ([openTimeSec, open, high, low, ...], Kraken's shape). Only candles that
// open at or after capture count, so price action from before the
// screenshot can't mark a level hit; a wick that came and went still does.
// Returns { [levelId]: firstTouchMs }.
export function touchesSince(levels, candles, sinceMs, spotAtCapture) {
  const out = {};
  if (!Array.isArray(candles) || !Number.isFinite(sinceMs)) return out;
  const after = candles
    .map((c) => ({ t: Number(c[0]) * 1000, high: Number(c[2]), low: Number(c[3]) }))
    .filter((c) => c.t >= sinceMs && Number.isFinite(c.high) && Number.isFinite(c.low))
    .sort((a, b) => a.t - b.t);
  for (const l of levels) {
    const hit = after.find((c) => candleTouches(l, c.high, c.low, spotAtCapture));
    if (hit) out[levelId(l)] = hit.t;
  }
  return out;
}

// Kraken returns the latest 720 candles per interval: 15-minute candles
// cover about 7.5 days, hourly about 30, 4-hour about 120. The finest one
// that still reaches back to the capture.
export function intervalFor(sinceMs, now = Date.now()) {
  const age = now - sinceMs;
  if (age <= 7 * DAY) return 15;
  if (age <= 29 * DAY) return 60;
  if (age <= 119 * DAY) return 240;
  return 1440;
}

// A level counts as crossed once live price is on the far side of it from
// where spot was when the screenshot was taken (long clusters sit below
// spot, short clusters above); a zone, once price is inside it.
export function crossedNow(level, price, spotAtCapture) {
  if (price == null || !Number.isFinite(price)) return false;
  if (level.kind === 'zone') return price >= level.zoneLow && price <= level.zoneHigh;
  if (spotAtCapture == null) return false;
  return level.price < spotAtCapture ? price <= level.price : price >= level.price;
}

// { ageDays, movePct } for one horizon, or null without a capture time.
export function horizonAge(horizon, price, now = Date.now()) {
  const t = Date.parse(horizon?.capturedAt || '');
  if (!Number.isFinite(t)) return null;
  const ageDays = Math.max(0, Math.round((now - t) / DAY));
  const movePct = price != null && horizon.spotAtCapture ? ((price - horizon.spotAtCapture) / horizon.spotAtCapture) * 100 : null;
  return { ageDays, movePct };
}
