'use client';

const GAIN = '#7FA37F';
const LOSS = '#A85D4F';
const AMBER = '#C9A66B';
const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';

const TIMEFRAME_LABELS = { '15m': '15m', '4h': '4H', '1d': 'Daily' };

function rsiColor(rsi) {
  if (rsi == null) return TEXT_SECONDARY;
  if (rsi >= 70) return LOSS; // overbought
  if (rsi <= 30) return GAIN; // oversold
  return TEXT_SECONDARY;
}

function AssetCard({ symbol, timeframes }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 320px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 10 }}>{symbol}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: TEXT_MUTED, fontSize: 11 }}>
            <th style={{ padding: '4px 6px 4px 0', fontWeight: 500 }}>TF</th>
            <th style={{ padding: '4px 6px', fontWeight: 500 }}>RSI(14)</th>
            <th style={{ padding: '4px 6px', fontWeight: 500 }}>MACD</th>
            <th style={{ padding: '4px 6px', fontWeight: 500 }}>vs 50 SMA</th>
            <th style={{ padding: '4px 0', fontWeight: 500 }}>Volume</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(TIMEFRAME_LABELS).map(([key, label]) => {
            const t = timeframes?.[key];
            if (!t) {
              return (
                <tr key={key} style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                  <td style={{ padding: '6px 6px 6px 0', color: TEXT_SECONDARY }}>{label}</td>
                  <td colSpan={4} style={{ padding: '6px', color: TEXT_MUTED }}>—</td>
                </tr>
              );
            }
            return (
              <tr key={key} style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                <td style={{ padding: '6px 6px 6px 0', color: TEXT_SECONDARY }}>{label}</td>
                <td style={{ padding: '6px', color: rsiColor(t.rsi), fontVariantNumeric: 'tabular-nums' }}>
                  {t.rsi != null ? t.rsi.toFixed(1) : '—'}
                </td>
                <td style={{ padding: '6px', color: t.macd === 'bull' ? GAIN : t.macd === 'bear' ? LOSS : TEXT_MUTED }}>
                  {t.macd === 'bull' ? 'Bullish' : t.macd === 'bear' ? 'Bearish' : '—'}
                </td>
                <td style={{ padding: '6px', color: t.priceVsSma50 === 'above' ? GAIN : t.priceVsSma50 === 'below' ? LOSS : TEXT_MUTED }}>
                  {t.priceVsSma50 === 'above' ? 'Above' : t.priceVsSma50 === 'below' ? 'Below' : '—'}
                </td>
                <td style={{ padding: '6px 0', color: t.volumeVsAvg === 'above' ? AMBER : TEXT_MUTED }}>
                  {t.volumeVsAvg === 'above' ? 'Above avg' : t.volumeVsAvg === 'below' ? 'Below avg' : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function TimeframesPanel({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Timeframes</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Timeframes</h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        RSI(14) and MACD(12,26,9), computed live from Kraken candles. "vs 50 SMA" and "Volume" are
        real reads, not guesses — the original prototype flagged its own "vs MAs" field as an
        inferred guess rather than an actual chart read.
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <AssetCard symbol="BTC" timeframes={data.assets?.BTC} />
        <AssetCard symbol="ETH" timeframes={data.assets?.ETH} />
      </div>
      {data.failed?.length > 0 && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8 }}>
          Couldn't fetch: {data.failed.join(', ')}
        </p>
      )}
    </section>
  );
}
