'use client';

// Taker buy share over the trailing 4h, per exchange, from CryptoDataAPI
// (/api/derivativesflow). Stands in for the Coinglass Taker Flow panel,
// which stays parked (its key's plan doesn't cover that endpoint) — this
// is a narrower read: two venues, one window.

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';
const ASSETS = ['BTC', 'ETH'];

function Leg({ exchange, buyPct }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: TEXT_SECONDARY }}>{exchange}</span>
        <span style={{ color: buyPct >= 50 ? GAIN : LOSS, fontFamily: 'ui-monospace, monospace' }}>
          {buyPct.toFixed(1)}% buy · {(100 - buyPct).toFixed(1)}% sell
        </span>
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 3, overflow: 'hidden', background: '#141A1D', marginTop: 4 }}>
        <div style={{ width: `${buyPct}%`, background: GAIN, opacity: 0.75 }} />
        <div style={{ width: `${100 - buyPct}%`, background: LOSS, opacity: 0.75 }} />
      </div>
    </div>
  );
}

export default function TakerBuySell({ data, error }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Taker Buy / Sell — last 4 hours</h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 14px', maxWidth: 680, lineHeight: 1.5 }}>
        Share of aggressive (market-order) volume that was buying, per exchange, via CryptoDataAPI. Above 50%,
        buyers are lifting offers; below, sellers are hitting bids. Binance is BTC only; Hyperliquid is its own trade tape.
      </p>
      {error && <p style={{ fontSize: 12, color: TEXT_MUTED }}>Taker flow unavailable this refresh: {error}</p>}
      {!error && !data && <p style={{ fontSize: 12, color: TEXT_MUTED }}>Waiting for data…</p>}
      {!error && data && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ASSETS.map((a) => {
            const t = data.taker?.[a];
            const gated = (data.unavailable || []).some((u) => u.kind === 'taker' && u.symbol === a);
            return (
              <div key={a} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', flex: '1 1 260px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{a}</div>
                {t ? (
                  t.legs.map((l) => <Leg key={l.exchange} {...l} />)
                ) : (
                  <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8 }}>
                    {gated ? "Not on the current CryptoDataAPI plan." : 'No reading this refresh.'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
