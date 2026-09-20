'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

function formatUsdAbs(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function LiquidationsPanel({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          BTC Liquidations — Long vs Short
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const { days, last24h, last7dLong, last7dShort } = data;
  const recent = days.slice(-14);
  const maxTotal = Math.max(1, ...recent.map((d) => d.longUsd + d.shortUsd));

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        BTC Liquidations — Long vs Short
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Live forced-liquidation volume across Binance, OKX, Bybit, Bitget, and Gate, via Coinglass —
        long liquidations are forced selling, short liquidations are forced buying
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', flex: '1 1 130px' }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED }}>Latest day ({formatDate(last24h.date)})</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>
            <span style={{ color: LOSS }}>{formatUsdAbs(last24h.longUsd)}</span>
            <span style={{ color: TEXT_MUTED, fontSize: 12 }}> long / </span>
            <span style={{ color: GAIN }}>{formatUsdAbs(last24h.shortUsd)}</span>
            <span style={{ color: TEXT_MUTED, fontSize: 12 }}> short</span>
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', flex: '1 1 130px' }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED }}>7-day long liquidations</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: LOSS, marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>
            {formatUsdAbs(last7dLong)}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', flex: '1 1 130px' }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED }}>7-day short liquidations</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: GAIN, marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>
            {formatUsdAbs(last7dShort)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {recent.map((d) => {
          const total = d.longUsd + d.shortUsd;
          const widthPct = Math.min(100, (total / maxTotal) * 100);
          const longPct = total > 0 ? (d.longUsd / total) * 100 : 0;
          return (
            <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, width: 52, flexShrink: 0, fontFamily: 'ui-monospace, monospace' }}>
                {formatDate(d.date)}
              </span>
              <div style={{ flex: 1, height: 14, background: '#141A1D', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${widthPct}%`, height: '100%', display: 'flex' }}>
                  <div style={{ width: `${longPct}%`, background: LOSS }} />
                  <div style={{ width: `${100 - longPct}%`, background: GAIN }} />
                </div>
              </div>
              <span style={{ fontSize: 10, color: TEXT_MUTED, width: 60, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                {formatUsdAbs(total)}
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 12, lineHeight: 1.5, maxWidth: 620 }}>
        This is realized liquidation volume as it happens, not a forward-looking price-level map.
      </p>
    </section>
  );
}
