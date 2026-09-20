'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

function zoneFor(index) {
  if (index >= 75) return { label: 'Altcoin Season', color: GAIN };
  if (index <= 25) return { label: 'Bitcoin Season', color: LOSS };
  return { label: 'Neutral / Mixed', color: AMBER };
}

export default function AltseasonIndex({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Altcoin Season Index</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const { index, windowDays, sampleSize, outperformingCount, btcChange30d, leaders } = data;
  const zone = zoneFor(index);

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Altcoin Season Index</h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        % of the top {sampleSize} non-stablecoin alts that outperformed BTC over the trailing {windowDays}{' '}
        days — the standard index (blockchaincenter.net) uses a 90-day window; CoinGecko&apos;s batched
        endpoint only offers 30d, so that&apos;s what this uses, labeled as such rather than passed off as
        the 90-day figure
      </p>

      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 32, color: zone.color }}>{index}</span>
          <span style={{ fontSize: 13, color: zone.color }}>{zone.label}</span>
        </div>
        <div style={{ position: 'relative', height: 8, background: '#141A1D', borderRadius: 4, marginTop: 14 }}>
          <div style={{ position: 'absolute', left: '25%', top: -3, width: 1, height: 14, background: '#3A3526' }} />
          <div style={{ position: 'absolute', left: '75%', top: -3, width: 1, height: 14, background: '#3A3526' }} />
          <div
            style={{
              position: 'absolute', left: `calc(${index}% - 3px)`, top: -3, width: 8, height: 14,
              borderRadius: 2, background: zone.color,
            }}
            title={`${index}`}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: TEXT_MUTED, marginTop: 4 }}>
          <span>Bitcoin Season (0)</span>
          <span>Neutral</span>
          <span>Altcoin Season (100)</span>
        </div>
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 14, lineHeight: 1.55 }}>
          {outperformingCount} of {sampleSize} tracked alts beat BTC&apos;s {btcChange30d > 0 ? '+' : ''}
          {btcChange30d}% {windowDays}-day move.
        </p>
        {leaders?.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            {leaders.map((l) => (
              <span key={l.symbol} style={{ fontSize: 11, color: GAIN, border: `1px solid ${CARD_BORDER}`, borderRadius: 3, padding: '3px 8px' }}>
                {l.symbol} +{l.change30d}%
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
