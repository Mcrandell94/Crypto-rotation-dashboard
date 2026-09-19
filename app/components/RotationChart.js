'use client';

import { useState } from 'react';

const GAIN = '#7FA37F';
const LOSS = '#A85D4F';
const BASELINE = '#2A3136';
const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';

function formatPct(value) {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatPrice(value) {
  if (value == null) return '—';
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value < 1 ? 4 : 2 })}`;
}

function formatMarketCap(value) {
  if (value == null) return '—';
  return `$${(value / 1e9).toFixed(2)}B`;
}

export default function RotationChart({ tickers, symbols }) {
  const [view, setView] = useState('chart');
  const [hovered, setHovered] = useState(null);

  const rows = symbols
    .map((sym) => ({ sym, t: tickers?.[sym] }))
    .filter((r) => r.t)
    .sort((a, b) => b.t.percentChange7d - a.t.percentChange7d);

  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.t.percentChange7d)));

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Rotation — 7-day momentum</h2>
          <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 0' }}>
            Ranked by 7-day change · green = gaining, rust = declining
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['chart', 'table'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                background: view === v ? '#1E252A' : CARD_BG,
                border: `1px solid ${view === v ? '#C9A66B' : CARD_BORDER}`,
                color: view === v ? '#C9A66B' : TEXT_SECONDARY,
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 11,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for live data…</p>
      ) : view === 'table' ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: TEXT_MUTED, fontSize: 11 }}>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>Asset</th>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>Price</th>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>Mkt cap</th>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>24h</th>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>7d</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sym, t }) => (
              <tr key={sym} style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                <td style={{ padding: '8px', color: TEXT_PRIMARY, fontWeight: 600 }}>{sym}</td>
                <td style={{ padding: '8px', color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPrice(t.price)}
                </td>
                <td style={{ padding: '8px', color: TEXT_SECONDARY, fontVariantNumeric: 'tabular-nums' }}>{formatMarketCap(t.marketCap)}</td>
                <td style={{ padding: '8px', color: t.percentChange24h >= 0 ? GAIN : LOSS, fontVariantNumeric: 'tabular-nums' }}>
                  {formatPct(t.percentChange24h)}
                </td>
                <td style={{ padding: '8px', color: t.percentChange7d >= 0 ? GAIN : LOSS, fontVariantNumeric: 'tabular-nums' }}>
                  {formatPct(t.percentChange7d)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map(({ sym, t }) => {
            const pct = t.percentChange7d;
            const isGain = pct >= 0;
            const fillPct = Math.min(78, (Math.abs(pct) / maxAbs) * 100);
            const isHovered = hovered === sym;

            return (
              <div
                key={sym}
                tabIndex={0}
                role="group"
                aria-label={`${sym}: 7-day change ${formatPct(pct)}, price ${formatPrice(t.price)}`}
                onMouseEnter={() => setHovered(sym)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(sym)}
                onBlur={() => setHovered(null)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 4,
                  background: isHovered ? '#1E252A' : 'transparent',
                  outline: 'none',
                }}
              >
                <div style={{ width: 52, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{sym}</div>
                  <div style={{ fontSize: 10, color: t.percentChange24h >= 0 ? GAIN : LOSS }}>
                    24h {formatPct(t.percentChange24h)}
                  </div>
                </div>

                <div style={{ position: 'relative', flex: 1, height: 28, display: 'flex' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: BASELINE }} />

                  <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                    {!isGain && (
                      <>
                        <span style={{ fontSize: 11, color: LOSS, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {formatPct(pct)}
                        </span>
                        <div
                          style={{
                            width: `${fillPct}%`,
                            height: 14,
                            background: LOSS,
                            borderTopLeftRadius: 4,
                            borderBottomLeftRadius: 4,
                          }}
                        />
                      </>
                    )}
                  </div>

                  <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 6 }}>
                    {isGain && (
                      <>
                        <div
                          style={{
                            width: `${fillPct}%`,
                            height: 14,
                            background: GAIN,
                            borderTopRightRadius: 4,
                            borderBottomRightRadius: 4,
                          }}
                        />
                        <span style={{ fontSize: 11, color: GAIN, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {formatPct(pct)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {isHovered && (
                  <div
                    role="tooltip"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 62,
                      marginTop: 4,
                      zIndex: 10,
                      background: '#0F1316',
                      border: `1px solid ${CARD_BORDER}`,
                      borderRadius: 4,
                      padding: '8px 10px',
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div style={{ color: TEXT_PRIMARY, fontWeight: 600, marginBottom: 4 }}>{formatPrice(t.price)}</div>
                    <div style={{ color: TEXT_SECONDARY }}>Mkt cap: {formatMarketCap(t.marketCap)}</div>
                    <div style={{ color: t.percentChange24h >= 0 ? GAIN : LOSS }}>24h: {formatPct(t.percentChange24h)}</div>
                    <div style={{ color: t.percentChange7d >= 0 ? GAIN : LOSS }}>7d: {formatPct(t.percentChange7d)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
