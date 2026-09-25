'use client';

import { computeMarketRead } from '../lib/marketRead';

const TEXT_MUTED = '#6E767B';
const TEXT_SECONDARY = '#8B9298';
const TEXT_PRIMARY = '#E7E4DD';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';
// Same quadrant colors as the RRG.
const QUADRANTS = [
  { key: 'leading', name: 'Leading', color: '#7FA37F' },
  { key: 'improving', name: 'Improving', color: '#5E8FA8' },
  { key: 'weakening', name: 'Weakening', color: '#C9A66B' },
  { key: 'lagging', name: 'Lagging', color: '#A85D4F' },
];

export default function MarketRead(props) {
  const { verdict, color, factors, missingSources, sectors } = computeMarketRead(props);

  return (
    <section style={{ marginTop: 20, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Market Read</span>
        <span style={{ fontSize: 18, fontWeight: 600, color }}>{verdict}</span>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>
          a deterministic, weighted read of {factors.length} live signal{factors.length === 1 ? '' : 's'} from this dashboard's own data — not an AI-generated narrative, and not a recommendation
        </span>
      </div>

      {factors.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', marginTop: 12 }}>
          {factors.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontSize: 12, color: TEXT_SECONDARY, minWidth: 260 }}>
              <span style={{ color: f.bull ? GAIN : LOSS, fontFamily: 'ui-monospace, monospace' }}>{f.bull ? '+' : '−'}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 12 }}>Waiting for live data to synthesize a read…</p>
      )}

      {sectors && (
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 10, lineHeight: 1.6 }}>
          <span style={{ color: TEXT_MUTED }}>Sector rotation vs BTC (RRG, not scored):</span>{' '}
          {QUADRANTS.filter((q) => sectors[q.key].length > 0).map((q, i) => (
            <span key={q.key}>
              {i > 0 && <span style={{ color: TEXT_MUTED }}> · </span>}
              <span style={{ color: q.color }}>{q.name}</span> {sectors[q.key].join(', ')}
            </span>
          ))}
        </p>
      )}

      {missingSources.length > 0 && (
        <p style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 10 }}>
          Not yet factored in (still loading or failed to fetch): {missingSources.join(', ')}.
        </p>
      )}
    </section>
  );
}
