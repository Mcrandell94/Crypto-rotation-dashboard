'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

function formatPrice(v) {
  if (v == null) return '—';
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: v < 1 ? 4 : 2 })}`;
}

function Row({ label, level, price }) {
  const above = price != null && level != null ? price >= level : null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${CARD_BORDER}` }}>
      <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: TEXT_PRIMARY }}>{formatPrice(level)}</span>
        {above != null && (
          <span style={{ fontSize: 10, color: above ? GAIN : LOSS }}>{above ? 'price above' : 'price below'}</span>
        )}
      </span>
    </div>
  );
}

function AssetCard({ symbol, data }) {
  if (!data) {
    return (
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 260px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>{symbol}</div>
        <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 8 }}>No data</div>
      </div>
    );
  }

  const { price, ema50, ema200, goldenCross } = data;

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 260px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>{symbol}</div>
        <div style={{ fontSize: 18, fontFamily: 'ui-monospace, monospace', color: TEXT_PRIMARY }}>{formatPrice(price)}</div>
      </div>
      {goldenCross != null && (
        <div style={{ fontSize: 11, color: goldenCross ? GAIN : LOSS, marginTop: 4 }}>
          {goldenCross ? 'Golden cross — 50 EMA above 200' : 'Death cross — 50 EMA below 200'}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <Row label="Daily 50 EMA" level={ema50} price={price} />
        <Row label="Daily 200 EMA" level={ema200} price={price} />
      </div>
    </div>
  );
}

export default function EmaLevels({ data, symbols }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>EMA Levels</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>EMA Levels</h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Daily 50/200 EMA, computed live from CoinGecko daily closes
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {symbols.map((sym) => (
          <AssetCard key={sym} symbol={sym} data={data.assets?.[sym]} />
        ))}
      </div>
      {data.failed?.length > 0 && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8 }}>
          No live data for: {data.failed.join(', ')} — skipped.
        </p>
      )}
      <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 12, lineHeight: 1.6 }}>
        Weekly 50/200 EMA aren't shown — they need ~1–4 years of weekly history, more than the
        free CoinGecko tier's 365-day cap provides. Computing them off the available data would
        just be a mislabeled average, not a real EMA.
      </p>
    </section>
  );
}
