// Official Bank of England Monetary Policy Committee (MPC) schedule,
// hand-maintained from the Bank's own published dates
// (bankofengland.co.uk/news/.../monetary-policy-committee-dates-for-2026,
// and the equivalent 2027 announcement) — same rationale as the FOMC
// calendar: the Bank announces these itself, well in advance, so there's
// no live feed that beats reading its own calendar directly. 2027 dates
// are published as "provisional" by the Bank itself, mirroring how the
// Fed's own 2027 dates are "tentative" until confirmed.
//
// 4 of the 8 meetings each year are "MPR" meetings — released alongside a
// quarterly Monetary Policy Report and a press conference led by the
// Governor; the other 4 are decision-only.

import { zonedTime } from './zonedTime';

export const BOE_MEETINGS = [
  { date: '2026-02-05', mpr: true },
  { date: '2026-03-19', mpr: false },
  { date: '2026-04-30', mpr: true },
  { date: '2026-06-18', mpr: false },
  { date: '2026-07-30', mpr: true },
  { date: '2026-09-17', mpr: false },
  { date: '2026-11-05', mpr: true },
  { date: '2026-12-17', mpr: false },
  { date: '2027-02-04', mpr: true, tentative: true },
  { date: '2027-03-18', mpr: false, tentative: true },
  { date: '2027-04-29', mpr: true, tentative: true },
  { date: '2027-06-17', mpr: false, tentative: true },
  { date: '2027-07-29', mpr: true, tentative: true },
  { date: '2027-09-16', mpr: false, tentative: true },
  { date: '2027-11-04', mpr: true, tentative: true },
  { date: '2027-12-16', mpr: false, tentative: true },
];

// The Bank always publishes its rate decision at 12:00pm London time on
// the meeting's Thursday — London wall-clock time, so BST (UTC+1) or GMT
// depending on the date, not a fixed offset.
export function decisionDateTime(meeting) {
  return zonedTime(meeting.date, '12:00:00', 'Europe/London');
}
