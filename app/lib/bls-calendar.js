// BLS release schedule, hand-maintained from the Bureau of Labor Statistics'
// own published release calendar (bls.gov/schedule/) — same rationale as the
// FOMC/BOE/BOJ calendars: BLS announces these dates itself, well in advance,
// and there's no live API for the schedule. Times are Eastern, stored as
// full ISO timestamps with the correct EDT/EST offset for that date so
// daylight saving can't shift them.
//
// Coverage: October 2026 only, copied from BLS's calendar as pasted into
// this session. Once these pass, the CB Calendar simply shows no BLS
// dates rather than guessed ones — extend this list from
// bls.gov/schedule/ to keep it going. (Columbus Day, Oct 12, is a
// federal holiday on BLS's calendar, not a release, so it's left out.)
//
// The CB Calendar only shows the releases that move crypto — `critical`:
// CPI, PPI and the jobs report (Employment Situation). The rest of BLS's
// calendar is kept here, not shown, in case that list widens later.

export const BLS_RELEASES = [
  { critical: true, at: '2026-10-02T08:30:00-04:00', name: 'Employment Situation for September 2026' },
  { critical: true, at: '2026-10-14T08:30:00-04:00', name: 'Consumer Price Index for September 2026' },
  { at: '2026-10-14T08:30:00-04:00', name: 'Real Earnings for September 2026' },
  { critical: true, at: '2026-10-15T08:30:00-04:00', name: 'Producer Price Index for September 2026' },
  { at: '2026-10-16T08:30:00-04:00', name: 'U.S. Import and Export Price Indexes for September 2026' },
  { at: '2026-10-20T10:00:00-04:00', name: 'State Employment and Unemployment (Monthly) for September 2026' },
  { at: '2026-10-21T10:00:00-04:00', name: 'Usual Weekly Earnings of Wage and Salary Workers for Third Quarter 2026' },
  { at: '2026-10-28T10:00:00-04:00', name: 'Metropolitan Area Employment and Unemployment (Monthly) for September 2026' },
  { at: '2026-10-28T10:00:00-04:00', name: 'Quarterly Data Series on Business Employment Dynamics for First Quarter 2026' },
  { at: '2026-10-29T10:00:00-04:00', name: 'Consumer Expenditures for Annual 2025' },
  { at: '2026-10-30T08:30:00-04:00', name: 'Employment Cost Index for Third Quarter 2026' },
];
