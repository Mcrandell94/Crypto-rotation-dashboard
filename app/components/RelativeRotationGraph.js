'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  computeSeries, firstValidIndex, quadrantOf, countFlips, quadrantStreak, heading,
} from '../lib/rrgMath';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const PLOT_BG = '#141A1D';
const GRID = '#222A2F'; // hairline, one step off the plot surface
const AXIS_100 = '#46525A'; // the benchmark lines — the only emphasized rules
const ACCENT = '#C9A66B';

const QUADRANTS = {
  leading: { name: 'Leading', color: '#7FA37F' },
  weakening: { name: 'Weakening', color: '#C9A66B' },
  lagging: { name: 'Lagging', color: '#A85D4F' },
  improving: { name: 'Improving', color: '#5E8FA8' },
};
// Laid out like the chart itself: top row Improving | Leading, bottom row
// Lagging | Weakening. Rotation is normally clockwise through them.
const QUADRANT_GRID = ['improving', 'leading', 'lagging', 'weakening'];
const QUADRANT_SORT = { leading: 0, improving: 1, weakening: 2, lagging: 3 };

// Series identity: 8 dark-mode categorical hues x 2 marker shapes. Scatter
// can't keep more than ~3 series apart by hue alone (dataviz palette
// validator, all-pairs), so identity is carried by the ticker label, the
// legend, and focus mode (hover or pin one series, the rest dim). Color is
// keyed to the ticker's position in the sector list, so a ticker that fails
// to load doesn't repaint the others.
const CATEGORICAL_HUES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
function seriesStyleFor(index) {
  const i = Math.max(0, index);
  return {
    color: CATEGORICAL_HUES[i % CATEGORICAL_HUES.length],
    shape: Math.floor(i / CATEGORICAL_HUES.length) % 2 === 0 ? 'circle' : 'diamond',
  };
}

const DEFAULT_SETTINGS = { zscore: true, tailLength: 7, trendWindow: 14, momentumWindow: 5, smoothing: 3 };
const SETTINGS_KEY = 'rrgSettings.v1';
const RECENT_DAYS = 3; // "recent quadrant change" window for the summary
const RECENT_MAX = 6; // how many recent changes to list before "+N more"

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Axis ticks on a 1/2/5 step ladder (~4-6 per axis), labelled with just
// enough decimals for the step.
function ticksFor(lo, hi) {
  const raw = (hi - lo) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const decimals = Math.max(0, Math.min(3, -Math.floor(Math.log10(step) + 1e-9)));
  const out = [];
  const first = Math.ceil(lo / step - 1e-9);
  for (let k = first; k * step <= hi + 1e-9; k++) {
    const v = Math.round(k * step * 1e9) / 1e9;
    out.push({ v, label: v.toFixed(decimals) });
  }
  return out;
}

// Hover handlers that only fire for a real mouse. On touch, a tap would
// otherwise leave a hover "stuck" on; taps go through onClick instead.
const mouseOnly = (fn) => (e) => {
  if (e.pointerType === 'mouse') fn(e);
};

function Marker({ shape, x, y, r, color, ring, ringWidth = 1.5, opacity = 1 }) {
  if (shape === 'diamond') {
    const rr = r * 1.15;
    const d = `M ${x} ${y - rr} L ${x + rr} ${y} L ${x} ${y + rr} L ${x - rr} ${y} Z`;
    return <path d={d} fill={color} stroke={ring} strokeWidth={ringWidth} opacity={opacity} />;
  }
  return <circle cx={x} cy={y} r={r} fill={color} stroke={ring} strokeWidth={ringWidth} opacity={opacity} />;
}

function Swatch({ shape, color, size = 10 }) {
  return (
    <svg width={size} height={size} aria-hidden="true" style={{ flexShrink: 0 }}>
      {shape === 'diamond' ? (
        <path d={`M ${size / 2} 0.5 L ${size - 0.5} ${size / 2} L ${size / 2} ${size - 0.5} L 0.5 ${size / 2} Z`} fill={color} />
      ) : (
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 0.5} fill={color} />
      )}
    </svg>
  );
}

