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
  return v == null ? '—' : `$${v.toLocaleString()}`;
}

function pctDist(target, spot) {
  if (target == null || !spot) return null;
  return ((target - spot) / spot) * 100;
}

// The nearest-term quarterly (if one's in the visible window) is the
// conventional reference expiry for a headline max-pain read — it carries
// the deepest open interest and is what traders actually watch.
function headlineExpiry(expiries) {
  return expiries.find((e) => e.type === 'quarterly') || expiries[0] || null;
}

function readVerdict(callsPct, mpDist) {
  const bookLabel = callsPct == null ? null : callsPct > 50 ? 'Bullish book' : callsPct < 50 ? 'Bearish book' : 'Balanced book';
  if (!bookLabel) return null;
  if (mpDist == null || Math.abs(mpDist) < 1) return bookLabel;
  return `${bookLabel}, ${mpDist < 0 ? 'downward' : 'upward'} gravity`;
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
    vol24hCalls, vol24hPuts, totalBookOI, totalExpiryCount,
    expiries, topPositions, callWalls, downsideInsuranceStrike,
  } = data;

  const headline = headlineExpiry(expiries);
  const mpDist = headline ? pctDist(headline.maxPain, price) : null;
  const verdict = readVerdict(callsPct, mpDist);

  // The Fed-adjacent expiry (if any) sitting well above the reference
  // expiry's put/call ratio is a real, checkable "hedging the announcement,
  // not the month" pattern — only surfaced when the live data actually
  // shows it, at a threshold wide enough not to flag routine noise.
  const fedExpiry = expiries.find((e) => e.note?.includes('the Fed decision'));
  const showFedTell = fedExpiry && headline && fedExpiry.expiry !== headline.expiry
    && fedExpiry.putCallRatio != null && headline.putCallRatio != null
    && fedExpiry.putCallRatio - headline.putCallRatio >= 0.15;

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        BTC Options — Deribit Positioning
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Live open interest and max pain across {totalExpiryCount} active expiries, computed directly from
        Deribit&apos;s public order book — max pain is calculated here from real open-interest-by-strike
        data, not sourced from a paid aggregator
      </p>

      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16 }}>
        {verdict && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', paddingBottom: 14, borderBottom: `1px solid ${CARD_BORDER}` }}>
            <span style={{ fontSize: 11, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Read</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: AMBER }}>{verdict}</span>
            <span style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5, flex: '1 1 320px' }}>
              Calls hold {callsPct}% of open interest{headline && (
                <> — max pain for the {headline.type === 'quarterly' ? 'big quarterly' : headline.date} sits at{' '}
                  {fmtStrike(headline.maxPain)}{mpDist != null && `, ${Math.abs(mpDist).toFixed(1)}% ${mpDist >= 0 ? 'above' : 'below'} spot`}</>
              )}.
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
              24h volume leans the same way: {fmtK(vol24hCalls)} calls vs {fmtK(vol24hPuts)} puts. Total book
              across all {totalExpiryCount} expiries: {fmtK(totalBookOI)} BTC.
            </div>
          </div>

          <div style={{ flex: '1 1 280px', minWidth: 260 }}>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              By expiry — put/call ratio and max pain
            </div>
            {expiries.map((e) => {
              const hedgy = e.putCallRatio != null && e.putCallRatio >= 0.7;
              const dist = pctDist(e.maxPain, price);
              return (
                <div key={e.expiry} style={{ padding: '7px 0', borderBottom: `1px solid ${CARD_BORDER}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 12, color: TEXT_PRIMARY }}>{e.date}</span>
                    <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
                      {e.putCallRatio != null && (
                        <span style={{ color: hedgy ? AMBER : TEXT_SECONDARY }}>P/C {e.putCallRatio}{hedgy ? ' ⚠' : ''}</span>
                      )}
                      {e.maxPain != null && (
                        <span style={{ color: TEXT_SECONDARY, marginLeft: 8 }}>
                          MP {fmtStrike(e.maxPain)}{dist != null && ` (${dist.toFixed(1)}%)`}
                        </span>
                      )}
                    </span>
                  </div>
                  {e.note && <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2, lineHeight: 1.4 }}>{e.note}</div>}
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
            {(callWalls?.length > 0 || downsideInsuranceStrike != null) && (
              <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 10, lineHeight: 1.5 }}>
                {callWalls?.length > 0 && <>Call walls at {callWalls.map(fmtStrike).join(' and ')}</>}
                {callWalls?.length > 0 && downsideInsuranceStrike != null && '; '}
                {downsideInsuranceStrike != null && <>downside insurance concentrated near {fmtStrike(downsideInsuranceStrike)} and below</>}
                .
              </div>
            )}
          </div>
        )}

        {showFedTell && (
          <p style={{ fontSize: 12, color: AMBER, lineHeight: 1.55, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${CARD_BORDER}` }}>
            <strong>The Fed-specific tell:</strong> the {fedExpiry.date} expiry ({fedExpiry.note?.toLowerCase()}) carries
            a put/call of {fedExpiry.putCallRatio} — well above the {headline.date}{' '}
            {headline.type === 'quarterly' ? 'quarterly' : 'expiry'} at {headline.putCallRatio}. Traders are not
            hedging broadly, they&apos;re hedging the announcement specifically.
          </p>
        )}
      </div>

      <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10, lineHeight: 1.5, maxWidth: 700 }}>
        Max pain is a gravitational tendency into settlement as dealers hedge, not a forecast — large
        expiries have repeatedly settled far from it.
      </p>
    </section>
  );
}
