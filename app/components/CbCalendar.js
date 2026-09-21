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
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

const HIGH = LOSS;
const MEDIUM = AMBER;
const LOW = GAIN;
const DAY_MS = 24 * 60 * 60 * 1000;

function fmtDateTime(date, timeZone) {
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone });
}

function Badge({ children, color }) {
  return (
    <span style={{
      fontSize: 10, color, border: `1px solid ${color}`, borderRadius: 3,
      padding: '1px 6px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.02em',
    }}>
      {children}
    </span>
  );
}

// Central bank meetings get a heuristic severity, same as every other
// judgment-call field in this app — labeled as one, never presented as a
// rating. Real market-implied data (Polymarket's Fed decision odds) drives
// it where available; everything else falls back to a days-until proxy.
function centralBankSeverity(daysUntil, marketTopPct, isNoChange) {
  if (daysUntil < 0) return null;
  if (marketTopPct != null) {
    if (!isNoChange && marketTopPct >= 55) return 'high'; // a change looks likely
    if (marketTopPct < 75) return 'medium'; // genuinely contested either way
    return 'low'; // hold looks solidly likely
  }
  if (daysUntil <= 14) return 'medium';
  return 'low';
}

function expirySeverity(type) {
  if (type === 'quarterly') return 'high';
  if (type === 'monthly') return 'medium';
  return 'low';
}

const SEVERITY_COLOR = { high: HIGH, medium: MEDIUM, low: LOW };

const HORIZON_OPTIONS = [
  { key: 3, label: '3 months' },
  { key: 6, label: '6 months' },
];