// Greedy label placement: try positions around each series' head and take
// the first that stays inside the plot and clear of other labels and heads.
// A label with nowhere to go is dropped — the legend, tooltip and table
// still carry that series — rather than stacked on top of another one.
function placeLabels(items, bounds) {
  const obstacles = items.map((it) => ({ x0: it.x - 7, y0: it.y - 7, x1: it.x + 7, y1: it.y + 7, owner: it.sym, head: true }));
  const overlaps = (a, b) => !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1);
  const out = {};
  for (const it of items) {
    const w = it.text.length * 6.7 + 2;
    const h = 13;
    const { x, y } = it;
    const candidates = [
      { x0: x + 8, y0: y - h / 2, anchor: 'start', tx: x + 9, ty: y + 4 },
      { x0: x - 8 - w, y0: y - h / 2, anchor: 'end', tx: x - 9, ty: y + 4 },
      { x0: x - w / 2, y0: y - 9 - h, anchor: 'middle', tx: x, ty: y - 12 },
      { x0: x - w / 2, y0: y + 9, anchor: 'middle', tx: x, ty: y + 19 },
      { x0: x + 6, y0: y - 6 - h, anchor: 'start', tx: x + 7, ty: y - 9 },
      { x0: x + 6, y0: y + 6, anchor: 'start', tx: x + 7, ty: y + 16 },
      { x0: x - 6 - w, y0: y - 6 - h, anchor: 'end', tx: x - 7, ty: y - 9 },
      { x0: x - 6 - w, y0: y + 6, anchor: 'end', tx: x - 7, ty: y + 16 },
    ];
    for (const c of candidates) {
      const r = { x0: c.x0, y0: c.y0, x1: c.x0 + w, y1: c.y0 + h };
      const inside = r.x0 >= bounds.x0 && r.x1 <= bounds.x1 && r.y0 >= bounds.y0 && r.y1 <= bounds.y1;
      const blocked = obstacles.some((o) => !(o.head && o.owner === it.sym) && overlaps(r, o));
      if (inside && !blocked) {
        obstacles.push({ ...r, owner: it.sym, head: false });
        out[it.sym] = c;
        break;
      }
    }
  }
  return out;
}

const defaultAssetFormat = (v) => `$${v?.toLocaleString(undefined, { maximumFractionDigits: v < 1 ? 4 : 2 })}`;

