'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';
const MAX_ROWS = 15;

function formatUsd(v) {
  if (v == null || !Number.isFinite(v) || v === 0) return null;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function formatPrice(v) {
  return Number.isFinite(v) ? `$${v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 4 : 2 })}` : '—';
}

function formatRelative(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  const sec = diffMs / 1000;
  if (sec < 60) return `${Math.max(1, Math.round(sec))}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

export default function LiveLiquidationFeed({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Live Liquidations
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const events = data.events.slice(0, MAX_ROWS);

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Live Liquidations
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Individual forced-liquidation events across 9 exchanges, via MarginPad — free, keyless
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {events.map((e, i) => {
          const isLong = String(e.side).toLowerCase().includes('long');
          const color = isLong ? LOSS : GAIN;
          const notional = formatUsd(e.notionalUsd);
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '8px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 10, color, border: `1px solid ${color}`, borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>
                  {isLong ? 'LONG' : 'SHORT'}
                </span>
                <span style={{ fontSize: 12, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace' }}>{e.symbol}</span>
                <span style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: 'ui-monospace, monospace' }}>{formatPrice(e.price)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
                {notional && <span style={{ fontSize: 11, color, fontFamily: 'ui-monospace, monospace' }}>{notional}</span>}
                <span style={{ fontSize: 10, color: TEXT_MUTED }}>{formatRelative(e.timestamp) || ''}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
