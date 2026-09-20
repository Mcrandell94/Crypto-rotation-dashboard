'use client';

const GAIN = '#7FA37F';
const LOSS = '#A85D4F';
const AMBER = '#C9A66B';
const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const BASELINE = '#2A3136';

function formatNet(v) {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toLocaleString()}`;
}

// Ported verbatim from the original prototype's cotLean().
function cotLean(idx, peak) {
  const pct = peak > 0 ? idx / peak : 0.5;
  if (pct >= 0.85) return { label: 'Near cycle high — commercials at max relative bullishness', color: GAIN };
  if (pct <= 0.35) return { label: 'Near cycle low — commercials at max relative bearishness', color: LOSS };
  return { label: `Rolled over from peak (${idx}/${peak}) — re-shorting into strength`, color: AMBER };
}

export default function CotPanel({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          COT Positioning — CME Bitcoin
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const { groups, cotIndex, cotIndexPeak, totalOI, asOf, lookbackWeeks } = data;
  const maxAbs = Math.max(1, ...groups.map((g) => Math.abs(g.net)));
  const lean = cotLean(cotIndex, cotIndexPeak);

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          COT Positioning — CME Bitcoin
        </h2>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>Week of {asOf?.slice(0, 10)}</span>
      </div>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Legacy classification, from the CFTC's public Commitments of Traders report
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {groups.map((g) => {
          const isLong = g.net >= 0;
          const fillPct = Math.min(78, (Math.abs(g.net) / maxAbs) * 100);
          return (
            <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px' }}>
              <div style={{ width: 140, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{g.name}</div>
                <div style={{ fontSize: 10, color: TEXT_MUTED }}>{g.sub}</div>
              </div>
              <div style={{ position: 'relative', flex: 1, height: 24, display: 'flex' }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: BASELINE }} />
                <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                  {!isLong && (
                    <>
                      <span style={{ fontSize: 11, color: LOSS, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatNet(g.net)}
                      </span>
                      <div style={{ width: `${fillPct}%`, height: 14, background: LOSS, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
                    </>
                  )}
                </div>
                <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 6 }}>
                  {isLong && (
                    <>
                      <div style={{ width: `${fillPct}%`, height: 14, background: GAIN, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
                      <span style={{ fontSize: 11, color: GAIN, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {formatNet(g.net)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8 }}>
        Total open interest ~{totalOI.toLocaleString()} contracts · net = long minus short
      </p>

      <div style={{ marginTop: 20, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>Commercial COT index</span>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>{lookbackWeeks}-week range</span>
        </div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 26, color: AMBER, marginTop: 4 }}>{cotIndex}</div>
        <div style={{ position: 'relative', height: 8, background: '#141A1D', borderRadius: 4, marginTop: 10 }}>
          <div
            style={{ position: 'absolute', left: `calc(${cotIndexPeak}% - 1px)`, top: -3, width: 2, height: 14, background: TEXT_MUTED }}
            title={`Recent peak: ${cotIndexPeak}`}
          />
          <div
            style={{ position: 'absolute', left: `calc(${cotIndex}% - 3px)`, top: -3, width: 8, height: 14, borderRadius: 2, background: AMBER }}
            title={`Current: ${cotIndex}`}
          />
        </div>
        <div style={{ fontSize: 11, color: lean.color, marginTop: 12 }}>{lean.label}</div>
      </div>
    </section>
  );
}
