'use client';

const GAIN = '#7FA37F';
const LOSS = '#A85D4F';
const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BORDER = '#2A3136';

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function formatPct(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

export default function FundingOI({ data, symbols }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Funding &amp; Open Interest — Hyperliquid
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const rows = symbols
    .map((sym) => ({ sym, d: data.data?.[sym] }))
    .filter((r) => r.d)
    .sort((a, b) => Math.abs(b.d.fundingRateHourly) - Math.abs(a.d.fundingRateHourly));

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Funding &amp; Open Interest — Hyperliquid
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Live perpetual funding rate and open interest, ranked by how extreme the funding rate is.
        Positive funding = longs pay shorts (crowded long); negative = shorts pay longs.
      </p>

      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>None of these tickers are listed on Hyperliquid.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: TEXT_MUTED, fontSize: 11 }}>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>Asset</th>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>Funding (hourly)</th>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>Funding (annualized)</th>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>Open interest</th>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>24h volume</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sym, d }) => {
              const color = d.fundingRateHourly >= 0 ? GAIN : LOSS;
              return (
                <tr key={sym} style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                  <td style={{ padding: '8px', color: TEXT_PRIMARY, fontWeight: 600 }}>{sym}</td>
                  <td style={{ padding: '8px', color, fontVariantNumeric: 'tabular-nums' }}>
                    {formatPct(d.fundingRateHourly * 100, 4)}
                  </td>
                  <td style={{ padding: '8px', color, fontVariantNumeric: 'tabular-nums' }}>
                    {formatPct(d.fundingRateAnnualized, 1)}
                  </td>
                  <td style={{ padding: '8px', color: TEXT_SECONDARY, fontVariantNumeric: 'tabular-nums' }}>
                    {formatUsd(d.openInterestUsd)}
                  </td>
                  <td style={{ padding: '8px', color: TEXT_SECONDARY, fontVariantNumeric: 'tabular-nums' }}>
                    {formatUsd(d.dayVolumeUsd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {data.notListed?.length > 0 && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8 }}>
          Not listed on Hyperliquid: {data.notListed.join(', ')}
        </p>
      )}
    </section>
  );
}
