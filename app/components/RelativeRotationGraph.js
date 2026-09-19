'use client';

import { useState } from 'react';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const BASELINE = '#2A3136';

// 3 of the 4 series clear the all-pairs CVD/contrast checks on their own;
// LINK reuses SUI's hue but with a diamond marker (composite hue x shape
// encoding) since a 4th fully-distinct hue doesn't pass at this surface.
const SERIES_STYLE = {
  ETH: { color: '#3987e5', shape: 'circle' },
  SOL: { color: '#d95926', shape: 'circle' },
  SUI: { color: '#199e70', shape: 'circle' },
  LINK: { color: '#199e70', shape: 'diamond' },
};

const VB_W = 640;
const VB_H = 420;
const PAD = 56;

function quadrantOf(rsRatio, rsMomentum) {
  if (rsRatio >= 100 && rsMomentum >= 100) return 'Leading';
  if (rsRatio >= 100 && rsMomentum < 100) return 'Weakening';
  if (rsRatio < 100 && rsMomentum < 100) return 'Lagging';
  return 'Improving';
}

function Marker({ shape, x, y, r, color, ring }) {
  if (shape === 'diamond') {
    const d = `M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`;
    return <path d={d} fill={color} stroke={ring} strokeWidth={2} />;
  }
  return <circle cx={x} cy={y} r={r} fill={color} stroke={ring} strokeWidth={2} />;
}

