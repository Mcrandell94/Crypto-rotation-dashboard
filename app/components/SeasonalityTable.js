'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const GAIN = '127, 163, 127';
const LOSS = '168, 93, 79';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function heatColor(v, maxAbs) {
  if (v == null || !maxAbs) return 'transparent';
  const intensity = Math.min(1, Math.abs(v) / maxAbs);
  const base = v >= 0 ? GAIN : LOSS;
  return `rgba(${base}, ${(0.12 + intensity * 0.45).toFixed(2)})`;
}

export default function SeasonalityTable({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>BTC Seasonality</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const { years, monthlyReturns, currentYear, currentMonth } = data;
  const allVals = years.flatMap((y) => monthlyReturns[y]).filter((v) => v != null);
  const maxAbs = Math.max(1, ...allVals.map(Math.abs));

  const avgByMonth = MONTHS.map((_, mi) => {
    const vals = years.map((y) => monthlyReturns[y][mi]).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  const curAvg = avgByMonth[currentMonth];
  const curYearVals = years.map((y) => monthlyReturns[y][currentMonth]).filter((v) => v != null);
  const curGreenCount = curYearVals.filter((v) => v > 0).length;

  return (
    <section style={{ marginTop: 20, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>BTC monthly returns, last {years.length} years</div>
        <div style={{ fontSize: 11, color: TEXT_MUTED }}>
          Computed live from Kraken weekly closes — month boundaries are approximate to the nearest week
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 6px', textAlign: 'left', color: TEXT_SECONDARY, fontWeight: 400 }} />
              {MONTHS.map((m, i) => (
                <th
                  key={m}
                  style={{
                    padding: '4px 6px', color: i === currentMonth ? TEXT_PRIMARY : TEXT_MUTED, fontWeight: 400,
                    fontFamily: 'ui-monospace,monospace', borderBottom: i === currentMonth ? `2px solid ${TEXT_PRIMARY}` : 'none',
                  }}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}>
                <td style={{ padding: '4px 6px', color: TEXT_SECONDARY, fontFamily: 'ui-monospace,monospace' }}>{y}</td>
                {monthlyReturns[y].map((v, mi) => (
                  <td
                    key={mi}
                    style={{
                      padding: '5px 6px', textAlign: 'center', fontFamily: 'ui-monospace,monospace',
                      background: heatColor(v, maxAbs), color: TEXT_PRIMARY,
                      outline: mi === currentMonth ? `1px solid ${TEXT_PRIMARY}` : 'none', outlineOffset: -1,
                    }}
                  >
                    {v == null ? '—' : `${v > 0 ? '+' : ''}${v}`}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td style={{ padding: '5px 6px', color: TEXT_SECONDARY, fontFamily: 'ui-monospace,monospace', borderTop: `1px solid ${CARD_BORDER}` }}>Avg</td>
              {avgByMonth.map((v, mi) => (
                <td
                  key={mi}
                  style={{
                    padding: '5px 6px', textAlign: 'center', fontFamily: 'ui-monospace,monospace', fontWeight: 600,
                    color: v == null ? TEXT_MUTED : v >= 0 ? `rgb(${GAIN})` : `rgb(${LOSS})`,
                    borderTop: `1px solid ${CARD_BORDER}`,
                    outline: mi === currentMonth ? `1px solid ${TEXT_PRIMARY}` : 'none', outlineOffset: -1,
                  }}
                >
                  {v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(0)}`}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {curAvg != null && (
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.55, marginTop: 14 }}>
          <strong style={{ color: TEXT_PRIMARY }}>{MONTHS[currentMonth]} {currentYear} (current):</strong> averaged{' '}
          <strong style={{ color: curAvg >= 0 ? `rgb(${GAIN})` : `rgb(${LOSS})` }}>
            {curAvg > 0 ? '+' : ''}{curAvg.toFixed(0)}%
          </strong>{' '}
          across the {curYearVals.length} prior years with data ({curGreenCount} of {curYearVals.length} closed green).
        </p>
      )}
    </section>
  );
}
