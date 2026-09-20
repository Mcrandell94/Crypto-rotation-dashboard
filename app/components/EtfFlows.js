'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const BASELINE = '#2A3136';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatUsdAbs(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

export default function EtfFlows({ data }) {
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
  const recent = days.slice(-10);
  const maxAbs = Math.max(1, ...recent.map((d) => Math.abs(d.netInflow)));

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Spot BTC ETF Flows
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Live daily net flow across US spot Bitcoin ETFs, via SoSoValue
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

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {recent.map((d) => {
          const isGain = d.netInflow >= 0;
          const fillPct = Math.min(78, (Math.abs(d.netInflow) / maxAbs) * 100);
          return (
            <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px' }}>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, width: 52, flexShrink: 0, fontFamily: 'ui-monospace, monospace' }}>
                {formatDate(d.date)}
              </span>
              <div style={{ position: 'relative', flex: 1, height: 20, display: 'flex' }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: BASELINE }} />
                <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                  {!isGain && (
                    <>
                      <span style={{ fontSize: 11, color: LOSS, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatUsd(d.netInflow)}
                      </span>
                      <div style={{ width: `${fillPct}%`, height: 12, background: LOSS, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />
                    </>
                  )}
                </div>
                <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 6 }}>
                  {isGain && (
                    <>
                      <div style={{ width: `${fillPct}%`, height: 12, background: GAIN, borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
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
    </section>
  );
}