export default function RelativeRotationGraph({
  data, symbols, benchmark, assetLabel = 'price', assetFormat = defaultAssetFormat, labelFor = (s) => s,
}) {
  const [tableView, setTableView] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const { zscore, tailLength, trendWindow, momentumWindow, smoothing } = settings;
  const setSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  // Remember this viewer's chart settings between visits (browser-only
  // convenience; the chart works the same without it).
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || 'null');
      if (saved && typeof saved === 'object') setSettings((s) => ({ ...s, ...saved }));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const [hidden, setHidden] = useState(new Set());
  const [pinned, setPinned] = useState(null);
  const [hoverSym, setHoverSym] = useState(null); // legend/series hover -> focus
  const [hoverPt, setHoverPt] = useState(null); // { sym, idx } -> tooltip

  const days = data?.days || [];
  const prices = data?.prices;
  const activeSymbols = symbols.filter((s) => prices?.[s]?.length);
  const styleOf = (sym) => seriesStyleFor(symbols.indexOf(sym));
  const lastIdx = days.length - 1;
  const symbolsKey = symbols.join(',');

  // A new sector/benchmark is a new set of series: clear per-series state.
  useEffect(() => {
    setHidden(new Set());
    setPinned(null);
    setHoverSym(null);
    setHoverPt(null);
  }, [symbolsKey]);

  const warm = firstValidIndex(settings);
  const minEnd = Math.min(Math.max(0, lastIdx), warm + tailLength - 1);

  const [endIdx, setEndIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (lastIdx >= 0) setEndIdx(lastIdx);
    setPlaying(false);
  }, [lastIdx, symbolsKey, benchmark]);
  const end = clamp(endIdx, minEnd, Math.max(minEnd, lastIdx));

  // Play: step the scrubber forward a day at a time to watch the rotation.
  const endRef = useRef(end);
  endRef.current = end;
  useEffect(() => {
    if (!playing) return undefined;
    const t = setInterval(() => {
      const next = endRef.current + 1;
      if (next >= lastIdx) {
        setEndIdx(lastIdx);
        setPlaying(false);
      } else {
        setEndIdx(next);
      }
    }, 450);
    return () => clearInterval(t);
  }, [playing, lastIdx]);
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (end >= lastIdx) setEndIdx(minEnd);
    setPlaying(true);
  };

  const seriesByTicker = useMemo(() => {
    // `data` can still be the previous benchmark's payload for a moment
    // after switching; bail until the fresh fetch lands rather than divide
    // by a missing benchmark series.
    if (!prices || !prices[benchmark]) return {};
    const out = {};
    for (const sym of activeSymbols) {
      out[sym] = computeSeries(prices[sym], prices[benchmark], { trendWindow, momentumWindow, zscore, smoothing });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, activeSymbols.join(','), benchmark, trendWindow, momentumWindow, zscore, smoothing]);

  const tailStart = Math.max(warm, end - tailLength + 1);
  const tailOf = (sym) => {
    const s = seriesByTicker[sym];
    return s ? s.slice(tailStart, end + 1) : [];
  };
  const historyOf = (sym) => {
    const s = seriesByTicker[sym];
    return s ? s.slice(warm, end + 1) : [];
  };

  const shownSymbols = activeSymbols.filter((s) => !hidden.has(s));
  const focus = hoverSym || pinned;

  // ---- sizing: render at the container's real width so text stays legible on phones
  const [W, setW] = useState(460);
  const roRef = useRef(null);
  const wrapRef = useCallback((node) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (node && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(([entry]) => setW(clamp(Math.floor(entry.contentRect.width), 260, 560)));
      ro.observe(node);
      roRef.current = ro;
    }
  }, []);
  const M = { left: 52, right: 10, top: 10, bottom: 38 };
  const H = W;
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;

  // ---- view: auto-fit around 100/100 unless the viewer has panned/zoomed.
  // While playing, fit the whole playback range so the frame holds still.
  const autoFit = useMemo(() => {
    let rx = zscore ? 1.2 : 2;
    let ry = zscore ? 1.2 : 2;
    const from = playing ? warm : tailStart;
    for (const sym of shownSymbols.length ? shownSymbols : activeSymbols) {
      const s = seriesByTicker[sym];
      if (!s) continue;
      for (let i = from; i <= end && i < s.length; i++) {
        rx = Math.max(rx, Math.abs(s[i].x - 100));
        ry = Math.max(ry, Math.abs(s[i].y - 100));
      }
    }
    return { cx: 100, cy: 100, rx: rx * 1.15, ry: ry * 1.15 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesByTicker, hidden, tailStart, end, zscore, playing, warm]);
  const [manualView, setManualView] = useState(null);
  useEffect(() => setManualView(null), [symbolsKey, benchmark, zscore]);
  const view = manualView || autoFit;

  const toPx = (x, y) => [
    M.left + ((x - (view.cx - view.rx)) / (2 * view.rx)) * PW,
    M.top + PH - ((y - (view.cy - view.ry)) / (2 * view.ry)) * PH,
  ];
  const [cx0, cy0] = toPx(100, 100);
  const cxc = clamp(cx0, M.left, M.left + PW);
  const cyc = clamp(cy0, M.top, M.top + PH);

  const zoomBy = (k) => setManualView((v) => {
    const b = v || autoFit;
    return { ...b, rx: clamp(b.rx * k, 0.05, 500), ry: clamp(b.ry * k, 0.05, 500) };
  });

  // Hit-testing: one nearest-point lookup for the whole plot instead of a
  // hit circle per dot. With 10+ tickers the per-dot circles overlapped, so
  // a tap near one head could land on its neighbour. Heads win close calls.
  const nearestPoint = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best = null;
    for (const sym of shownSymbols) {
      const tail = tailOf(sym);
      tail.forEach((pt, i) => {
        const [x, y] = toPx(pt.x, pt.y);
        const isHead = i === tail.length - 1;
        const d = Math.hypot(x - mx, y - my) - (isHead ? 4 : 0);
        if (!best || d < best.d) best = { sym, idx: tailStart + i, d, isHead };
      });
    }
    return best && best.d <= 20 ? best : null;
  };

  // Mouse drag pans. Touch is left to the browser so a swipe over the chart
  // still scrolls the page on a phone (zoom there is the +/- buttons).
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      if (Math.abs(dx) + Math.abs(dy) < 3) return;
      dragRef.current = { x: e.clientX, y: e.clientY, moved: true };
      setManualView((v) => {
        const b = v || autoFit;
        return { ...b, cx: b.cx - (dx * 2 * b.rx) / PW, cy: b.cy + (dy * 2 * b.ry) / PH };
      });
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const hit = nearestPoint(e);
    setHoverPt((prev) => {
      if (!hit) return null;
      return prev && prev.sym === hit.sym && prev.idx === hit.idx ? prev : { sym: hit.sym, idx: hit.idx };
    });
    setHoverSym(hit ? hit.sym : null);
  };
  const endDrag = () => {
    movedRef.current = !!dragRef.current?.moved;
    dragRef.current = null;
  };
  const onPlotClick = (e) => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    const hit = nearestPoint(e);
    if (!hit) {
      setHoverPt(null);
      return;
    }
    setHoverPt({ sym: hit.sym, idx: hit.idx });
    if (hit.isHead) togglePin(hit.sym);
  };
  // Pinch on a trackpad (ctrlKey wheel) or Ctrl/Cmd+scroll zooms; a plain
  // scroll wheel scrolls the page as normal. React's onWheel is passive, so
  // this needs a native listener to be able to preventDefault.
  const autoFitRef = useRef(autoFit);
  autoFitRef.current = autoFit;
  const wheelCleanupRef = useRef(null);
  const svgRef = useCallback((node) => {
    wheelCleanupRef.current?.();
    wheelCleanupRef.current = null;
    if (!node) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const k = e.deltaY > 0 ? 1.1 : 0.9;
      setManualView((v) => {
        const b = v || autoFitRef.current;
        return { ...b, rx: clamp(b.rx * k, 0.05, 500), ry: clamp(b.ry * k, 0.05, 500) };
      });
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    wheelCleanupRef.current = () => node.removeEventListener('wheel', onWheel);
  }, []);

  const toggleHidden = (sym) => setHidden((prev) => {
    const n = new Set(prev);
    if (n.has(sym)) n.delete(sym);
    else n.add(sym);
    return n;
  });
  const togglePin = (sym) => setPinned((p) => (p === sym ? null : sym));

  // ---- per-series summary at the scrubbed day
  const summary = useMemo(() => {
    const out = {};
    for (const sym of activeSymbols) {
      const hist = historyOf(sym);
      const tail = tailOf(sym);
      const last = tail[tail.length - 1];
      if (!last) continue;
      const q = quadrantOf(last.x, last.y);
      out[sym] = {
        last, q,
        streak: quadrantStreak(hist),
        head: heading(tail, 3),
        flips: countFlips(tail),
        tailLen: tail.length,
      };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesByTicker, end, tailLength, warm]);

  if (!prices || activeSymbols.length === 0) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Relative Rotation Graph</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for historical data…</p>
      </section>
    );
  }

  const notEnoughHistory = lastIdx < minEnd || lastIdx < warm;

  const byQuadrant = { leading: [], weakening: [], lagging: [], improving: [] };
  for (const sym of activeSymbols) if (summary[sym]) byQuadrant[summary[sym].q].push(sym);
  for (const q of Object.keys(byQuadrant)) byQuadrant[q].sort((a, b) => summary[b].last.x - summary[a].last.x);
  const recent = activeSymbols
    .filter((s) => summary[s]?.streak.from && summary[s].streak.days <= RECENT_DAYS)
    .sort((a, b) => summary[a].streak.days - summary[b].streak.days);

  // Draw order: dimmed series first, focused series last (on top).
  const drawOrder = [...shownSymbols].sort((a, b) => (a === focus) - (b === focus));
  const heads = shownSymbols
    .map((sym) => {
      const tail = tailOf(sym);
      if (!tail.length) return null;
      const [x, y] = toPx(tail[tail.length - 1].x, tail[tail.length - 1].y);
      return { sym, x, y, text: labelFor(sym) };
    })
    .filter(Boolean)
    .filter((h) => h.x >= M.left && h.x <= M.left + PW && h.y >= M.top && h.y <= M.top + PH);
  const labelPlacement = placeLabels(
    [...heads].sort((a, b) => (b.sym === focus) - (a.sym === focus)),
    { x0: M.left + 2, y0: M.top + 2, x1: M.left + PW - 2, y1: M.top + PH - 2 },
  );

  const xTicks = ticksFor(view.cx - view.rx, view.cx + view.rx);
  const yTicks = ticksFor(view.cy - view.ry, view.cy + view.ry);

  const hoverInfo = (() => {
    if (!hoverPt) return null;
    const s = seriesByTicker[hoverPt.sym];
    const p = s?.[hoverPt.idx];
    if (!p) return null;
    const [px, py] = toPx(p.x, p.y);
    return { ...hoverPt, p, px, py, q: quadrantOf(p.x, p.y) };
  })();

  const btn = (active) => ({
    background: active ? '#1E252A' : CARD_BG,
    border: `1px solid ${active ? ACCENT : CARD_BORDER}`,
    color: active ? ACCENT : TEXT_SECONDARY,
    borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
  });

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Relative Rotation Graph</h2>
          <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 0' }}>
            vs {benchmark} · as of {days[end]} · {smoothing > 1 ? `${smoothing}-day smoothing` : 'no smoothing'}
          </p>
        </div>
        <button onClick={() => setTableView((v) => !v)} style={btn(tableView)}>
          {tableView ? 'Chart' : 'Table'}
        </button>
      </div>

      {/* Answer first: who is where right now, laid out like the chart. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
        {QUADRANT_GRID.map((q) => (
          <div key={q} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '7px 10px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: QUADRANTS[q].color, flexShrink: 0 }} />
              <span style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>{QUADRANTS[q].name}</span>
              <span style={{ color: TEXT_MUTED }}>{byQuadrant[q].length}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: 4, fontSize: 11, lineHeight: 1.5 }}>
              {byQuadrant[q].length === 0 && <span style={{ color: TEXT_MUTED }}>—</span>}
              {byQuadrant[q].map((sym) => (
                <button
                  key={sym}
                  onClick={() => togglePin(sym)}
                  onPointerEnter={mouseOnly(() => setHoverSym(sym))}
                  onPointerLeave={mouseOnly(() => setHoverSym(null))}
                  title={`${sym}: RS-Ratio ${summary[sym].last.x.toFixed(2)}, RS-Momentum ${summary[sym].last.y.toFixed(2)} — click to focus`}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11,
                    color: pinned === sym ? ACCENT : TEXT_SECONDARY, fontFamily: 'ui-monospace,monospace',
                    textDecoration: hidden.has(sym) ? 'line-through' : 'none',
                  }}
                >
                  {labelFor(sym)}{summary[sym].head ? ` ${summary[sym].head.arrow}` : ''}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '8px 0 0', lineHeight: 1.6 }}>
        {recent.length === 0
          ? `No quadrant changes in the last ${RECENT_DAYS} days.`
          : (
            <>
              Recent changes:{' '}
              {recent.slice(0, RECENT_MAX).map((sym, i) => (
                <span key={sym}>
                  {i > 0 && ' · '}
                  <span style={{ color: TEXT_SECONDARY }}>{labelFor(sym)}</span>{' '}
                  {QUADRANTS[summary[sym].streak.from].name} → <span style={{ color: QUADRANTS[summary[sym].q].color }}>{QUADRANTS[summary[sym].q].name}</span>
                  {' '}({summary[sym].streak.days} day{summary[sym].streak.days === 1 ? '' : 's'})
                </span>
              ))}
              {recent.length > RECENT_MAX && ` · +${recent.length - RECENT_MAX} more`}
            </>
          )}
      </p>

      {notEnoughHistory ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>
          Not enough history for these settings — lower Trend, Momentum or Smoothing.
        </p>
      ) : tableView ? (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: TEXT_MUTED, fontSize: 11 }}>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Asset</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Quadrant</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Days there</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Heading</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>RS-Ratio</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>RS-Momentum</th>
              </tr>
            </thead>
            <tbody>
              {[...activeSymbols]
                .filter((s) => summary[s])
                .sort((a, b) => QUADRANT_SORT[summary[a].q] - QUADRANT_SORT[summary[b].q] || summary[b].last.x - summary[a].last.x)
                .map((sym) => {
                  const s = summary[sym];
                  return (
                    <tr key={sym} style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                      <td style={{ padding: '8px', color: TEXT_PRIMARY, fontWeight: 600 }}>{sym}</td>
                      <td style={{ padding: '8px', color: QUADRANTS[s.q].color }}>{QUADRANTS[s.q].name}</td>
                      <td style={{ padding: '8px', color: TEXT_SECONDARY, fontVariantNumeric: 'tabular-nums' }}>
                        {s.streak.days}{s.streak.from ? '' : '+'}
                      </td>
                      <td style={{ padding: '8px', color: TEXT_SECONDARY }}>{s.head?.arrow || '—'}</td>
                      <td style={{ padding: '8px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{s.last.x.toFixed(2)}</td>
                      <td style={{ padding: '8px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{s.last.y.toFixed(2)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8 }}>
            &quot;Days there&quot; with a + means it hasn&apos;t left that quadrant within the available history.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 14 }}>
          <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 12, flex: '1 1 480px', maxWidth: 584, minWidth: 0 }}>
            <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
              <svg
                ref={svgRef}
                width={W}
                height={H}
                viewBox={`0 0 ${W} ${H}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onClick={onPlotClick}
                onPointerLeave={() => {
                  endDrag();
                  setHoverPt(null);
                  setHoverSym(null);
                }}
                role="img"
                aria-label={`Relative rotation graph of ${activeSymbols.length} assets vs ${benchmark} as of ${days[end]}. Use the table view for exact values.`}
                style={{ display: 'block', cursor: 'grab', userSelect: 'none' }}
              >
                <defs>
                  <clipPath id="rrg-plot-clip">
                    <rect x={M.left} y={M.top} width={PW} height={PH} />
                  </clipPath>
                </defs>
                <rect x={M.left} y={M.top} width={PW} height={PH} fill={PLOT_BG} />

                <g clipPath="url(#rrg-plot-clip)">
                  {/* quadrant washes */}
                  <rect x={cxc} y={M.top} width={M.left + PW - cxc} height={cyc - M.top} fill={QUADRANTS.leading.color} opacity={0.07} />
                  <rect x={cxc} y={cyc} width={M.left + PW - cxc} height={M.top + PH - cyc} fill={QUADRANTS.weakening.color} opacity={0.07} />
                  <rect x={M.left} y={cyc} width={cxc - M.left} height={M.top + PH - cyc} fill={QUADRANTS.lagging.color} opacity={0.07} />
                  <rect x={M.left} y={M.top} width={cxc - M.left} height={cyc - M.top} fill={QUADRANTS.improving.color} opacity={0.07} />

                  {/* gridlines: solid hairlines */}
                  {xTicks.map((t) => {
                    const [x] = toPx(t.v, 100);
                    return <line key={`gx${t.label}`} x1={x} y1={M.top} x2={x} y2={M.top + PH} stroke={GRID} strokeWidth={1} />;
                  })}
                  {yTicks.map((t) => {
                    const [, y] = toPx(100, t.v);
                    return <line key={`gy${t.label}`} x1={M.left} y1={y} x2={M.left + PW} y2={y} stroke={GRID} strokeWidth={1} />;
                  })}
                  <line x1={M.left} y1={cy0} x2={M.left + PW} y2={cy0} stroke={AXIS_100} strokeWidth={1} />
                  <line x1={cx0} y1={M.top} x2={cx0} y2={M.top + PH} stroke={AXIS_100} strokeWidth={1} />

                  {/* series: faint old tail -> bold current head */}
                  {drawOrder.map((sym) => {
                    const { color, shape } = styleOf(sym);
                    const tail = tailOf(sym);
                    if (tail.length === 0) return null;
                    const dim = focus && focus !== sym;
                    const baseOpacity = dim ? 0.14 : 1;
                    const px = tail.map((p) => toPx(p.x, p.y));
                    const n = px.length;
                    const [lx, ly] = px[n - 1];
                    return (
                      <g key={sym} opacity={baseOpacity}>
                        {px.slice(1).map((p, i) => {
                          const t = n > 2 ? i / (n - 2) : 1;
                          return (
                            <line
                              key={i}
                              x1={px[i][0]} y1={px[i][1]} x2={p[0]} y2={p[1]}
                              stroke={color}
                              strokeWidth={1.4 + t * 1}
                              strokeLinecap="round"
                              opacity={0.3 + t * 0.6}
                            />
                          );
                        })}
                        {px.slice(0, -1).map((p, i) => {
                          const t = n > 1 ? i / (n - 1) : 1;
                          return (
                            <Marker key={i} shape={shape} x={p[0]} y={p[1]} r={2 + t * 1.2} color={color} ring={PLOT_BG} ringWidth={1} opacity={0.35 + t * 0.5} />
                          );
                        })}
                        <g
                          tabIndex={0}
                          role="button"
                          aria-label={`${sym}: ${QUADRANTS[quadrantOf(tail[n - 1].x, tail[n - 1].y)].name}, RS-Ratio ${tail[n - 1].x.toFixed(2)}, RS-Momentum ${tail[n - 1].y.toFixed(2)}. Press to focus.`}
                          onFocus={() => setHoverPt({ sym, idx: end })}
                          onBlur={() => setHoverPt(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              togglePin(sym);
                            }
                          }}
                          style={{ outline: 'none', cursor: 'pointer' }}
                        >
                          <Marker shape={shape} x={lx} y={ly} r={pinned === sym ? 6.5 : 5.5} color={color} ring={pinned === sym ? ACCENT : PLOT_BG} ringWidth={2} />
                        </g>
                      </g>
                    );
                  })}

                  {/* labels: text ink with a surface halo, placed to avoid collisions */}
                  {heads.map((h) => {
                    const pl = labelPlacement[h.sym];
                    if (!pl) return null;
                    const dim = focus && focus !== h.sym;
                    return (
                      <text
                        key={`lbl-${h.sym}`}
                        x={pl.tx}
                        y={pl.ty}
                        textAnchor={pl.anchor}
                        fill={TEXT_PRIMARY}
                        stroke={PLOT_BG}
                        strokeWidth={3}
                        paintOrder="stroke"
                        fontSize={11}
                        fontWeight={focus === h.sym ? 700 : 500}
                        fontFamily="ui-monospace,monospace"
                        opacity={dim ? 0.2 : 1}
                        pointerEvents="none"
                      >
                        {h.text}
                      </text>
                    );
                  })}
                </g>

                {/* quadrant names, pinned to the plot corners */}
                <text x={M.left + PW - 6} y={M.top + 14} textAnchor="end" fill={QUADRANTS.leading.color} fontSize={11} fontWeight={600}>Leading</text>
                <text x={M.left + PW - 6} y={M.top + PH - 6} textAnchor="end" fill={QUADRANTS.weakening.color} fontSize={11} fontWeight={600}>Weakening</text>
                <text x={M.left + 6} y={M.top + PH - 6} fill={QUADRANTS.lagging.color} fontSize={11} fontWeight={600}>Lagging</text>
                <text x={M.left + 6} y={M.top + 14} fill={QUADRANTS.improving.color} fontSize={11} fontWeight={600}>Improving</text>

                <rect x={M.left} y={M.top} width={PW} height={PH} fill="none" stroke={CARD_BORDER} />

                {/* axes */}
                {xTicks.map((t) => {
                  const [x] = toPx(t.v, 100);
                  return (
                    <text key={`tx${t.label}`} x={x} y={M.top + PH + 13} textAnchor="middle" fill={TEXT_MUTED} fontSize={10} fontFamily="ui-monospace,monospace">
                      {t.label}
                    </text>
                  );
                })}
                {yTicks.map((t) => {
                  const [, y] = toPx(100, t.v);
                  return (
                    <text key={`ty${t.label}`} x={M.left - 5} y={y + 3} textAnchor="end" fill={TEXT_MUTED} fontSize={10} fontFamily="ui-monospace,monospace">
                      {t.label}
                    </text>
                  );
                })}
                <text x={M.left + PW / 2} y={H - 6} textAnchor="middle" fill={TEXT_SECONDARY} fontSize={11}>
                  RS-Ratio (trend vs {benchmark}) →
                </text>
                <text
                  x={10}
                  y={M.top + PH / 2}
                  textAnchor="middle"
                  fill={TEXT_SECONDARY}
                  fontSize={11}
                  transform={`rotate(-90 10 ${M.top + PH / 2})`}
                >
                  RS-Momentum →
                </text>
              </svg>

              {hoverInfo && (
                <div
                  style={{
                    position: 'absolute',
                    left: clamp(hoverInfo.px + 12, 0, W - 176),
                    top: clamp(hoverInfo.py - 58, 0, H - 64),
                    width: 170,
                    background: '#0E1316',
                    border: `1px solid ${CARD_BORDER}`,
                    borderRadius: 4,
                    padding: '6px 8px',
                    pointerEvents: 'none',
                    fontSize: 11,
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 2, background: styleOf(hoverInfo.sym).color, flexShrink: 0 }} />
                    <span style={{ color: TEXT_PRIMARY, fontWeight: 600, fontFamily: 'ui-monospace,monospace' }}>
                      {hoverInfo.p.x.toFixed(2)} / {hoverInfo.p.y.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ color: TEXT_SECONDARY }}>
                    {labelFor(hoverInfo.sym)} · {days[hoverInfo.idx]}
                  </div>
                  <div style={{ color: QUADRANTS[hoverInfo.q].color }}>{QUADRANTS[hoverInfo.q].name}</div>
                </div>
              )}

            </div>

            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${CARD_BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={togglePlay} style={{ ...zoomBtnStyle, width: 28 }} aria-label={playing ? 'Pause' : 'Play rotation over time'} title={playing ? 'Pause' : 'Play the rotation day by day'}>
                  {playing ? '❚❚' : '▶'}
                </button>
                <input
                  type="range"
                  min={minEnd}
                  max={Math.max(minEnd, lastIdx)}
                  value={end}
                  onChange={(e) => {
                    setPlaying(false);
                    setEndIdx(parseInt(e.target.value, 10));
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                  aria-label="Day"
                />
                <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', color: TEXT_PRIMARY, whiteSpace: 'nowrap' }}>{days[end]}</span>
                {end !== lastIdx && (
                  <button onClick={() => { setPlaying(false); setEndIdx(lastIdx); }} style={linkBtnStyle}>now</button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginTop: 12 }}>
                <SliderControl label="Tail" unit="d" value={tailLength} min={3} max={Math.max(4, Math.min(30, lastIdx - warm + 1))} onChange={(v) => setSetting('tailLength', v)} />
                <SliderControl label="Trend" unit="d" value={trendWindow} min={5} max={40} onChange={(v) => setSetting('trendWindow', v)} />
                <SliderControl label="Momentum" unit="d" value={momentumWindow} min={2} max={15} onChange={(v) => setSetting('momentumWindow', v)} />
                <SliderControl label="Smoothing" unit="d" value={smoothing} min={1} max={7} onChange={(v) => setSetting('smoothing', v)} format={(v) => (v <= 1 ? 'off' : `${v}d`)} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: TEXT_SECONDARY, cursor: 'pointer' }}>
                  <input type="checkbox" checked={zscore} onChange={(e) => setSetting('zscore', e.target.checked)} />
                  Volatility-normalized (JdK-style)
                </label>
                <button onClick={() => setSettings(DEFAULT_SETTINGS)} style={linkBtnStyle}>Reset settings</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                  <span style={{ fontSize: 12, color: TEXT_SECONDARY, marginRight: 2 }}>Zoom</span>
                  <button onClick={() => zoomBy(1.25)} style={zoomBtnStyle} aria-label="Zoom out">−</button>
                  <button onClick={() => zoomBy(0.8)} style={zoomBtnStyle} aria-label="Zoom in">+</button>
                  <button onClick={() => setManualView(null)} style={{ ...zoomBtnStyle, width: 'auto', padding: '0 7px', fontSize: 11, color: manualView ? ACCENT : TEXT_MUTED }} title="Fit to data" aria-label="Fit to data">Fit</button>
                </div>
              </div>
              <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '10px 0 0', lineHeight: 1.55 }}>
                Hover or tap a ticker to focus it · drag to pan · pinch or Ctrl/⌘+scroll to zoom
              </p>
            </div>
          </div>

          <div style={{ minWidth: 220, flex: '1 1 220px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: TEXT_MUTED }}>Click to hide · 🔍 to focus</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setHidden(new Set())} style={linkBtnStyle}>All</button>
                <button onClick={() => setHidden(new Set(activeSymbols))} style={linkBtnStyle}>None</button>
              </div>
            </div>
            {activeSymbols.map((sym) => {
              const s = summary[sym];
              if (!s) return null;
              const { color, shape } = styleOf(sym);
              const noisy = s.flips >= Math.max(3, Math.floor(s.tailLen / 3));
              const on = !hidden.has(sym);
              return (
                <div
                  key={sym}
                  onClick={() => toggleHidden(sym)}
                  onPointerEnter={mouseOnly(() => on && setHoverSym(sym))}
                  onPointerLeave={mouseOnly(() => setHoverSym(null))}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    padding: '6px 4px', borderBottom: `1px solid ${CARD_BORDER}`, fontSize: 13,
                    cursor: 'pointer', opacity: on ? 1 : 0.36, userSelect: 'none',
                    background: focus === sym ? '#1B2226' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Swatch shape={shape} color={color} />
                    <span title={sym} style={{ color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelFor(sym)}</span>
                    <span style={{ color: TEXT_SECONDARY, fontSize: 12 }} title="Direction of travel over the last 3 days">{s.head?.arrow || ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(sym);
                      }}
                      title="Focus this ticker and show its day-by-day detail"
                      aria-label={`Focus ${sym}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0, opacity: pinned === sym ? 1 : 0.45 }}
                    >
                      🔍
                    </button>
                    <span
                      style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: noisy ? ACCENT : TEXT_MUTED }}
                      title={`${s.flips} quadrant change(s) across the ${s.tailLen}-day tail${noisy ? ' — noisy, treat with caution' : ''}`}
                    >
                      {s.flips}⤢
                    </span>
                    <div style={{ textAlign: 'right', minWidth: 76 }}>
                      <div style={{ color: QUADRANTS[s.q].color, fontSize: 12 }}>{QUADRANTS[s.q].name}</div>
                      <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: TEXT_SECONDARY }}>
                        {s.last.x.toFixed(2)} / {s.last.y.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <p style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.55, marginTop: 10 }}>
              Arrows show direction of travel over the last 3 days. ⤢ counts quadrant changes across
              the tail — a high count means noise, not signal.
            </p>
          </div>
        </div>
      )}

      {pinned && !tableView && summary[pinned] && (() => {
        const sym = pinned;
        const { color } = styleOf(sym);
        const tail = tailOf(sym);
        if (tail.length === 0) return null;
        return (
          <div style={{ marginTop: 16, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 15, color: TEXT_PRIMARY, fontWeight: 600 }}>{sym}</span>
                <span style={{ fontSize: 12, color: QUADRANTS[summary[sym].q].color }}>
                  {QUADRANTS[summary[sym].q].name} · {summary[sym].streak.days}{summary[sym].streak.from ? '' : '+'} day{summary[sym].streak.days === 1 ? '' : 's'}
                </span>
              </div>
              <button onClick={() => setPinned(null)} style={{ ...btn(false), padding: '3px 9px' }}>Close</button>
            </div>
            <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8, lineHeight: 1.5 }}>
              {sym} vs {benchmark}, last {tail.length} days. RS-Ratio/Momentum use the {trendWindow}/{momentumWindow}-day
              windows{smoothing > 1 ? ` on a ${smoothing}-day smoothed ratio` : ''}. Prices are the raw daily closes.
            </p>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
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
                    const idx = tailStart + i;
                    const q = quadrantOf(pt.x, pt.y);
                    const prevQ = i > 0 ? quadrantOf(tail[i - 1].x, tail[i - 1].y) : null;
                    const flipped = prevQ !== null && prevQ !== q;
                    return (
                      <tr key={days[idx]} style={{ borderTop: '1px solid #1D2226' }}>
                        <td style={{ padding: '4px 8px 4px 0', color: TEXT_SECONDARY, fontFamily: 'ui-monospace,monospace' }}>{days[idx]}</td>
                        <td style={{ padding: '4px 8px', color: TEXT_PRIMARY, fontFamily: 'ui-monospace,monospace' }}>{assetFormat(prices[sym][idx])}</td>
                        <td style={{ padding: '4px 8px', color: TEXT_PRIMARY, fontFamily: 'ui-monospace,monospace' }}>
                          ${prices[benchmark][idx]?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '4px 8px', color: TEXT_PRIMARY, fontFamily: 'ui-monospace,monospace' }}>{pt.x.toFixed(2)}</td>
                        <td style={{ padding: '4px 8px', color: TEXT_PRIMARY, fontFamily: 'ui-monospace,monospace' }}>{pt.y.toFixed(2)}</td>
                        <td style={{ padding: '4px 0', color: QUADRANTS[q].color }}>
                          {QUADRANTS[q].name}
                          {flipped && <span style={{ color: ACCENT }}> ← flip</span>}
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
        How to read it: right of center = outperforming {benchmark} on trend, above center = that trend is
        gaining. Assets usually rotate clockwise — Improving → Leading → Weakening → Lagging. Tails run from
        faint (oldest) to the bold dot (the selected day). RS-Ratio and RS-Momentum are a standard open
        approximation of the JdK RRG method, not the exact proprietary formula; the first {warm} days of
        history are warm-up for the rolling windows and aren&apos;t plotted.
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

function SliderControl({ label, unit, value, min, max, onChange, format }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{label}</span>
      <input type="range" min={min} max={max} value={clamp(value, min, max)} onChange={(e) => onChange(parseInt(e.target.value, 10))} style={{ width: 84 }} />
      <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', color: TEXT_PRIMARY, minWidth: 26 }}>
        {format ? format(value) : `${value}${unit}`}
      </span>
    </label>
  );
}
