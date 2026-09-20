'use client';

import { useEffect, useState } from 'react';
import { FOMC_MEETINGS, decisionDateTime as fomcDecisionDateTime } from '../lib/fomc-calendar';
import { BOE_MEETINGS, decisionDateTime as boeDecisionDateTime } from '../lib/boe-calendar';
import { BOJ_MEETINGS, decisionDateTime as bojDecisionDateTime } from '../lib/boj-calendar';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
function fmtRange(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${startLabel}–${endLabel}`;
}

function Badge({ children, color }) {
  return (
    <span style={{
      fontSize: 10, color, border: `1px solid ${color}`, borderRadius: 3,
      padding: '1px 6px', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

// Each bank's meeting shape/badges differ (FOMC: single decision date + SEP
// flag; BOE: single decision date + Monetary Policy Report flag; BOJ:
// 2-day meeting, no equivalent flag) — normalized here so the rest of the
// panel can render all three the same way.
const BANKS = [
  {
    key: 'fomc',
    name: 'Federal Reserve — FOMC',
    source: "the Fed's own published meeting calendar",
    meetings: FOMC_MEETINGS,
    decisionDateTime: fomcDecisionDateTime,
    decisionTimeNote: 'Rate decision 2:00pm ET on the final day',
    label: (m) => fmtRange(m.start, m.end),
    badges: (m) => (
      <>
        <Badge color={TEXT_SECONDARY}>Press conference</Badge>
        {m.sep && <Badge color={AMBER}>SEP · Dot plot</Badge>}
        {m.tentative && <Badge color={TEXT_MUTED}>Tentative</Badge>}
      </>
    ),
  },
  {
    key: 'boe',
    name: 'Bank of England — MPC',
    source: "the Bank's own published MPC dates",
    meetings: BOE_MEETINGS,
    decisionDateTime: boeDecisionDateTime,
    decisionTimeNote: 'Rate decision 12:00pm London time',
    label: (m) => fmtDate(m.date),
    badges: (m) => (
      <>
        {m.mpr ? <Badge color={AMBER}>MPR · Press conference</Badge> : <Badge color={TEXT_SECONDARY}>Decision only</Badge>}
        {m.tentative && <Badge color={TEXT_MUTED}>Provisional</Badge>}
      </>
    ),
  },
  {
    key: 'boj',
    name: 'Bank of Japan — MPM',
    source: "the BOJ's own published meeting schedule",
    meetings: BOJ_MEETINGS,
    decisionDateTime: bojDecisionDateTime,
    decisionTimeNote: 'Statement timing varies; Governor press conference fixed at 3:30pm JST on the final day',
    label: (m) => fmtRange(m.start, m.end),
    badges: (m) => (
      <>
        <Badge color={TEXT_SECONDARY}>Press conference</Badge>
        {m.tentative && <Badge color={TEXT_MUTED}>Tentative</Badge>}
      </>
    ),
  },
];

function BankSection({ bank, now }) {
  const upcoming = bank.meetings.filter((m) => bank.decisionDateTime(m) >= now);
  const next = upcoming[0];
  const onDeck = upcoming.slice(1, 4);
  const daysUntil = next ? Math.ceil((bank.decisionDateTime(next) - now) / DAY_MS) : null;
  const lastMeeting = [...bank.meetings].reverse().find((m) => bank.decisionDateTime(m) < now);

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>{bank.name}</h3>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 12px' }}>
        Hand-maintained from {bank.source} — no live feed beats reading it directly.
      </p>

      {next ? (
        <div style={{ background: CARD_BG, border: `1px solid ${AMBER}`, borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>Next meeting</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: AMBER }}>
              {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}
            </span>
          </div>
          <div style={{ fontSize: 20, color: TEXT_PRIMARY, marginTop: 6 }}>{bank.label(next)}</div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>{bank.decisionTimeNote}</div>
          <div style={{ marginTop: 10 }}>{bank.badges(next)}</div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>No upcoming meetings in the hand-maintained schedule.</p>
      )}

      {onDeck.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {onDeck.map((m, i) => (
            <div
              key={bank.label(m) + i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 4px', borderBottom: `1px solid ${CARD_BORDER}`, gap: 12, flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 12, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace' }}>
                {bank.label(m)}
              </span>
              {bank.badges(m)}
            </div>
          ))}
        </div>
      )}

      {lastMeeting && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 12 }}>
          Last meeting: {bank.label(lastMeeting)}
        </p>
      )}
    </div>
  );
}

export default function CbCalendar() {
  const [now, setNow] = useState(null);

  // Computed on mount rather than during render, so the server-rendered
  // markup can't disagree with the client's clock (hydration mismatch).
  useEffect(() => {
    setNow(new Date());
  }, []);

  if (!now) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Central Bank Calendar
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Loading…</p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Central Bank Calendar — Fed, BOE, BOJ
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 0' }}>
        The three central banks most likely to move crypto through rate decisions and dollar/yen
        liquidity — dates only move on rare, widely-reported reschedules.
      </p>

      {BANKS.map((bank) => (
        <BankSection key={bank.key} bank={bank} now={now} />
      ))}
    </section>
  );
}
