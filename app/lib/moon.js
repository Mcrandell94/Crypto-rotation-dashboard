// Real moon-phase astronomy, computed from orbital mechanics — not an API,
// not astrology. Uses a standard synodic-month calculation referenced off a
// known new moon (Jan 6, 2000, 18:14 UTC). Accurate to within about a day
// (a full perturbation-corrected ephemeris would be exact, but that's more
// precision than a "what phase is the moon in tonight" reference needs).

const SYNODIC_MONTH_DAYS = 29.53058867;
const KNOWN_NEW_MOON_JD = 2451550.09765;

function toJulianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function fromJulianDay(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

// Days elapsed since the most recent new moon, as a fraction of one full
// synodic month (0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter).
function phaseFraction(date) {
  const jd = toJulianDay(date);
  let days = (jd - KNOWN_NEW_MOON_JD) % SYNODIC_MONTH_DAYS;
  if (days < 0) days += SYNODIC_MONTH_DAYS;
  return days / SYNODIC_MONTH_DAYS;
}

const PHASE_NAMES = [
  { max: 0.02, name: 'New Moon' },
  { max: 0.235, name: 'Waxing Crescent' },
  { max: 0.265, name: 'First Quarter' },
  { max: 0.485, name: 'Waxing Gibbous' },
  { max: 0.515, name: 'Full Moon' },
  { max: 0.735, name: 'Waning Gibbous' },
  { max: 0.765, name: 'Last Quarter' },
  { max: 0.98, name: 'Waning Crescent' },
  { max: 1.001, name: 'New Moon' },
];

export function getMoonPhase(date = new Date()) {
  const frac = phaseFraction(date);
  const illumination = Math.round(((1 - Math.cos(2 * Math.PI * frac)) / 2) * 100);
  const name = PHASE_NAMES.find((p) => frac <= p.max).name;
  return { name, illumination };
}

// Next occurrence, after `date`, of each of the four named phases.
export function getUpcomingPhases(date = new Date()) {
  const jd = toJulianDay(date);
  let daysSinceNew = (jd - KNOWN_NEW_MOON_JD) % SYNODIC_MONTH_DAYS;
  if (daysSinceNew < 0) daysSinceNew += SYNODIC_MONTH_DAYS;

  const next = (targetFrac) => {
    const targetDays = targetFrac * SYNODIC_MONTH_DAYS;
    let delta = targetDays - daysSinceNew;
    while (delta <= 0) delta += SYNODIC_MONTH_DAYS;
    return fromJulianDay(jd + delta);
  };

  return {
    newMoon: next(0),
    firstQuarter: next(0.25),
    fullMoon: next(0.5),
    lastQuarter: next(0.75),
  };
}
