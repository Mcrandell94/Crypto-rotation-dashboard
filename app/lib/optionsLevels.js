// Strike levels from an options book. `instruments` are Deribit options as
// parsed in app/api/options: { type: 'call'|'put', strike, expiry: Date,
// openInterest }. Open interest is summed per strike across every expiry
// that hasn't expired yet. Tested in optionsLevels.test.js.

function oiByStrike(instruments, type, now) {
  const byStrike = new Map();
  for (const i of instruments) {
    if (i.type !== type || !(i.openInterest > 0)) continue;
    if (i.expiry && i.expiry < now) continue;
    byStrike.set(i.strike, (byStrike.get(i.strike) || 0) + i.openInterest);
  }
  return [...byStrike.entries()];
}

// Call walls: the strikes above spot with the most call open interest —
// written calls there tend to act as resistance. Lowest first.
export function callWalls(instruments, price, count = 2, now = new Date()) {
  return oiByStrike(instruments, 'call', now)
    .filter(([strike]) => !price || strike > price)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([strike]) => strike)
    .sort((a, b) => a - b);
}

// Downside insurance: the strike below spot with the most put open interest.
export function downsideInsuranceStrike(instruments, price, now = new Date()) {
  return oiByStrike(instruments, 'put', now)
    .filter(([strike]) => !price || strike < price)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