export default function RelativeRotationGraph({ data, symbols, benchmark }) {
  const [view, setView] = useState('chart');
  const [hover, setHover] = useState(null);

  const series = data?.series;
  const activeSymbols = symbols.filter((s) => series?.[s]?.tail?.length);

  if (!series || activeSymbols.length === 0) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Relative Rotation Graph
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for historical data…</p>
      </section>
    );
  }

  const allPoints = activeSymbols.flatMap((sym) => series[sym].tail);
  const ratios = allPoints.map((p) => p.rsRatio);
  const momenta = allPoints.map((p) => p.rsMomentum);

  const spread = (vals) => {
    const min = Math.min(100, ...vals);
    const max = Math.max(100, ...vals);
    const pad = Math.max(3, (max - min) * 0.2);
    return [min - pad, max + pad];
  };
  const [xMin, xMax] = spread(ratios);
  const [yMin, yMax] = spread(momenta);

  const plotLeft = PAD;
  const plotRight = VB_W - PAD;
  const plotTop = PAD;
  const plotBottom = VB_H - PAD;

  const xScale = (v) => plotLeft + ((v - xMin) / (xMax - xMin)) * (plotRight - plotLeft);
  const yScale = (v) => plotBottom - ((v - yMin) / (yMax - yMin)) * (plotBottom - plotTop);

  const centerX = xScale(100);
  const centerY = yScale(100);

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
            Relative Rotation Graph
          </h2>
          <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 0' }}>
            RS-Ratio vs RS-Momentum against {benchmark} · last {activeSymbols.length ? series[activeSymbols[0]].tail.length : 0} days, trailing tail
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

      <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
        {activeSymbols.map((sym) => {
          const { color, shape } = SERIES_STYLE[sym] || { color: TEXT_SECONDARY, shape: 'circle' };
          return (
            <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: TEXT_SECONDARY }}>
              <svg width={14} height={14} aria-hidden="true">
                {shape === 'diamond' ? (
                  <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill={color} />
                ) : (
                  <circle cx={7} cy={7} r={5} fill={color} />
                )}
              </svg>
              {sym}
            </div>
          );
        })}
      </div>

      {view === 'table' ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: TEXT_MUTED, fontSize: 11 }}>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>Asset</th>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>RS-Ratio</th>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>RS-Momentum</th>
              <th style={{ padding: '6px 8px', fontWeight: 500 }}>Quadrant</th>
            </tr>
          </thead>
          <tbody>
            {activeSymbols.map((sym) => {
              const c = series[sym].current;
              return (
                <tr key={sym} style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                  <td style={{ padding: '8px', color: TEXT_PRIMARY, fontWeight: 600 }}>{sym}</td>
                  <td style={{ padding: '8px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{c.rsRatio.toFixed(2)}</td>
                  <td style={{ padding: '8px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{c.rsMomentum.toFixed(2)}</td>
                  <td style={{ padding: '8px', color: TEXT_SECONDARY }}>{quadrantOf(c.rsRatio, c.rsMomentum)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ position: 'relative', marginTop: 16 }}>
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <line x1={centerX} y1={plotTop} x2={centerX} y2={plotBottom} stroke={BASELINE} strokeWidth={1} />
            <line x1={plotLeft} y1={centerY} x2={plotRight} y2={centerY} stroke={BASELINE} strokeWidth={1} />

            <text x={plotRight - 6} y={plotTop + 14} textAnchor="end" fontSize={11} fill={TEXT_MUTED}>Leading</text>
            <text x={plotRight - 6} y={plotBottom - 6} textAnchor="end" fontSize={11} fill={TEXT_MUTED}>Weakening</text>
            <text x={plotLeft + 6} y={plotBottom - 6} textAnchor="start" fontSize={11} fill={TEXT_MUTED}>Lagging</text>
            <text x={plotLeft + 6} y={plotTop + 14} textAnchor="start" fontSize={11} fill={TEXT_MUTED}>Improving</text>

            {activeSymbols.map((sym) => {
              const { color, shape } = SERIES_STYLE[sym] || { color: TEXT_SECONDARY, shape: 'circle' };
              const tail = series[sym].tail;
              const points = tail.map((p) => `${xScale(p.rsRatio)},${yScale(p.rsMomentum)}`).join(' ');
              const last = tail[tail.length - 1];
              const lastX = xScale(last.rsRatio);
              const lastY = yScale(last.rsMomentum);
              const labelRight = last.rsRatio < xMin + (xMax - xMin) * 0.85;
              const labelBelow = last.rsMomentum < yMin + (yMax - yMin) * 0.15;

              return (
                <g key={sym}>
                  <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />

                  {tail.slice(0, -1).map((p, i) => {
                    const x = xScale(p.rsRatio);
                    const y = yScale(p.rsMomentum);
                    const key = `${sym}-${i}`;
                    return (
                      <g
                        key={key}
                        tabIndex={0}
                        role="img"
                        aria-label={`${sym} on ${p.date}: RS-Ratio ${p.rsRatio.toFixed(1)}, RS-Momentum ${p.rsMomentum.toFixed(1)}`}
                        onMouseEnter={() => setHover({ sym, x, y, ...p })}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover({ sym, x, y, ...p })}
                        onBlur={() => setHover(null)}
                        style={{ outline: 'none', cursor: 'pointer' }}
                      >
                        <circle cx={x} cy={y} r={12} fill="transparent" />
                        <Marker shape={shape} x={x} y={y} r={3} color={color} ring={CARD_BG} />
                      </g>
                    );
                  })}

                  <g
                    tabIndex={0}
                    role="img"
                    aria-label={`${sym} current: RS-Ratio ${last.rsRatio.toFixed(1)}, RS-Momentum ${last.rsMomentum.toFixed(1)}, ${quadrantOf(last.rsRatio, last.rsMomentum)}`}
                    onMouseEnter={() => setHover({ sym, x: lastX, y: lastY, ...last })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ sym, x: lastX, y: lastY, ...last })}
                    onBlur={() => setHover(null)}
                    style={{ outline: 'none', cursor: 'pointer' }}
                  >
                    <circle cx={lastX} cy={lastY} r={16} fill="transparent" />
                    <Marker shape={shape} x={lastX} y={lastY} r={6} color={color} ring={CARD_BG} />
                    <text
                      x={lastX + (labelRight ? 10 : -10)}
                      y={lastY + (labelBelow ? 16 : -10)}
                      textAnchor={labelRight ? 'start' : 'end'}
                      fontSize={12}
                      fontWeight={600}
                      fill={TEXT_PRIMARY}
                    >
                      {sym}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {hover && (
            <div
              role="tooltip"
              style={{
                position: 'absolute',
                left: `${(hover.x / VB_W) * 100}%`,
                top: `${(hover.y / VB_H) * 100}%`,
                transform: 'translate(-50%, -120%)',
                zIndex: 10,
                background: '#0F1316',
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 4,
                padding: '8px 10px',
                fontSize: 11,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ color: TEXT_PRIMARY, fontWeight: 600, marginBottom: 4 }}>{hover.sym} · {hover.date}</div>
              <div style={{ color: TEXT_SECONDARY }}>RS-Ratio: {hover.rsRatio.toFixed(2)}</div>
              <div style={{ color: TEXT_SECONDARY }}>RS-Momentum: {hover.rsMomentum.toFixed(2)}</div>
              <div style={{ color: TEXT_MUTED }}>{quadrantOf(hover.rsRatio, hover.rsMomentum)}</div>
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 12, lineHeight: 1.6 }}>
        RS-Ratio and RS-Momentum are a standard open approximation of the JdK RRG method (relative
        strength vs {benchmark}, smoothed, and its rate of change), not the exact proprietary formula.
      </p>
    </section>
  );
}
