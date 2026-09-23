// U.S. weekdays when banks (the Federal Reserve's holiday schedule, which
// Fedwire/ACH and so fiat on/off-ramps follow) and/or the stock market
// (NYSE, which also halts spot BTC/ETH ETF creations and flows) are closed.
// Crypto itself trades through these, but with thinner liquidity and no
// ETF flow — worth marking.
//
// Computed from the published rules rather than a hand-typed list, so it
// never runs out:
// - Federal holidays: 5 U.S.C. 6103 (fixed dates, or "nth weekday of month").
// - Fed banks: a holiday on Sunday closes them the following Monday; a
//   holiday on Saturday does NOT move — they're open the Friday before
//   (per the Federal Reserve's own holiday schedule footnote).
// - NYSE: all federal holidays except Columbus Day and Veterans Day, plus
//   Good Friday. Saturday holidays close the Friday before, Sunday ones the
//   Monday after — except New Year's Day on a Saturday, which isn't made up
//   on Dec 31 (NYSE Rule 7.2).
// NYSE output is checked against the independent `holidays` package's
// NYSE calendar for 2026–2035 (see us-closures.test.js). Half-day early
// closes aren't full closures and aren't included.

function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function weekday(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
}

function nthWeekday(y, m, dow, n) {
  const first = weekday(y, m, 1);
  return 1 + ((dow - first + 7) % 7) + (n - 1) * 7;
}

function lastWeekday(y, m, dow) {
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return days - ((weekday(y, m, days) - dow + 7) % 7);
}

function shift(y, m, d, days) {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
}

// Anonymous Gregorian algorithm for Easter Sunday.
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [y, month, day];
}

function federalHolidays(y) {
  return [
    { name: "New Year's Day", date: [y, 1, 1], nyse: true },
    { name: 'Martin Luther King Jr. Day', date: [y, 1, nthWeekday(y, 1, 1, 3)], nyse: true },
    { name: "Presidents' Day", date: [y, 2, nthWeekday(y, 2, 1, 3)], nyse: true },
    { name: 'Memorial Day', date: [y, 5, lastWeekday(y, 5, 1)], nyse: true },
    { name: 'Juneteenth', date: [y, 6, 19], nyse: true },
    { name: 'Independence Day', date: [y, 7, 4], nyse: true },
    { name: 'Labor Day', date: [y, 9, nthWeekday(y, 9, 1, 1)], nyse: true },
    { name: 'Columbus Day', date: [y, 10, nthWeekday(y, 10, 1, 2)], nyse: false },
    { name: 'Veterans Day', date: [y, 11, 11], nyse: false },
    { name: 'Thanksgiving', date: [y, 11, nthWeekday(y, 11, 4, 4)], nyse: true },
    { name: 'Christmas Day', date: [y, 12, 25], nyse: true },
  ];
}

// Every weekday closure for the given year, merged per date:
// [{ date: 'YYYY-MM-DD', name, banksClosed, nyseClosed }], sorted by date.
export function usClosures(year) {
  const byDate = new Map();
  const add = (ymd, name, key) => {
    if (ymd[0] !== year) return; // an observed date that spills into another year
    const date = iso(...ymd);
    const entry = byDate.get(date) || { date, name, banksClosed: false, nyseClosed: false };
    entry[key] = true;
    byDate.set(date, entry);
  };

  // A Saturday New Year's Day isn't made up on the prior Dec 31 by either
  // the Fed or NYSE, so only this year's own holidays matter here.
  for (const h of federalHolidays(year)) {
    const dow = weekday(...h.date);
    const observedName = dow === 0 || dow === 6 ? `${h.name} (observed)` : h.name;

    if (dow === 0) add(shift(...h.date, 1), observedName, 'banksClosed');
    else if (dow !== 6) add(h.date, h.name, 'banksClosed');

    if (h.nyse) {
      if (dow === 0) add(shift(...h.date, 1), observedName, 'nyseClosed');
      else if (dow === 6) {
        if (h.name !== "New Year's Day") add(shift(...h.date, -1), observedName, 'nyseClosed');
      } else add(h.date, h.name, 'nyseClosed');
    }
  }

  add(shift(...easter(year), -2), 'Good Friday', 'nyseClosed');

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
