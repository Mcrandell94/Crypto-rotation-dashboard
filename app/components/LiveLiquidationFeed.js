'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';
const MAX_ROWS = 12;

function formatUsdAbs(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function formatRelative(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return `${Math.max(1, Math.round(sec))}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

export default function LiveLiquidationFeed({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Cross-Coin Liquidation Pressure
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const { marketLongUsd, marketShortUsd, coins, asOf } = data;
  const rows = coins.slice(0, MAX_ROWS);
  const maxTotal = Math.max(1, ...rows.map((c) => c.totalUsd));

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Cross-Coin Liquidation Pressure
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px', maxWidth: 680, lineHeight: 1.5 }}>
        Session-cumulative liquidation totals across 9 exchanges, via MarginPad — free, keyless. This
        is a running total since MarginPad's own collector last started, not a fixed rolling window, so
        it can look artificially low right after a restart on their end.
        {asOf ? ` As of ${formatRelative(asOf)}.` : ''}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-start' }}>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', flex: '1 1 130px' }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED }}>Market-wide long liquidated</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: LOSS, marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>
            {formatUsdAbs(marketLongUsd)}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', flex: '1 1 130px' }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED }}>Market-wide short liquidated</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: GAIN, marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>
            {formatUsdAbs(marketShortUsd)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rows.map((c) => {
          const widthPct = Math.min(100, (c.totalUsd / maxTotal) * 100);
          const longPct = c.totalUsd > 0 ? (c.longUsd / c.totalUsd) * 100 : 0;
          return (
            <div key={c.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, width: 48, flexShrink: 0, fontFamily: 'ui-monospace, monospace' }}>
                {c.symbol}
              </span>
              <div style={{ flex: 1, height: 14, background: '#141A1D', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${widthPct}%`, height: '100%', display: 'flex' }}>
                  <div style={{ width: `${longPct}%`, background: LOSS }} />
                  <div style={{ width: `${100 - longPct}%`, background: GAIN }} />
                </div>
              </div>
              <span style={{ fontSize: 10, color: TEXT_PRIMARY, width: 60, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                {formatUsdAbs(c.totalUsd)}
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 12, lineHeight: 1.5 }}>
        <span style={{ color: LOSS }}>Red</span> = long liquidations (forced selling) ·{' '}
        <span style={{ color: GAIN }}>green</span> = short liquidations (forced buying), within each
        coin's bar.
      </p>
    </section>
  );
}
