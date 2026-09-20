// Official Bank of Japan Monetary Policy Meeting (MPM) schedule,
// hand-maintained from the BOJ's own published "Scheduled Dates of
// Monetary Policy Meetings" release (boj.or.jp/en/mopo/mpmsche_minu) — same
// rationale as the FOMC and BOE calendars: the Bank announces these itself,
// well in advance, so there's no live feed that beats reading its own
// calendar directly. 2027 dates are the BOJ's own schedule, published a
// year ahead each July.
//
// Each meeting runs two days. Unlike the Fed (fixed 2:00pm ET) or the BOE
// (fixed 12:00pm London), the BOJ does not pre-announce a fixed release
// time for the statement itself — it has historically landed anywhere from
// late morning to early afternoon JST on the second day. The one fixed,
// publicly scheduled time point is the Governor's press conference, at
// 3:30pm JST — used here as the honest anchor rather than pretending to
// know the statement's exact minute.

export const BOJ_MEETINGS = [
  { start: '2026-01-22', end: '2026-01-23' },
  { start: '2026-03-18', end: '2026-03-19' },
  { start: '2026-04-27', end: '2026-04-28' },
  { start: '2026-06-15', end: '2026-06-16' },
  { start: '2026-07-30', end: '2026-07-31' },
  { start: '2026-09-17', end: '2026-09-18' },
  { start: '2026-10-29', end: '2026-10-30' },
  { start: '2026-12-17', end: '2026-12-18' },
  { start: '2027-01-21', end: '2027-01-22', tentative: true },
  { start: '2027-03-17', end: '2027-03-18', tentative: true },
  { start: '2027-04-27', end: '2027-04-28', tentative: true },
  { start: '2027-06-10', end: '2027-06-11', tentative: true },
  { start: '2027-07-21', end: '2027-07-22', tentative: true },
  { start: '2027-09-21', end: '2027-09-22', tentative: true },
  { start: '2027-10-28', end: '2027-10-29', tentative: true },
  { start: '2027-12-16', end: '2027-12-17', tentative: true },
];

// Japan doesn't observe daylight saving, so a fixed +09:00 (JST) offset is
// exact year-round — unlike the Fed/BOE calendars' fixed-offset approximations.
export function decisionDateTime(meeting) {
  return new Date(`${meeting.end}T15:30:00+09:00`);
}
