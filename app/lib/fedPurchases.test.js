// Tests for the NY Fed operation schedule parsing. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, scheduleOf } = require('./fedPurchases');

// First two rows of the live file on 2026-10-18, verbatim.
const HEADER = 'Operation Date,Operation Time (ET),Settlement Date,Operation Type,Security Type and Maturity,Maturity Range,Maximum Operation Size,Period,Planned Operation Amount,Tentative Schedule,Results,Next Schedule Release\r\n';
const PLAN = 'The Desk plans to conduct approximately $14.6 billion in reinvestment purchases and no reserve management purchases over the noted monthly period.';
const LINK = '"<a class=""open-tab"" href=""#current-schedule"">Schedule</a>"';
const CSV =
  HEADER +
  `10/19/2026,09:00 -<br>09:20 AM ,10/20/2026,Bill Purchases ,Bill<br>4 to 12 months,2/18/2027 - 10/21/2027,$ 1.827 billion,10/15/2026-<br>11/13/2026,${PLAN},${LINK},To be released,\r\n` +
  `10/22/2026,09:00 -<br>09:20 AM ,10/23/2026,Bill Purchases ,Bill<br>1 to 4 months,11/21/2026 - 2/20/2027,$ 3.653 billion,10/15/2026-<br>11/13/2026,${PLAN},${LINK},To be released,\r\n`;

test('quoted cells with "" escapes stay one cell', () => {
  const rows = parseCsv(CSV);
  assert.equal(rows.length, 3);
  assert.equal(rows[1].length, 12);
  assert.equal(rows[1][9], '<a class="open-tab" href="#current-schedule">Schedule</a>');
});

test('operations come out with ET times, sizes and the period plan', () => {
  const s = scheduleOf(CSV);
  assert.equal(s.period, '10/15/2026 – 11/13/2026');
  assert.equal(s.plan, PLAN);
  assert.equal(s.operations.length, 2);
  const [a, b] = s.operations;
  assert.equal(a.date, '2026-10-19');
  assert.equal(a.at, '2026-10-19T13:00:00.000Z'); // 9:00 AM EDT
  assert.equal(a.closeAt, '2026-10-19T13:20:00.000Z');
  assert.equal(a.settlementDate, '2026-10-20');
  assert.equal(a.type, 'Bill Purchases');
  assert.equal(a.security, 'Bill 4 to 12 months');
  assert.equal(a.maturityRange, '2/18/2027 - 10/21/2027');
  assert.equal(a.maxSizeLabel, '$1.827 billion');
  assert.equal(a.maxSizeUsd, 1.827e9);
  assert.equal(b.maxSizeUsd, 3.653e9);
});

test('a schedule with no operations is empty, not a failure; other files are rejected', () => {
  assert.deepEqual(scheduleOf(HEADER), { period: null, plan: null, operations: [] });
  assert.equal(scheduleOf('<html>Not found</html>'), null);
  assert.equal(scheduleOf(''), null);
});
