'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';
const GAIN = '#7FA37F';

const TIMEFRAMES = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'yearly', label: 'Year-End' },
];

function formatEndDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function BucketCard({ label, bucket }) {
  if (!bucket) {
    return (
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 240px' }}>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>{label}</div>
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10 }}>No matching Polymarket event found right now.</p>
      </div>
    );
  }

  const maxPct = Math.max(1, ...bucket.thresholds.map((t) => t.pct));

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 240px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{label}</span>
        {bucket.endDate && <span style={{ fontSize: 10, color: TEXT_MUTED }}>Resolves {formatEndDate(bucket.endDate)}</span>}
      </div>
      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>{bucket.title}</div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bucket.thresholds.map((t, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: TEXT_PRIMARY }}>{t.label}</span>
              <span style={{ color: t.pct >= 50 ? GAIN : AMBER, fontFamily: 'ui-monospace, monospace' }}>
                {t.pct}% {t.outcome}
              </span>
            </div>
            <div style={{ position: 'relative', height: 5, background: '#141A1D', borderRadius: 3, marginTop: 3 }}>
              <div
                style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${(t.pct / maxPct) * 100}%`,
                  background: t.pct >= 50 ? GAIN : AMBER,
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PolymarketPredictions({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          BTC Price Predictions — Polymarket
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        BTC Price Predictions — Polymarket
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Live implied probabilities from real-money prediction markets — the price of each
        outcome&apos;s &ldquo;Yes&rdquo;/&ldquo;Up&rdquo; share, which is what traders are actually
        paying for it
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {TIMEFRAMES.map(({ key, label }) => (
          <BucketCard key={key} label={label} bucket={data.buckets?.[key]} />
        ))}
      </div>
      {data.missing?.length > 0 && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8 }}>
          No current Polymarket event matched for: {data.missing.join(', ')}.
        </p>
      )}
    </section>
  );
}