function HorizonPicker({ horizonMonths, setHorizonMonths }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {HORIZON_OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => setHorizonMonths(o.key)}
          style={{
            background: horizonMonths === o.key ? '#1E252A' : CARD_BG,
            border: `1px solid ${horizonMonths === o.key ? AMBER : CARD_BORDER}`,
            color: horizonMonths === o.key ? AMBER : TEXT_SECONDARY,
            borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function buildCentralBankEvents(now) {
  const banks = [
    { key: 'fomc', name: 'Fed', full: 'Federal Reserve — FOMC', meetings: FOMC_MEETINGS, decisionDateTime: fomcDecisionDateTime, tz: 'America/New_York', label: (m) => `${m.start}–${m.end}` },
    { key: 'boe', name: 'BOE', full: 'Bank of England — MPC', meetings: BOE_MEETINGS, decisionDateTime: boeDecisionDateTime, tz: 'Europe/London', label: (m) => m.date },
    { key: 'boj', name: 'BOJ', full: 'Bank of Japan — MPM', meetings: BOJ_MEETINGS, decisionDateTime: bojDecisionDateTime, tz: 'Asia/Tokyo', label: (m) => `${m.start}–${m.end}` },
  ];

  const events = [];
  for (const bank of banks) {
    for (const m of bank.meetings) {
      const dt = bank.decisionDateTime(m);
      const daysUntil = Math.ceil((dt - now) / DAY_MS);
      events.push({
        id: `${bank.key}-${bank.label(m)}`,
        date: dt,
        name: bank.full,
        shortName: bank.name,
        category: 'central-bank',
        resolved: dt < now,
        daysUntil,
        tz: bank.tz,
        marketOutcomes: null, // filled in for the Fed by the caller, if live data is available
      });
    }
  }
  return events;
}

function buildLegislativeEvents(congressData) {
  if (!congressData?.bills) return [];
  return congressData.bills
    .filter((b) => !b.error && b.latestAction?.date)
    .map((b) => ({
      id: `bill-${b.congress}-${b.billType}-${b.billNumber}`,
      date: new Date(`${b.latestAction.date}T00:00:00Z`),
      name: b.label,
      shortName: b.label,
      category: 'legislative',
      resolved: false, // ongoing tracking — real enacted/failed status isn't parsed from action text here
      severity: 'medium',
      billUrl: b.url,
      latestActionText: b.latestAction.text,
    }));
}

function buildOptionsEvents(optionsData) {
  const btc = optionsData?.assets?.BTC;
  if (!btc?.expiries) return [];
  return btc.expiries.slice(0, 3).map((e) => ({
    id: `btc-opt-${e.expiry}`,
    date: new Date(e.expiry),
    name: 'BTC options expiry',
    shortName: 'BTC options',
    category: 'options-expiry',
    resolved: new Date(e.expiry) < new Date(),
    expiry: e,
  }));
}

function EventCard({ ev, now }) {
  const severity = ev.severity;
  const color = SEVERITY_COLOR[severity] || TEXT_MUTED;

  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
      <div style={{ width: 3, background: color, borderRadius: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, paddingBottom: 14, borderBottom: `1px solid ${CARD_BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>{ev.shortName}</span>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>{fmtDateTime(ev.date, ev.tz)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <Badge color={ev.category === 'central-bank' ? '#4C7EB8' : ev.category === 'legislative' ? '#C9A66B' : '#8B6FB8'}>
            {ev.category === 'central-bank' ? 'Central bank' : ev.category === 'legislative' ? 'Legislative' : 'Options expiry'}
          </Badge>
          {ev.resolved && <Badge color={TEXT_MUTED}>Resolved</Badge>}
        </div>

        {ev.category === 'legislative' && (
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 8, lineHeight: 1.6 }}>
            Latest action: {ev.latestActionText}
            {ev.billUrl && (
              <>
                {' — '}
                <a href={ev.billUrl} target="_blank" rel="noopener noreferrer" style={{ color: AMBER }}>
                  track on Congress.gov
                </a>
              </>
            )}
          </div>
        )}

        {ev.category === 'central-bank' && !ev.resolved && ev.marketOutcomes && (
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 8, lineHeight: 1.6 }}>
            Market-implied (Polymarket): {ev.marketOutcomes.slice(0, 3).map((o) => `${o.pct}% ${o.label}`).join(', ')}
          </div>
        )}
        {ev.category === 'central-bank' && !ev.resolved && !ev.marketOutcomes && (
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 8 }}>
            {ev.daysUntil === 0 ? 'Today' : ev.daysUntil === 1 ? 'Tomorrow' : `In ${ev.daysUntil} days`} — no live market found for this meeting.
          </div>
        )}
        {ev.category === 'central-bank' && ev.resolved && (
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 8 }}>
            Meeting has passed — see the bank's own published statement for the outcome.
          </div>
        )}

        {ev.category === 'options-expiry' && (
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 8, lineHeight: 1.6 }}>
            {ev.expiry.type === 'quarterly' ? 'Quarterly expiry' : ev.expiry.type === 'monthly' ? 'Monthly expiry' : 'Weekly expiry'}
            {ev.expiry.maxPain != null && `, max pain $${Math.round(ev.expiry.maxPain).toLocaleString()}`}
            {ev.expiry.putCallRatio != null && ` · P/C ${ev.expiry.putCallRatio}`}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CbCalendar({ optionsData, fedOddsData, fedOddsError, congressData, congressError }) {
  const [now, setNow] = useState(null);
  const [horizonMonths, setHorizonMonths] = useState(3);

  // Computed on mount rather than during render, so the server-rendered
  // markup can't disagree with the client's clock (hydration mismatch).
  useEffect(() => {
    setNow(new Date());
  }, []);

  if (!now) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Critical Dates</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Loading…</p>
      </section>
    );
  }

  let events = [...buildCentralBankEvents(now), ...buildOptionsEvents(optionsData), ...buildLegislativeEvents(congressData)];

  // Attach live Polymarket odds to the nearest upcoming Fed meeting only —
  // the market tracks "the next decision," not a specific date.
  const nextFomc = events.find((e) => e.shortName === 'Fed' && !e.resolved);
  if (nextFomc && fedOddsData?.market) {
    nextFomc.marketOutcomes = fedOddsData.market.outcomes;
  }

  events = events.map((ev) => {
    if (ev.category === 'central-bank') {
      const topOutcome = ev.marketOutcomes?.[0];
      const severity = centralBankSeverity(
        ev.daysUntil,
        topOutcome?.pct ?? null,
        /no change|hold/i.test(topOutcome?.label || '')
      );
      return { ...ev, severity };
    }
    if (ev.category === 'legislative') {
      return ev;
    }
    return { ...ev, severity: expirySeverity(ev.expiry.type) };
  });

  events.sort((a, b) => a.date - b.date);

  // The horizon toggle scopes scheduled events (central bank meetings,
  // options expiries) to the next N months. Legislative tracking isn't a
  // scheduled future date — it's a live status check on a bill that may
  // have last moved months ago — so it stays visible regardless of window.
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() + horizonMonths);

  // Keep the calendar focused: everything still-upcoming within the
  // window, plus the last couple of resolved meetings for context.
  const upcoming = events.filter(
    (e) => !e.resolved && (e.category === 'legislative' || e.date <= cutoff)
  );
  const recentlyResolved = events.filter((e) => e.resolved).slice(-3);
  const shown = [...recentlyResolved, ...upcoming];

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Critical Dates</h2>
        <HorizonPicker horizonMonths={horizonMonths} setHorizonMonths={setHorizonMonths} />
      </div>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 4px' }}>
        Central bank decisions (Fed, BOE, BOJ — hand-maintained from each bank's own published calendar),
        BTC options expiries (live, mirrors the Options panel on Macro & Seasonality), and crypto
        market-structure legislation (live, from Congress.gov's own API), scoped to the window above.
        Legislative tracking always shows regardless of window — it's a live status check, not a scheduled date.
      </p>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '0 0 14px', lineHeight: 1.5 }}>
        Severity is a judgment call, not an official rating — for Fed meetings it's driven by
        live Polymarket odds where a market exists; otherwise it's a rough days-until proxy.
      </p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: HIGH, display: 'inline-block' }} />
          High — real change likely
        </span>
        <span style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: MEDIUM, display: 'inline-block' }} />
          Medium — genuinely contested
        </span>
        <span style={{ fontSize: 11, color: TEXT_SECONDARY, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: LOW, display: 'inline-block' }} />
          Low — hold likely, or too far out
        </span>
      </div>

      {fedOddsError && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10 }}>
          Live Fed odds unavailable this refresh: {fedOddsError}
        </p>
      )}
      {congressError && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10 }}>
          Live legislative data unavailable this refresh: {congressError}
        </p>
      )}

      {shown.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>No dates within the next {horizonMonths} months.</p>
      ) : (
        <div>
          {shown.map((ev) => (
            <EventCard key={ev.id} ev={ev} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}
