'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

function fmtK(v) {
  if (v == null) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1);
}

function fmtStrike(v) {
  return v == null ? '—' : `$${(v / 1000).toFixed(0)}k`;
}

export default function OptionsPositioning({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          BTC Options — Deribit Positioning
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const {
    price, totalCallOI, totalPutOI, callsPct, putsPct,
    vol24hCalls, vol24hPuts, expiries, topPositions, instrumentCount,
  } = data;

  const nearest = expiries?.[0];
  const mpDist = nearest?.maxPain && price ? ((nearest.maxPain - price) / price) * 100 : null;

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        BTC Options — Deribit Positioning
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Live open interest and max pain across {instrumentCount} active BTC option contracts, computed
        directly from Deribit&apos;s public order book — max pain is calculated here from real
        open-interest-by-strike data, not sourced from a paid aggregator
      </p>

      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16 }}>
        {nearest && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', paddingBottom: 14, borderBottom: `1px solid ${CARD_BORDER}` }}>
            <span style={{ fontSize: 11, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Read</span>
            <span style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
              Calls hold <strong style={{ color: GAIN }}>{callsPct}%</strong> of open interest. Nearest expiry
              ({nearest.date}) max pain sits at <strong style={{ color: TEXT_PRIMARY }}>{fmtStrike(nearest.maxPain)}</strong>
              {mpDist != null && `, ${Math.abs(mpDist).toFixed(1)}% ${mpDist >= 0 ? 'above' : 'below'} spot`}.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 16 }}>
          <div style={{ flex: '1 1 260px', minWidth: 240 }}>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Open interest split
            </div>
            {callsPct != null && (
              <div style={{ display: 'flex', height: 20, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ width: `${callsPct}%`, background: GAIN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#12171A', fontWeight: 600 }}>
                  {callsPct}%
                </div>
                <div style={{ width: `${putsPct}%`, background: LOSS, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#12171A', fontWeight: 600 }}>
                  {putsPct}%
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
              <span style={{ color: GAIN }}>{fmtK(totalCallOI)} BTC calls</span>
              <span style={{ color: LOSS }}>{fmtK(totalPutOI)} BTC puts</span>
            </div>
            <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 10, lineHeight: 1.5 }}>
              24h volume: {fmtK(vol24hCalls)} calls vs {fmtK(vol24hPuts)} puts
            </div>
          </div>

          <div style={{ flex: '1 1 280px', minWidth: 260 }}>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              By expiry — put/call ratio and max pain
            </div>
            {expiries.map((e) => {
              const hedgy = e.putCallRatio != null && e.putCallRatio >= 0.7;
              return (
                <div key={e.expiry} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: `1px solid ${CARD_BORDER}`, gap: 8 }}>
                  <span style={{ fontSize: 12, color: TEXT_PRIMARY }}>{e.date}</span>
                  <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
                    {e.putCallRatio != null && (
                      <span style={{ color: hedgy ? AMBER : TEXT_SECONDARY }}>P/C {e.putCallRatio}{hedgy ? ' ⚠' : ''}</span>
                    )}
                    {e.maxPain != null && <span style={{ color: TEXT_SECONDARY, marginLeft: 8 }}>MP {fmtStrike(e.maxPain)}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {topPositions?.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${CARD_BORDER}` }}>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Largest single positions
            </div>
            {topPositions.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: p.side === 'call' ? GAIN : LOSS }}>{p.label} · {p.expiry}</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', color: TEXT_SECONDARY }}>{fmtK(p.openInterest)} BTC</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10, lineHeight: 1.5, maxWidth: 700 }}>
        Max pain is a gravitational tendency into settlement as dealers hedge, not a forecast — large
        expiries have repeatedly settled far from it.
      </p>
    </section>
  );
}
