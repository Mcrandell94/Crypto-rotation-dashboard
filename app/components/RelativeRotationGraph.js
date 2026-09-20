'use client';

import { useState, useMemo, useRef, useEffect } from 'react';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const PLOT_BG = '#141A1D';
const GRID = '#333B40';

const QUADRANTS = {
  leading: { name: 'Leading', color: '#7FA37F' },
  weakening: { name: 'Weakening', color: '#C9A66B' },
  lagging: { name: 'Lagging', color: '#A85D4F' },
  improving: { name: 'Improving', color: '#5E8FA8' },
};

// The first 3 hues clear the all-pairs CVD/contrast checks on their own; past
// that, a scatter chart can't keep every pair distinct by hue alone (verified
// with the dataviz palette validator — see project notes). Sectors here run
// up to 14 tickers, well past that cap, so color is a secondary channel:
// identity is carried primarily by the always-visible ticker label next to
// each dot, the click-to-hide legend, and the pin-for-detail view. Color +
// shape are cycled together (8 hues x 2 shapes = 16 combinations) so no two
// tickers in the same sector ever share both.
const CATEGORICAL_HUES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
function seriesStyleFor(index) {
  return {
    color: CATEGORICAL_HUES[index % CATEGORICAL_HUES.length],
    shape: Math.floor(index / CATEGORICAL_HUES.length) % 2 === 0 ? 'circle' : 'diamond',
  };
}

function sma(arr, i, w) {
  const s = arr.slice(Math.max(0, i - w + 1), i + 1);
  return s.reduce((a, b) => a + b, 0) / s.length;
}
function stdev(arr, i, w) {
  const s = arr.slice(Math.max(0, i - w + 1), i + 1);
  if (s.length < 2) return 0;
  const m = s.reduce((a, b) => a + b, 0) / s.length;
  return Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / (s.length - 1));
}
// zscore=false -> ratio-to-average (simple). zscore=true -> JdK-style volatility-normalized.
function computeSeries(asset, bench, n, m, zscore) {
  const ratio = asset.map((v, i) => v / bench[i]);
  const rsRatio = zscore
    ? ratio.map((r, i) => {
        const sd = stdev(ratio, i, n);
        return sd > 0 ? 100 + (r - sma(ratio, i, n)) / sd : 100;
      })
    : ratio.map((r, i) => 100 * (r / sma(ratio, i, n)));
  const rsMom = zscore
    ? rsRatio.map((r, i) => {
        const sd = stdev(rsRatio, i, m);
        return sd > 0 ? 100 + (r - sma(rsRatio, i, m)) / sd : 100;
      })
    : rsRatio.map((r, i) => 100 * (r / sma(rsRatio, i, m)));
  return rsRatio.map((_, i) => ({ x: rsRatio[i], y: rsMom[i] }));
}
function quadrantOf(x, y) {
  if (x >= 100 && y >= 100) return 'leading';
  if (x >= 100 && y < 100) return 'weakening';
  if (x < 100 && y < 100) return 'lagging';
  return 'improving';
}
function countFlips(pts) {
  let f = 0;
  for (let i = 1; i < pts.length; i++) {
    if (quadrantOf(pts[i].x, pts[i].y) !== quadrantOf(pts[i - 1].x, pts[i - 1].y)) f++;
  }
  return f;
}
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function Marker({ shape, x, y, r, color, ring }) {
  if (shape === 'diamond') {
    const d = `M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`;
    return <path d={d} fill={color} stroke={ring} strokeWidth={1.5} />;
  }
  return <circle cx={x} cy={y} r={r} fill={color} stroke={ring} strokeWidth={1.5} />;
}

const SIZE = 460;
const MARGIN = 34;
const PLOT = SIZE - MARGIN * 2;

const defaultAssetFormat = (v) => `$${v?.toLocaleString(undefined, { maximumFractionDigits: v < 1 ? 4 : 2 })}`;

