'use client';

import { useEffect, useState } from 'react';
import { getMoonPhase, getUpcomingPhases } from '../lib/moon';
import { RETROGRADES_2026 } from '../lib/retrogrades';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: TEXT_MUTED }}>{label}</div>
      <div style={{ fontSize: 16, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

export default function AstroOutlook() {
  const [now, setNow] = useState(null);

  // Computed on mount rather than during render, so the server-rendered
  // markup can't disagree with the client's clock (hydration mismatch) —
  // same reasoning as the CB Calendar countdown.
  useEffect(() => {
    setNow(new Date());
  }, []);

  if (!now) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Astro Outlook</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Loading…</p>
      </section>
    );
  }

  const tonight = getMoonPhase(now);
  const upcoming = getUpcomingPhases(now);

  const windowEvents = [
    { date: upcoming.firstQuarter, label: 'First Quarter Moon' },
    { date: upcoming.fullMoon, label: 'Full Moon' },
    { date: upcoming.newMoon, label: 'New Moon' },
    { date: upcoming.lastQuarter, label: 'Last Quarter Moon' },
    ...RETROGRADES_2026.flatMap((r) => {
      const start = new Date(`${r.start}T00:00:00Z`);
      const end = new Date(`${r.end}T00:00:00Z`);
      return [
        { date: start, label: `${r.planet} Retrograde begins`, note: `A long window (through ${formatDate(end)}) — worth pacing yourself through rather than treating as one day` },
        { date: end, label: `${r.planet} stations direct` },
      ];
    }),
  ]
    .filter((e) => e.date >= now)
    .sort((a, b) => a.date - b.date)
    .slice(0, 6);

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Astro Outlook</h2>

      <div style={{ marginTop: 16, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>Real astronomy — moon phases</div>
        <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
          Computed live from orbital mechanics — not an API, not astrology
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginTop: 14 }}>
          <Stat label="Tonight" value={`${tonight.name}, ${tonight.illumination}%`} />
          <Stat label="Next First Quarter" value={formatDate(upcoming.firstQuarter)} />
          <Stat label="Next Full Moon" value={formatDate(upcoming.fullMoon)} />
          <Stat label="Next New Moon" value={formatDate(upcoming.newMoon)} />
        </div>
      </div>

      <div style={{ marginTop: 14, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
          Transition windows — a cue to check in with yourself, not a trade signal
        </div>
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8, lineHeight: 1.6 }}>
          Full moons, new moons, and retrograde stations are windows some traders associate with
          heightened impulsivity. Use these as a personal prompt — &ldquo;am I sizing this
          normally, or am I chasing something&rdquo; — the same way you&apos;d use any other
          discipline checkpoint. Nothing here claims predictive power over price.
        </p>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {windowEvents.map((e, i) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '8px 4px', borderBottom: `1px solid ${CARD_BORDER}`, gap: 12, flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 12, color: AMBER, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
                {formatDate(e.date)}
              </span>
              <span style={{ fontSize: 12, color: TEXT_PRIMARY, textAlign: 'right' }}>
                {e.label}
                {e.note && <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>{e.note}</div>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
