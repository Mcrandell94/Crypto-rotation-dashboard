// BLS release schedule, hand-maintained from the Bureau of Labor Statistics'
// own published release calendar (bls.gov/schedule/) — same rationale as the
// FOMC/BOE/BOJ calendars: BLS announces these dates itself, well in advance,
// and there's no live API for the schedule. Times are Eastern, stored as
// full ISO timestamps with the correct EDT/EST offset for that date so
// daylight saving can't shift them.
//
// Coverage: October–December 2026, copied from BLS's calendar as pasted
// into this session. Once these pass, the CB Calendar simply shows no BLS
// dates rather than guessed ones — extend this list from
// bls.gov/schedule/ to keep it going. (Holidays on BLS's calendar —
// Columbus Day, Veterans Day, Thanksgiving, Christmas — aren't releases, so they're
// left out; the CB Calendar's closure rows already cover them.)
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
  // From November: daylight saving ends Nov 1, so these are EST (-05:00).
  { at: '2026-11-03T10:00:00-05:00', name: 'Job Openings and Labor Turnover Survey for September 2026' },
  { at: '2026-11-05T08:30:00-05:00', name: 'Productivity and Costs (P) for Third Quarter 2026' },
  { critical: true, at: '2026-11-06T08:30:00-05:00', name: 'Employment Situation for October 2026' },
  { critical: true, at: '2026-11-10T08:30:00-05:00', name: 'Consumer Price Index for October 2026' },
  { at: '2026-11-10T08:30:00-05:00', name: 'Real Earnings for October 2026' },
  { critical: true, at: '2026-11-13T08:30:00-05:00', name: 'Producer Price Index for October 2026' },
  { at: '2026-11-17T08:30:00-05:00', name: 'U.S. Import and Export Price Indexes for October 2026' },
  { at: '2026-11-18T10:00:00-05:00', name: 'Employer-Reported Workplace Injuries and Illnesses (Annual) for 2025' },
  { at: '2026-11-20T10:00:00-05:00', name: 'State Employment and Unemployment (Monthly) for October 2026' },
  { at: '2026-12-01T10:00:00-05:00', name: 'Job Openings and Labor Turnover Survey for October 2026' },
  { at: '2026-12-02T10:00:00-05:00', name: 'County Employment and Wages for Second Quarter 2026' },
  { at: '2026-12-02T10:00:00-05:00', name: 'Metropolitan Area Employment and Unemployment (Monthly) for October 2026' },
  { critical: true, at: '2026-12-04T08:30:00-05:00', name: 'Employment Situation for November 2026' },
  { at: '2026-12-08T08:30:00-05:00', name: 'Productivity and Costs (R) for Third Quarter 2026' },
  { critical: true, at: '2026-12-10T08:30:00-05:00', name: 'Consumer Price Index for November 2026' },
  { at: '2026-12-10T08:30:00-05:00', name: 'Real Earnings for November 2026' },
  { critical: true, at: '2026-12-15T08:30:00-05:00', name: 'Producer Price Index for November 2026' },
  { at: '2026-12-16T10:00:00-05:00', name: 'Census of Fatal Occupational Injuries for Annual 2025' },
  { at: '2026-12-16T10:00:00-05:00', name: 'Employer Costs for Employee Compensation for September 2026' },
  { at: '2026-12-17T08:30:00-05:00', name: 'U.S. Import and Export Price Indexes for November 2026' },
  { at: '2026-12-18T10:00:00-05:00', name: 'State Employment and Unemployment (Monthly) for November 2026' },
  { at: '2026-12-18T10:00:00-05:00', name: 'Work Experience of the Population (Annual) for 2025' },
  { at: '2026-12-30T10:00:00-05:00', name: 'Metropolitan Area Employment and Unemployment (Monthly) for November 2026' },
];