export default function RelativeRotationGraph({ data, symbols, benchmark, assetLabel = 'price', assetFormat = defaultAssetFormat }) {
  const [tableView, setTableView] = useState(false);
  const [zscore, setZscore] = useState(true);
  const [tailLength, setTailLength] = useState(20);
  const [trendWindow, setTrendWindow] = useState(14);
  const [momentumWindow, setMomentumWindow] = useState(5);
  const [hidden, setHidden] = useState(new Set());
  const [pinned, setPinned] = useState(null);
  const [hover, setHover] = useState(null);

  const days = data?.days || [];
  const prices = data?.prices;
  const activeSymbols = symbols.filter((s) => prices?.[s]?.length);
  const styleOf = (sym) => seriesStyleFor(activeSymbols.indexOf(sym));
  const lastIdx = days.length - 1;

  const [endIdx, setEndIdx] = useState(0);
  useEffect(() => {
    if (lastIdx >= 0) setEndIdx(lastIdx);
  }, [lastIdx]);

  const seriesByTicker = useMemo(() => {
    // `data` can still be a stale fetch for the *previous* benchmark right
    // after switching (the new fetch hasn't resolved yet) — if that old
    // payload never included the new benchmark's price series, computeSeries
    // would divide by an undefined array and crash the page. Bail until the
    // fresh fetch lands instead.
    if (!prices || !prices[benchmark]) return {};
    const out = {};
    for (const sym of activeSymbols) {
      out[sym] = computeSeries(prices[sym], prices[benchmark], trendWindow, momentumWindow, zscore);
    }
    return out;
  }, [prices, activeSymbols.join(','), benchmark, trendWindow, momentumWindow, zscore]);

  const tailOf = (sym) => {
    const s = seriesByTicker[sym];
    if (!s) return [];
    return s.slice(Math.max(0, endIdx - tailLength + 1), endIdx + 1);
  };

  const shownSymbols = activeSymbols.filter((s) => !hidden.has(s));

  const autoRadius = useMemo(() => {
    let d = zscore ? 1.2 : 5;
    (shownSymbols.length ? shownSymbols : activeSymbols).forEach((sym) => {
      tailOf(sym).forEach((p) => {
        d = Math.max(d, Math.abs(p.x - 100), Math.abs(p.y - 100));
      });
    });
    return d * 1.25;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesByTicker, tailLength, hidden, endIdx, zscore]);

  const [viewCenter, setViewCenter] = useState({ x: 100, y: 100 });
  const [viewRadius, setViewRadius] = useState(autoRadius);
  useEffect(() => {
    setViewRadius(autoRadius);
    setViewCenter({ x: 100, y: 100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailLength, trendWindow, momentumWindow, zscore]);

  const pxToData = (2 * viewRadius) / PLOT;
  const toPx = (x, y) => [
    MARGIN + ((x - (viewCenter.x - viewRadius)) / (2 * viewRadius)) * PLOT,
    MARGIN + PLOT - ((y - (viewCenter.y - viewRadius)) / (2 * viewRadius)) * PLOT,
  ];
  const [cx0, cy0] = toPx(100, 100);

  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 });
  const onWheel = (e) => {
    e.preventDefault();
    setViewRadius((r) => clamp(r * (e.deltaY > 0 ? 1.12 : 0.89), 0.2, 200));
  };
  const onMouseDown = (e) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  };
  const onMouseMove = (e) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setViewCenter((c) => ({ x: c.x - dx * pxToData, y: c.y + dy * pxToData }));
  };
  const stopDrag = () => {
    dragRef.current.dragging = false;
  };
  const resetView = () => {
    setViewRadius(autoRadius);
    setViewCenter({ x: 100, y: 100 });
  };

  const toggleTicker = (sym) =>
    setHidden((prev) => {
      const n = new Set(prev);
      if (n.has(sym)) n.delete(sym);
      else n.add(sym);
      return n;
    });

  if (!prices || activeSymbols.length === 0) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Relative Rotation Graph
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for historical data…</p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
            Relative Rotation Graph
          </h2>
          <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 0' }}>
            Measured against {benchmark} · drag to pan, scroll to zoom
          </p>
        </div>
        <button
          onClick={() => setTableView((v) => !v)}
          style={{
            background: tableView ? '#1E252A' : CARD_BG,
            border: `1px solid ${tableView ? '#C9A66B' : CARD_BORDER}`,
            color: tableView ? '#C9A66B' : TEXT_SECONDARY,
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {tableView ? 'Chart' : 'Table'}
        </button>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: TEXT_SECONDARY, cursor: 'pointer', margin: '10px 0 16px' }}>
        <input type="checkbox" checked={zscore} onChange={(e) => setZscore(e.target.checked)} />
        Volatility-normalized (JdK-style z-score, vs simple ratio-to-average)
      </label>

      {tableView ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
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
              const tail = tailOf(sym);
              const c = tail[tail.length - 1];
              if (!c) return null;
              const q = quadrantOf(c.x, c.y);
              return (
                <tr key={sym} style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                  <td style={{ padding: '8px', color: TEXT_PRIMARY, fontWeight: 600 }}>{sym}</td>
                  <td style={{ padding: '8px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{c.x.toFixed(2)}</td>
                  <td style={{ padding: '8px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{c.y.toFixed(2)}</td>
                  <td style={{ padding: '8px', color: QUADRANTS[q].color }}>{QUADRANTS[q].name}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 18, maxWidth: SIZE + 36 }}>
            <div style={{ position: 'relative' }}>
              <svg
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                onWheel={onWheel}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={stopDrag}
                onMouseLeave={() => {
                  stopDrag();
                  setHover(null);
                }}
                style={{ cursor: 'grab', touchAction: 'none', display: 'block', width: '100%', height: 'auto' }}
              >
                <rect x={MARGIN} y={MARGIN} width={PLOT} height={PLOT} fill={PLOT_BG} />
                <rect x={cx0} y={MARGIN} width={MARGIN + PLOT - cx0} height={cy0 - MARGIN} fill={QUADRANTS.leading.color} opacity={0.08} />
                <rect x={cx0} y={cy0} width={MARGIN + PLOT - cx0} height={MARGIN + PLOT - cy0} fill={QUADRANTS.weakening.color} opacity={0.08} />
                <rect x={MARGIN} y={cy0} width={cx0 - MARGIN} height={MARGIN + PLOT - cy0} fill={QUADRANTS.lagging.color} opacity={0.08} />
                <rect x={MARGIN} y={MARGIN} width={cx0 - MARGIN} height={cy0 - MARGIN} fill={QUADRANTS.improving.color} opacity={0.08} />
                <line x1={MARGIN} y1={cy0} x2={MARGIN + PLOT} y2={cy0} stroke={GRID} strokeDasharray="3 3" />
                <line x1={cx0} y1={MARGIN} x2={cx0} y2={MARGIN + PLOT} stroke={GRID} strokeDasharray="3 3" />
                <rect x={MARGIN} y={MARGIN} width={PLOT} height={PLOT} fill="none" stroke={CARD_BORDER} />

                <text x={MARGIN + PLOT - 8} y={MARGIN + 16} textAnchor="end" fill={QUADRANTS.leading.color} fontSize={12}>Leading</text>
                <text x={MARGIN + PLOT - 8} y={MARGIN + PLOT - 8} textAnchor="end" fill={QUADRANTS.weakening.color} fontSize={12}>Weakening</text>
                <text x={MARGIN + 8} y={MARGIN + PLOT - 8} fill={QUADRANTS.lagging.color} fontSize={12}>Lagging</text>
                <text x={MARGIN + 8} y={MARGIN + 16} fill={QUADRANTS.improving.color} fontSize={12}>Improving</text>

                {shownSymbols.map((sym) => {
                  const { color, shape } = styleOf(sym);
                  const tail = tailOf(sym);
                  if (tail.length === 0) return null;
                  const px = tail.map((p) => toPx(p.x, p.y));
                  const d = px.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
                  const [lx, ly] = px[px.length - 1];
                  const firstIdx = Math.max(0, endIdx - tailLength + 1);

                  return (
                    <g key={sym}>
                      <path d={d} fill="none" stroke={color} strokeWidth={1.5} opacity={0.85} />
                      {px.slice(0, -1).map((p, i) => (
                        <g
                          key={i}
                          tabIndex={0}
                          role="img"
                          aria-label={`${sym} on ${days[firstIdx + i]}: RS-Ratio ${tail[i].x.toFixed(1)}, RS-Momentum ${tail[i].y.toFixed(1)}`}
                          onMouseEnter={() => setHover({ sym, day: days[firstIdx + i], x: tail[i].x, y: tail[i].y, px: p[0], py: p[1] })}
                          onMouseLeave={() => setHover(null)}
                          onFocus={() => setHover({ sym, day: days[firstIdx + i], x: tail[i].x, y: tail[i].y, px: p[0], py: p[1] })}
                          onBlur={() => setHover(null)}
                          style={{ outline: 'none', cursor: 'pointer' }}
                        >
                          <circle cx={p[0]} cy={p[1]} r={10} fill="transparent" />
                          <Marker shape={shape} x={p[0]} y={p[1]} r={3.4} color={color} ring={PLOT_BG} />
                        </g>
                      ))}
                      <g
                        tabIndex={0}
                        role="img"
                        aria-label={`${sym} current: RS-Ratio ${tail[tail.length - 1].x.toFixed(1)}, RS-Momentum ${tail[tail.length - 1].y.toFixed(1)}, ${quadrantOf(tail[tail.length - 1].x, tail[tail.length - 1].y)}`}
                        onMouseEnter={() => setHover({ sym, day: days[endIdx], x: tail[tail.length - 1].x, y: tail[tail.length - 1].y, px: lx, py: ly })}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover({ sym, day: days[endIdx], x: tail[tail.length - 1].x, y: tail[tail.length - 1].y, px: lx, py: ly })}
                        onBlur={() => setHover(null)}
                        style={{ outline: 'none', cursor: 'pointer' }}
                      >
                        <circle cx={lx} cy={ly} r={14} fill="transparent" />
                        <Marker shape={shape} x={lx} y={ly} r={5} color={color} ring={PLOT_BG} />
                        <text x={lx + 8} y={ly + 4} fill={color} fontSize={11} fontFamily="ui-monospace,monospace">{sym}</text>
                      </g>
                    </g>
                  );
                })}

                {hover && (
                  <g pointerEvents="none">
                    <rect
                      x={clamp(hover.px + 10, MARGIN, MARGIN + PLOT - 130)}
                      y={clamp(hover.py - 38, MARGIN, MARGIN + PLOT - 36)}
                      width={128}
                      height={34}
                      rx={3}
                      fill="#0E1316"
                      stroke={styleOf(hover.sym).color}
                      opacity={0.97}
                    />
                    <text
                      x={clamp(hover.px + 10, MARGIN, MARGIN + PLOT - 130) + 8}
                      y={clamp(hover.py - 38, MARGIN, MARGIN + PLOT - 36) + 14}
                      fill={TEXT_PRIMARY}
                      fontSize={11}
                      fontFamily="ui-monospace,monospace"
                    >
                      {hover.sym} · {hover.day}
                    </text>
                    <text
                      x={clamp(hover.px + 10, MARGIN, MARGIN + PLOT - 130) + 8}
                      y={clamp(hover.py - 38, MARGIN, MARGIN + PLOT - 36) + 27}
                      fill={TEXT_SECONDARY}
                      fontSize={10}
                      fontFamily="ui-monospace,monospace"
                    >
                      RS {hover.x.toFixed(2)} / Mom {hover.y.toFixed(2)}
                    </text>
                  </g>
                )}
              </svg>

              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button onClick={() => setViewRadius((r) => clamp(r * 0.8, 0.2, 200))} style={zoomBtnStyle}>+</button>
                <button onClick={() => setViewRadius((r) => clamp(r * 1.25, 0.2, 200))} style={zoomBtnStyle}>−</button>
                <button onClick={resetView} style={zoomBtnStyle} title="Reset view">⤢</button>
              </div>
            </div>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, minWidth: 50 }}>Day of</span>
                <input
                  type="range"
                  min={Math.min(tailLength, lastIdx)}
                  max={Math.max(0, lastIdx)}
                  value={endIdx}
                  onChange={(e) => setEndIdx(parseInt(e.target.value, 10))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', minWidth: 58 }}>{days[endIdx]}</span>
                {endIdx !== lastIdx && (
                  <button onClick={() => setEndIdx(lastIdx)} style={linkBtnStyle}>now</button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 12 }}>
                <SliderControl label="Tail" unit="d" value={tailLength} min={5} max={Math.max(6, Math.min(60, days.length - 1))} onChange={setTailLength} />
                <SliderControl label="Trend" unit="d" value={trendWindow} min={5} max={40} onChange={setTrendWindow} />
                <SliderControl label="Momentum" unit="d" value={momentumWindow} min={2} max={15} onChange={setMomentumWindow} />
              </div>
            </div>
          </div>

          <div style={{ minWidth: 240, flex: '1 1 240px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: TEXT_MUTED }}>Click to hide · flips over tail</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setHidden(new Set())} style={linkBtnStyle}>All</button>
                <button onClick={() => setHidden(new Set(activeSymbols))} style={linkBtnStyle}>None</button>
              </div>
            </div>
            {activeSymbols.map((sym) => {
              const { color, shape } = styleOf(sym);
              const tail = tailOf(sym);
              const last = tail[tail.length - 1];
              if (!last) return null;
              const q = quadrantOf(last.x, last.y);
              const flips = countFlips(tail);
              const noisy = flips >= Math.max(3, Math.floor(tail.length / 3));
              const on = !hidden.has(sym);
              return (
                <div
                  key={sym}
                  onClick={() => toggleTicker(sym)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 0', borderBottom: `1px solid ${CARD_BORDER}`, fontSize: 13,
                    cursor: 'pointer', opacity: on ? 1 : 0.36, userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width={10} height={10} aria-hidden="true">
                      {shape === 'diamond' ? (
                        <path d="M 5 0.5 L 9.5 5 L 5 9.5 L 0.5 5 Z" fill={color} />
                      ) : (
                        <circle cx={5} cy={5} r={4.5} fill={color} />
                      )}
                    </svg>
                    <span style={{ color: TEXT_PRIMARY }}>{sym}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPinned(pinned === sym ? null : sym);
                      }}
                      title="Pin for detail view"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0, color: pinned === sym ? '#C9A66B' : '#4A5257' }}
                    >
                      🔍
                    </button>
                    <span style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: noisy ? '#C9A66B' : TEXT_MUTED }} title={`${flips} quadrant change(s) across ${tail.length} days`}>
                      {flips}⤢
                    </span>
                    <div style={{ textAlign: 'right', minWidth: 78 }}>
                      <div style={{ color: QUADRANTS[q].color, fontSize: 12 }}>{QUADRANTS[q].name}</div>
                      <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: TEXT_SECONDARY }}>
                        {last.x.toFixed(2)} / {last.y.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <p style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.55, marginTop: 12 }}>
              The flip count is how many times an asset changed quadrant across the visible tail —
              high counts mean noise, not signal.
            </p>
          </div>
        </div>
      )}

      {pinned && !tableView && (() => {
        const sym = pinned;
        const { color } = styleOf(sym);
        const tail = tailOf(sym);
        const startIdx = Math.max(0, endIdx - tailLength + 1);
        if (tail.length === 0) return null;
        return (
          <div style={{ marginTop: 16, background: CARD_BG, border: `1px solid ${color}`, borderRadius: 6, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 15, color: TEXT_PRIMARY, fontWeight: 600 }}>{sym}</span>
              </div>
              <button
                onClick={() => setPinned(null)}
                style={{ background: 'none', border: `1px solid ${CARD_BORDER}`, borderRadius: 4, color: TEXT_SECONDARY, fontSize: 11, padding: '3px 9px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
            <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10, lineHeight: 1.5 }}>
              {sym} vs {benchmark}, {tail.length} days visible at current tail length. RS-Ratio/Momentum
              use the {trendWindow}/{momentumWindow}-day windows set above.
            </p>
            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${CARD_BORDER}`, color: TEXT_MUTED, textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px 4px 0' }}>Day</th>
                    <th style={{ padding: '4px 8px' }}>{sym} {assetLabel}</th>
                    <th style={{ padding: '4px 8px' }}>{benchmark} price</th>
                    <th style={{ padding: '4px 8px' }}>RS-Ratio</th>
                    <th style={{ padding: '4px 8px' }}>RS-Mom</th>
                    <th style={{ padding: '4px 0' }}>Quadrant</th>
                  </tr>
                </thead>
                <tbody>
                  {tail.map((pt, i) => {
                    const idx = startIdx + i;
                    const q = quadrantOf(pt.x, pt.y);
                    const prevQ = i > 0 ? quadrantOf(tail[i - 1].x, tail[i - 1].y) : null;
                    const flipped = prevQ !== null && prevQ !== q;
                    return (
                      <tr key={days[idx]} style={{ borderTop: `1px solid #1D2226` }}>
                        <td style={{ padding: '4px 8px 4px 0', color: TEXT_SECONDARY, fontFamily: 'ui-monospace,monospace' }}>{days[idx]}</td>
                        <td style={{ padding: '4px 8px', color: TEXT_PRIMARY, fontFamily: 'ui-monospace,monospace' }}>
                          {assetFormat(prices[sym][idx])}
                        </td>
                        <td style={{ padding: '4px 8px', color: TEXT_PRIMARY, fontFamily: 'ui-monospace,monospace' }}>
                          ${prices[benchmark][idx]?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '4px 8px', color: TEXT_PRIMARY, fontFamily: 'ui-monospace,monospace' }}>{pt.x.toFixed(2)}</td>
                        <td style={{ padding: '4px 8px', color: TEXT_PRIMARY, fontFamily: 'ui-monospace,monospace' }}>{pt.y.toFixed(2)}</td>
                        <td style={{ padding: '4px 0', color: QUADRANTS[q].color }}>
                          {QUADRANTS[q].name}
                          {flipped && <span style={{ color: '#C9A66B' }}> ← flip</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 12, lineHeight: 1.6 }}>
        RS-Ratio and RS-Momentum are a standard open approximation of the JdK RRG method, not the
        exact proprietary formula. BTC and ETH are wired up as benchmarks — Gold/USD from the
        prototype would need a non-crypto data source.
      </p>
    </section>
  );
}

const zoomBtnStyle = {
  background: '#171D21',
  border: '1px solid #2A3136',
  color: '#C9A66B',
  borderRadius: 4,
  width: 24,
  height: 24,
  fontSize: 13,
  lineHeight: '22px',
  padding: 0,
  cursor: 'pointer',
};

const linkBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#C9A66B',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
};

function SliderControl({ label, unit, value, min, max, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} style={{ width: 88 }} />
      <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>{value}{unit}</span>
    </div>
  );
}
