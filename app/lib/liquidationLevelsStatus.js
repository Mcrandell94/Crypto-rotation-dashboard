// Status of the hand-entered liquidation levels (lib/liquidationLevels) —
// whether live price has crossed a level, and how old a horizon's
// screenshot is. Tested in liquidationLevelsStatus.test.js.

const DAY = 86400000;

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
