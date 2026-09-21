// Real planetary retrograde stations — genuine apparent-motion astronomy
// (a planet's position relative to Earth's own orbit), computed from orbital
// mechanics, not astrology. Deriving these from scratch needs a full
// ephemeris (VSOP87 or similar); hand-maintaining the yearly dates from
// independent astronomical sources is the same trade-off already made for
// the FOMC calendar (see app/lib/fomc-calendar.js) — these don't change
// once the year's positions are fixed, so there's nothing a live API adds.
//
// Venus's retrograde is the only one surfaced here (see AstroOutlook.js for
// why): it's a real, infrequent (~every 18 months), long (~6 week) window,
// unlike Mercury's which recurs 3-4x/year and is common enough to be a poor
// "notice something unusual" cue.

export const RETROGRADES_2026 = [
  { planet: 'Venus', start: '2026-10-03', end: '2026-11-14' },
];
