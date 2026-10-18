// Parsing for the NY Fed Desk's published schedule of Treasury purchase
// operations — the CSV behind the "Current schedule" table on
// newyorkfed.org's Treasury Securities Operational Details page:
//   https://www.newyorkfed.org/medialibrary/media/markets/treasury-securities-schedule/current-schedule.csv
// Columns (confirmed 2026-10-18): Operation Date, Operation Time (ET),
// Settlement Date, Operation Type, Security Type and Maturity, Maturity
// Range, Maximum Operation Size, Period, Planned Operation Amount,
// Tentative Schedule, Results, Next Schedule Release. Cells carry <br>
// line breaks, and the period and plan text repeat on every row. Tested
// in fedPurchases.test.js.

import { zonedTime } from './zonedTime.js';

// RFC 4180-style: quoted fields, "" escapes, CRLF or LF rows.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const clean = (v) => String(v ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function isoDate(mdy) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdy);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}

function usdOf(label) {
  const m = /\$\s*([\d.,]+)\s*(billion|million)?/i.exec(label);
  if (!m) return null;
  const unit = /billion/i.test(m[2] || '') ? 1e9 : /million/i.test(m[2] || '') ? 1e6 : 1;
  return Number(m[1].replace(/,/g, '')) * unit;
}

// "09:00 - 09:20 AM" -> ['09:00:00', '09:20:00'] (24-hour); the AM/PM
// marker applies to both ends.
function windowOf(label) {
  const m = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(label);
  if (!m) return null;
  const to24 = (h) => {
    const n = Number(h) % 12;
    return String(/pm/i.test(m[5] || '') ? n + 12 : n).padStart(2, '0');
  };
  return [`${to24(m[1])}:${m[2]}:00`, `${to24(m[3])}:${m[4]}:00`];
}

// { period, plan, operations: [...] }, or null if the file isn't the
// schedule. Between periods the file can list no operations; that's an
// empty list, not a failure.
export function scheduleOf(text) {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim()));
  if (!rows.length) return null;
  const header = rows[0].map((h) => clean(h).toLowerCase());
  const col = (name) => header.findIndex((h) => h.startsWith(name));
  const i = {
    date: col('operation date'),
    time: col('operation time'),
    settle: col('settlement date'),
    type: col('operation type'),
    security: col('security type'),
    range: col('maturity range'),
    max: col('maximum operation size'),
    period: col('period'),
    plan: col('planned operation amount'),
  };
  if (i.date < 0 || i.type < 0) return null;

  let period = null;
  let plan = null;
  const operations = [];
  for (const r of rows.slice(1)) {
    const date = isoDate(clean(r[i.date]));
    if (!date) continue;
    const [start, end] = windowOf(clean(r[i.time])) || ['09:00:00', null];
    const maxSizeLabel = clean(r[i.max]).replace(/\$\s+/, '$');
    operations.push({
      date,
      at: zonedTime(date, start, 'America/New_York').toISOString(),
      closeAt: end ? zonedTime(date, end, 'America/New_York').toISOString() : null,
      settlementDate: isoDate(clean(r[i.settle])),
      type: clean(r[i.type]),
      security: clean(r[i.security]),
      maturityRange: clean(r[i.range]),
      maxSizeLabel,
      maxSizeUsd: usdOf(maxSizeLabel),
    });
    period ??= clean(r[i.period]).replace(/\s*-\s*/, ' – ') || null;
    plan ??= clean(r[i.plan]) || null;
  }
  return { period, plan, operations };
}
