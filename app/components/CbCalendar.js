'use client';

import { useEffect, useState } from 'react';
import { FOMC_MEETINGS, decisionDateTime } from '../lib/fomc-calendar';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';

const DAY_MS = 24 * 60 * 60 * 1000;

function formatRange(meeting) {
  const start = new Date(`${meeting.start}T00:00:00Z`);
  const end = new Date(`${meeting.end}T00:00:00Z`);
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

function MeetingBadges({ meeting }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Badge color={TEXT_SECONDARY}>Press conference</Badge>
      {meeting.sep && <Badge color={AMBER}>SEP · Dot plot</Badge>}
      {meeting.tentative && <Badge color={TEXT_MUTED}>Tentative</Badge>}
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
          Central Bank Calendar — FOMC
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Loading…</p>
      </section>
    );
  }

  const upcoming = FOMC_MEETINGS.filter((m) => decisionDateTime(m) >= now);
  const next = upcoming[0];
  const onDeck = upcoming.slice(1, 5);
  const daysUntil = next ? Math.ceil((decisionDateTime(next) - now) / DAY_MS) : null;
  const lastMeeting = [...FOMC_MEETINGS].reverse().find((m) => decisionDateTime(m) < now);

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Central Bank Calendar — FOMC
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Hand-maintained from the Federal Reserve's own published meeting calendar — the Fed
        announces these dates itself up to ~18 months out, so there's no live feed that beats
        reading their calendar directly
      </p>

      {next && (
        <div style={{ background: CARD_BG, border: `1px solid ${AMBER}`, borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>Next FOMC meeting</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: AMBER }}>
              {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}
            </span>
          </div>
          <div style={{ fontSize: 20, color: TEXT_PRIMARY, marginTop: 6 }}>{formatRange(next)}</div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
            Rate decision 2:00pm ET on the final day
          </div>
          <div style={{ marginTop: 10 }}>
            <MeetingBadges meeting={next} />
          </div>
        </div>
      )}

      {onDeck.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {onDeck.map((m) => (
            <div
              key={m.start}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 4px', borderBottom: `1px solid ${CARD_BORDER}`, gap: 12, flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 12, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace' }}>
                {formatRange(m)}
              </span>
              <MeetingBadges meeting={m} />
            </div>
          ))}
        </div>
      )}

      {lastMeeting && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 12 }}>
          Last meeting: {formatRange(lastMeeting)}
        </p>
      )}
    </section>
  );
}
