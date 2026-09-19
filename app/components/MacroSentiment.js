'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';

// Thresholds/copy ported from the original prototype's fngZone().
function fngZone(v) {
  if (v >= 75) return { label: 'Extreme Greed', color: '#7FA37F', note: 'Historically a contrarian caution zone — euphoria readings this high often precede local tops, not further easy gains.' };
  if (v >= 55) return { label: 'Greed', color: '#8FBF6E', note: 'Healthy risk appetite. Not yet the extreme that usually marks exhaustion, but worth watching if it keeps climbing.' };
  if (v >= 45) return { label: 'Neutral', color: '#8B9298', note: 'No strong sentiment lean either direction right now.' };
  if (v >= 25) return { label: 'Fear', color: '#C9A66B', note: 'Sentiment is cautious. Often accompanies pullbacks that still have room to run, not necessarily a bottom.' };
  return { label: 'Extreme Fear', color: '#A85D4F', note: 'Historically a contrarian opportunity zone — capitulation-level fear often precedes local bottoms, though not always immediately.' };
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 160px' }}>
      <div style={{ fontSize: 11, color: TEXT_MUTED }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: accent || TEXT_PRIMARY, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function MacroSentiment({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Macro &amp; Sentiment</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const zone = data.fng ? fngZone(data.fng.value) : null;

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Macro &amp; Sentiment</h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Fear &amp; Greed from alternative.me · dominance from CoinGecko's global market data
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {data.fng && (
          <StatTile
            label="Fear & Greed Index"
            value={data.fng.value}
            accent={zone.color}
            sub={zone.label}
          />
        )}
        <StatTile
          label="BTC dominance"
          value={data.dominance.btc != null ? `${data.dominance.btc.toFixed(1)}%` : '—'}
        />
        <StatTile
          label="USDT dominance"
          value={data.dominance.usdt != null ? `${data.dominance.usdt.toFixed(1)}%` : '—'}
        />
      </div>
      {zone && (
        <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 12, lineHeight: 1.6, maxWidth: 620 }}>
          {zone.note}
        </p>
      )}
    </section>
  );
}
