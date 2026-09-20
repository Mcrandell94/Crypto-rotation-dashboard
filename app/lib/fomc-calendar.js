// Official FOMC meeting schedule, hand-maintained from the Federal Reserve's
// own published calendar (federalreserve.gov/monetarypolicy/fomccalendars.htm).
// The Fed announces these dates itself, officially, up to ~18 months out —
// there's no live API that improves on reading their calendar directly, and
// meeting dates essentially never move except in rare, widely-reported
// reschedules. 2027 dates are the Fed's own "tentative" schedule, confirmed
// at the meeting immediately before each one, per the Fed's own caveat.
//
// Every meeting since March 2019 includes a press conference (not just
// quarterly ones); the Summary of Economic Projections (the "dot plot") is
// released only at the March, June, September, and December meetings.

export const FOMC_MEETINGS = [
  { start: '2026-01-27', end: '2026-01-28', sep: false },
  { start: '2026-03-17', end: '2026-03-18', sep: true },
  { start: '2026-04-28', end: '2026-04-29', sep: false },
  { start: '2026-06-16', end: '2026-06-17', sep: true },
  { start: '2026-07-28', end: '2026-07-29', sep: false },
  { start: '2026-09-15', end: '2026-09-16', sep: true },
  { start: '2026-10-27', end: '2026-10-28', sep: false },
  { start: '2026-12-08', end: '2026-12-09', sep: true },
  { start: '2027-01-26', end: '2027-01-27', sep: false, tentative: true },
  { start: '2027-03-16', end: '2027-03-17', sep: true, tentative: true },
  { start: '2027-04-27', end: '2027-04-28', sep: false, tentative: true },
  { start: '2027-06-08', end: '2027-06-09', sep: true, tentative: true },
  { start: '2027-07-27', end: '2027-07-28', sep: false, tentative: true },
  { start: '2027-09-14', end: '2027-09-15', sep: true, tentative: true },
  { start: '2027-10-26', end: '2027-10-27', sep: false, tentative: true },
  { start: '2027-12-07', end: '2027-12-08', sep: true, tentative: true },
];

// Rate decisions are always released 2:00pm ET on the meeting's second day.
export function decisionDateTime(meeting) {
  return new Date(`${meeting.end}T14:00:00-05:00`);
}
