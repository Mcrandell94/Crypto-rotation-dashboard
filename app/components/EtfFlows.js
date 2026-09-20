'use client';

import { useState } from 'react';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const BASELINE = '#2A3136';
const AMBER = '#C9A66B';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

const GRANULARITIES = [
  { key: 'daily', label: 'Daily', bars: 14 },
  { key: 'weekly', label: 'Weekly', bars: 12 },
  { key: 'monthly', label: 'Monthly', bars: 6 },
];

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}

function formatUsdAbs(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Monday-start ISO week key, and that week's Sunday — used both to bucket
// daily rows and to tell whether the most recent bucket is still in
// progress (so it isn't shown as if it were a completed week).
function weekStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + ((day === 0 ? -6 : 1) - day));
  return d.toISOString().slice(0, 10);
}
function weekEnd(weekStartKey) {
  const d = new Date(`${weekStartKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}
function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}
function monthEnd(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// Buckets the live daily series into weekly/monthly totals. The most
// recent bucket is flagged "partial" whenever its natural period (the
// week's Sunday, or the month's last day) hasn't been reached yet by the
// latest day we actually have data for — so an in-progress week/month
// isn't presented as if it were a finished one.
function aggregate(days, granularity) {
  if (granularity === 'daily') {
    return days.map((d) => ({ key: d.date, label: formatDate(d.date), netInflow: d.netInflow, partial: false }));
  }

  const keyFn = granularity === 'weekly' ? weekStart : monthKey;
  const endFn = granularity === 'weekly' ? weekEnd : monthEnd;
  const buckets = new Map();
  for (const d of days) {
    const k = keyFn(d.date);
    if (!buckets.has(k)) buckets.set(k, { key: k, netInflow: 0 });
    buckets.get(k).netInflow += d.netInflow;
  }

  const latestDate = days[days.length - 1]?.date;
  const sorted = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  return sorted.map((b, i) => ({
    key: b.key,
    label: granularity === 'weekly'
      ? `wk of ${formatDate(b.key)}`
      : new Date(`${b.key}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
    netInflow: b.netInflow,
    partial: i === sorted.length - 1 && latestDate < endFn(b.key),
  }));
}

export default function EtfFlows({ data }) {
  const [granularity, setGranularity] = useState('daily');

  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Spot BTC ETF Flows
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const { days, latest, last5Total } = data;
  const gran = GRANULARITIES.find((g) => g.key === granularity);
  const bucketed = aggregate(days, granularity).slice(-gran.bars);
  const maxAbs = Math.max(1, ...bucketed.map((d) => Math.abs(d.netInflow)));

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Spot BTC ETF Flows
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Live daily net flow across US spot Bitcoin ETFs, via SoSoValue — weekly/monthly views sum the
        same daily numbers, not a separately reported figure
      </p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 160px' }}>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>Latest day ({formatDate(latest.date)})</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: latest.netInflow >= 0 ? GAIN : LOSS, marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>
            {formatUsd(latest.netInflow)}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 160px' }}>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>Last 5 days</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: last5Total >= 0 ? GAIN : LOSS, marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>
            {formatUsd(last5Total)}
          </div>
        </div>
        {latest.netAssets != null && (
          <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 160px' }}>
            <div style={{ fontSize: 11, color: TEXT_MUTED }}>Total net assets</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: TEXT_PRIMARY, marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>
              {formatUsdAbs(latest.netAssets)}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
        {GRANULARITIES.map((g) => (
          <button
            key={g.key}
            onClick={() => setGranularity(g.key)}
            style={{
              background: granularity === g.key ? '#1E252A' : '#171D21',
              border: `1px solid ${granularity === g.key ? AMBER : CARD_BORDER}`,
              color: granularity === g.key ? AMBER : TEXT_SECONDARY,
              borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {bucketed.map((d) => {
          const isGain = d.netInflow >= 0;
          const fillPct = Math.min(78, (Math.abs(d.netInflow) / maxAbs) * 100);
          return (
            <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px' }}>
              <span style={{ fontSize: 11, color: d.partial ? TEXT_MUTED : TEXT_SECONDARY, width: 72, flexShrink: 0, fontFamily: 'ui-monospace, monospace' }}>
                {d.label}{d.partial ? '*' : ''}
              </span>
              <div style={{ position: 'relative', flex: 1, height: 20, display: 'flex' }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: BASELINE }} />
                <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                  {!isGain && (
                    <>
                      <span style={{ fontSize: 11, color: LOSS, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatUsd(d.netInflow)}
                      </span>
                      <div style={{ width: `${fillPct}%`, height: 12, background: LOSS, opacity: d.partial ? 0.5 : 1, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />
                    </>
                  )}
                </div>
                <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 6 }}>
                  {isGain && (
                    <>
                      <div style={{ width: `${fillPct}%`, height: 12, background: GAIN, opacity: d.partial ? 0.5 : 1, borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
                      <span style={{ fontSize: 11, color: GAIN, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatUsd(d.netInflow)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {bucketed.some((d) => d.partial) && (
        <p style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 8 }}>
          * {granularity === 'weekly' ? 'week' : 'month'} still in progress — not yet a complete total
        </p>
      )}
    </section>
  );
}
