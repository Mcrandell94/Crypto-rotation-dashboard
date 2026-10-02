'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  computeSeries, firstValidIndex, quadrantOf, countFlips, quadrantStreak, heading, presetsFor, defaultSettingsFor,
} from '../lib/rrgMath';
import { relativeVolume, absoluteTrend, fundingFlag, FUNDING_HOT } from '../lib/rrgOverlays';
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, CARD_BG, CARD_BORDER, PLOT_BG, GRID, AXIS_100, ACCENT, QUADRANTS,
  clamp, ticksFor, Marker, placeLabels,
} from './rrgShared';
import RrgPlot3D from './RrgPlot3D';

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

// Default = the Balanced preset for the bar size (see RRG_PRESETS_BY_INTERVAL in app/lib/rrgMath.js for
// how the three presets were tuned).
// Settings are kept per bar size ({ '1d': {...}, '4h': {...}, '1w': {...} }),
// so tuning 4H doesn't change daily. v2 was a single daily object.
const SETTINGS_KEY = 'rrgSettings.v3';
const LEGACY_SETTINGS_KEY = 'rrgSettings.v2';
const OVERLAYS_KEY = 'rrgOverlays.v1';
// 3D view (time as depth) is a beta: set to false to hide its toggle; the
// code stays in place. The viewer's on/off choice is remembered per browser.
const RRG_3D_BETA = true;
const VIEW_3D_KEY = 'rrgView3d.v1';
const TREND_WINDOW = 20; // absolute-trend overlay: price vs its own 20-bar average

// Wording for the bar size the data came in (/api/rrg's `interval`). All
// windows (trend, momentum, smoothing, tail) are counted in bars, so the
// same settings read as days on 1D, weeks on 1W and 4-hour bars on 4H.
const BAR_UNITS = {
  '1d': { short: 'd', one: 'day', many: 'days', adj: 'day', Many: 'Days', bars: 'daily bars', closes: 'daily closes', fmt: (l) => l, asOf: (l) => `as of ${l}` },
  '4h': { short: ' bars', one: '4-hour bar', many: '4-hour bars', adj: 'bar', Many: 'Bars', bars: '4-hour bars', closes: '4-hour closes (UTC)', fmt: (l) => (l ? `${l} UTC` : l), asOf: (l) => `as of ${l} UTC` },
  '1w': { short: 'w', one: 'week', many: 'weeks', adj: 'week', Many: 'Weeks', bars: 'weekly bars', closes: 'weekly closes (weeks start Monday, UTC)', fmt: (l) => (l ? `week of ${l}` : l), asOf: (l) => `week of ${l}` },
};
const presetMatching = (st, presets) => presets.find((p) => Object.entries(p.settings).every(([k, v]) => st[k] === v));
const RECENT_DAYS = 3; // "recent quadrant change" window for the summary
const RECENT_MAX = 6; // how many recent changes to list before "+N more"

// Hover handlers that only fire for a real mouse. On touch, a tap would
// otherwise leave a hover "stuck" on; taps go through onClick instead.
const mouseOnly = (fn) => (e) => {
  if (e.pointerType === 'mouse') fn(e);
};

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

const defaultAssetFormat = (v) => `$${v?.toLocaleString(undefined, { maximumFractionDigits: v < 1 ? 4 : 2 })}`;

export default function RelativeRotationGraph({
  data, symbols, benchmark, assetLabel = 'price', assetFormat = defaultAssetFormat, labelFor = (s) => s,
  funding = null, // { [sym]: { fundingRateAnnualized } } from /api/funding (tickers view only)
}) {
  const [tableView, setTableView] = useState(false);
  // Bar size of the data on screen; settings and presets are per bar size.
  const interval = BAR_UNITS[data?.interval] ? data.interval : '1d';
  const presets = presetsFor(interval);
  const [settingsBy, setSettingsBy] = useState({});
  const settings = { ...defaultSettingsFor(interval), ...settingsBy[interval] };
  const setSettings = (next) => setSettingsBy((all) => {
    const current = { ...defaultSettingsFor(interval), ...all[interval] };
    return { ...all, [interval]: typeof next === 'function' ? next(current) : next };
  });
  const { zscore, tailLength, trendWindow, momentumWindow, smoothing } = settings;
  const setSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  // Remember this viewer's chart settings between visits (browser-only
  // convenience; the chart works the same without it). Settings saved before
  // timeframes existed (v2) become the daily settings.
  const settingsLoaded = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || 'null');
      const legacy = JSON.parse(window.localStorage.getItem(LEGACY_SETTINGS_KEY) || 'null');
      if (saved && typeof saved === 'object') setSettingsBy(saved);
      else if (legacy && typeof legacy === 'object') setSettingsBy({ '1d': legacy });
    } catch {}
    settingsLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!settingsLoaded.current) return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsBy));
    } catch {}
  }, [settingsBy]);

  // Optional overlays (all off by default, remembered per browser). None
  // move a ticker's position — see app/lib/rrgOverlays.js.
  const [overlays, setOverlays] = useState({ volume: false, trend: false, funding: false, capWeighted: false });
  const setOverlay = (key, value) => setOverlays((o) => ({ ...o, [key]: value }));
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(OVERLAYS_KEY) || 'null');
      if (saved && typeof saved === 'object') setOverlays((o) => ({ ...o, ...saved }));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(OVERLAYS_KEY, JSON.stringify(overlays));
    } catch {}
  }, [overlays]);

  const [view3dPref, setView3dPref] = useState(false);
  useEffect(() => {
    try {
      setView3dPref(window.localStorage.getItem(VIEW_3D_KEY) === '1');
    } catch {}
  }, []);
  const setView3d = (on) => {
    setView3dPref(on);
    try {
      window.localStorage.setItem(VIEW_3D_KEY, on ? '1' : '0');
    } catch {}
  };
  const view3d = RRG_3D_BETA && view3dPref;

  const [hidden, setHidden] = useState(new Set());
  const [pinned, setPinned] = useState(null);
  const [hoverSym, setHoverSym] = useState(null); // legend/series hover -> focus
  const [hoverPt, setHoverPt] = useState(null); // { sym, idx } -> tooltip

  const days = data?.days || [];
  const capAvailable = !!data?.pricesCapWeighted;
  const prices = overlays.capWeighted && capAvailable ? data.pricesCapWeighted : data?.prices;
  const volumes = data?.volumes;
  const unit = BAR_UNITS[interval];
  const plural = (n) => (n === 1 ? unit.one : unit.many);
  // 4-hour bars carry no volume (see app/lib/coingecko-history.js).
  const volAvailable = !!volumes && Object.values(volumes).some((arr) => arr?.some((v) => v != null));
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
  }, [lastIdx, symbolsKey, benchmark, interval]);
  const end = clamp(endIdx, minEnd, Math.max(minEnd, lastIdx));

  // Play: step the scrubber forward a bar at a time to watch the rotation.
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

  // ---- view: auto-fit to where the data is, unless the viewer has
  // panned/zoomed. The 100/100 cross is always kept in frame, but the view
  // is no longer centred on it: when every ticker sits in one quadrant the
  // plot zooms onto that quadrant instead of leaving three near-empty.
  // While playing, fit the whole playback range so the frame holds still.
  const autoFit = useMemo(() => {
    let x0 = 100; let x1 = 100; let y0 = 100; let y1 = 100;
    const from = playing ? warm : tailStart;
    for (const sym of shownSymbols.length ? shownSymbols : activeSymbols) {
      const s = seriesByTicker[sym];
      if (!s) continue;
      for (let i = from; i <= end && i < s.length; i++) {
        x0 = Math.min(x0, s[i].x); x1 = Math.max(x1, s[i].x);
        y0 = Math.min(y0, s[i].y); y1 = Math.max(y1, s[i].y);
      }
    }
    // Half-spans: 10% padding each side, with a floor so a quiet market
    // isn't blown up into noise.
    const minHalf = zscore ? 1 : 1.5;
    const rx = Math.max(((x1 - x0) / 2) * 1.2, minHalf);
    const ry = Math.max(((y1 - y0) / 2) * 1.2, minHalf);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx, ry };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesByTicker, hidden, tailStart, end, zscore, playing, warm]);
  const [manualView, setManualView] = useState(null);
  useEffect(() => setManualView(null), [symbolsKey, benchmark, zscore, overlays.capWeighted, interval]);
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
        relVol: relativeVolume(volumes?.[sym], end),
        trend: absoluteTrend(prices?.[sym], end, TREND_WINDOW),
        // Funding is a live reading, so it's only shown on the latest day.
        fundingPct: end === lastIdx ? funding?.[sym]?.fundingRateAnnualized : undefined,
      };
      out[sym].fundingFlag = fundingFlag(out[sym].fundingPct);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesByTicker, end, tailLength, warm, volumes, funding, lastIdx]);

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

  const volumeOn = overlays.volume && volAvailable;
  const trendOn = overlays.trend;
  const fundingOn = overlays.funding && !!funding;
  const headRadius = (sym) => {
    const base = pinned === sym ? 6.5 : 5.5;
    const rv = summary[sym]?.relVol;
    return volumeOn && rv ? clamp(base * Math.sqrt(rv), 3.5, 11) : base;
  };

  // Draw order: dimmed series first, focused series last (on top).
  const drawOrder = [...shownSymbols].sort((a, b) => (a === focus) - (b === focus));
  const heads = shownSymbols
    .map((sym) => {
      const tail = tailOf(sym);
      if (!tail.length) return null;
      const [x, y] = toPx(tail[tail.length - 1].x, tail[tail.length - 1].y);
      return { sym, x, y, text: labelFor(sym), r: headRadius(sym) };
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

  const tooltipBody = (sym, idx) => {
    const p = seriesByTicker[sym]?.[idx];
    if (!p) return null;
    const q = quadrantOf(p.x, p.y);
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 2, background: styleOf(sym).color, flexShrink: 0 }} />
          <span style={{ color: TEXT_PRIMARY, fontWeight: 600, fontFamily: 'ui-monospace,monospace' }}>
            {p.x.toFixed(2)} / {p.y.toFixed(2)}
          </span>
        </div>
        <div style={{ color: TEXT_SECONDARY }}>
          {labelFor(sym)} · {unit.fmt(days[idx])}
        </div>
        <div style={{ color: QUADRANTS[q].color }}>{QUADRANTS[q].name}</div>
        {idx === end && overlayNotes(summary[sym], unit).map((n) => (
          <div key={n} style={{ color: TEXT_SECONDARY }}>{n}</div>
        ))}
      </>
    );
  };

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
            vs {benchmark} · {unit.bars} · {unit.asOf(days[end])} · {smoothing > 1 ? `${smoothing}-${unit.adj} smoothing` : 'no smoothing'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {RRG_3D_BETA && !tableView && (
            <button
              onClick={() => setView3d(!view3d)}
              style={btn(view3d)}
              aria-pressed={view3d}
              title="Beta: the same chart with time as a third axis, so each tail runs back in time instead of over itself"
            >
              3D <span style={{ fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.8 }}>beta</span>
            </button>
          )}
          <button onClick={() => setTableView((v) => !v)} style={btn(tableView)}>
            {tableView ? 'Chart' : 'Table'}
          </button>
        </div>
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
          ? `No quadrant changes in the last ${RECENT_DAYS} ${unit.many}.`
          : (
            <>
              Recent changes:{' '}
              {recent.slice(0, RECENT_MAX).map((sym, i) => (
                <span key={sym}>
                  {i > 0 && ' · '}
                  <span style={{ color: TEXT_SECONDARY }}>{labelFor(sym)}</span>{' '}
                  {QUADRANTS[summary[sym].streak.from].name} → <span style={{ color: QUADRANTS[summary[sym].q].color }}>{QUADRANTS[summary[sym].q].name}</span>
                  {' '}({summary[sym].streak.days} {plural(summary[sym].streak.days)})
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
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>{unit.Many} there</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Heading</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>RS-Ratio</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>RS-Momentum</th>
                {volumeOn && <th style={{ padding: '6px 8px', fontWeight: 500 }}>Rel. volume</th>}
                {trendOn && <th style={{ padding: '6px 8px', fontWeight: 500 }}>vs {TREND_WINDOW}d avg</th>}
                {fundingOn && <th style={{ padding: '6px 8px', fontWeight: 500 }}>Funding %/yr</th>}
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
                      {volumeOn && <td style={{ padding: '8px', color: TEXT_SECONDARY, fontVariantNumeric: 'tabular-nums' }}>{s.relVol != null ? `${s.relVol.toFixed(2)}×` : '—'}</td>}
                      {trendOn && <td style={{ padding: '8px', color: TEXT_SECONDARY, fontVariantNumeric: 'tabular-nums' }}>{s.trend ? `${s.trend.pct >= 0 ? '+' : ''}${s.trend.pct.toFixed(1)}%` : '—'}</td>}
                      {fundingOn && <td style={{ padding: '8px', color: TEXT_SECONDARY, fontVariantNumeric: 'tabular-nums' }}>{Number.isFinite(s.fundingPct) ? `${s.fundingPct.toFixed(1)}%` : '—'}</td>}
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8 }}>
            &quot;{unit.Many} there&quot; with a + means it hasn&apos;t left that quadrant within the available history.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 14 }}>
          <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 12, flex: '1 1 480px', maxWidth: 584, minWidth: 0 }}>
            {view3d ? (
              <div ref={wrapRef} style={{ width: '100%' }}>
                <RrgPlot3D
                  W={W}
                  series={shownSymbols.map((sym) => ({
                    sym,
                    ...styleOf(sym),
                    label: labelFor(sym),
                    points: tailOf(sym).map((p, i) => ({ x: p.x, y: p.y, idx: tailStart + i })),
                    dim: !!(focus && focus !== sym),
                    headR: headRadius(sym),
                    hollow: trendOn && summary[sym]?.trend?.above === false,
                    pinned: pinned === sym,
                    flag: fundingOn ? summary[sym]?.fundingFlag : null,
                  }))}
                  ranges={{ x0: view.cx - view.rx, x1: view.cx + view.rx, y0: view.cy - view.ry, y1: view.cy + view.ry }}
                  iOld={tailStart}
                  iNew={end}
                  days={days}
                  unit={unit}
                  focus={focus}
                  onHoverSym={setHoverSym}
                  onPin={togglePin}
                  tooltip={tooltipBody}
                  ariaLabel={`3D relative rotation graph of ${activeSymbols.length} assets vs ${benchmark} on ${unit.bars}, with time as depth, ${unit.asOf(days[end])}. Use the table view for exact values.`}
                />
              </div>
            ) : (
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
                aria-label={`Relative rotation graph of ${activeSymbols.length} assets vs ${benchmark} on ${unit.bars}, ${unit.asOf(days[end])}. Use the table view for exact values.`}
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
                          <Marker
                            shape={shape}
                            x={lx}
                            y={ly}
                            r={headRadius(sym)}
                            color={color}
                            ring={pinned === sym ? ACCENT : PLOT_BG}
                            ringWidth={2}
                            hollow={trendOn && summary[sym]?.trend?.above === false}
                          />
                          {fundingOn && summary[sym]?.fundingFlag === 'crowded-long' && (() => {
                            const r = headRadius(sym);
                            const fx = lx + r + 1;
                            const fy = ly - r - 1;
                            return <path d={`M ${fx} ${fy - 6} L ${fx + 4} ${fy + 1} L ${fx - 4} ${fy + 1} Z`} fill={ACCENT} stroke={PLOT_BG} strokeWidth={1} />;
                          })()}
                          {fundingOn && summary[sym]?.fundingFlag === 'shorts-paying' && (() => {
                            const r = headRadius(sym);
                            const fx = lx + r + 1;
                            const fy = ly - r - 1;
                            return <path d={`M ${fx} ${fy + 1} L ${fx + 4} ${fy - 6} L ${fx - 4} ${fy - 6} Z`} fill="#5E8FA8" stroke={PLOT_BG} strokeWidth={1} />;
                          })()}
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
                      <g key={`lbl-${h.sym}`} opacity={dim ? 0.2 : 1} pointerEvents="none">
                        {pl.leader && (
                          <line x1={pl.leader.x1} y1={pl.leader.y1} x2={pl.leader.x2} y2={pl.leader.y2} stroke={TEXT_MUTED} strokeWidth={1} />
                        )}
                        <text
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
                        >
                          {h.text}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* quadrant names, in the outer corner of each quadrant's
                    visible area; hidden when that area is too small to hold one */}
                {[
                  { q: 'leading', x: M.left + PW - 6, y: M.top + 14, anchor: 'end', w: M.left + PW - cxc, h: cyc - M.top },
                  { q: 'weakening', x: M.left + PW - 6, y: M.top + PH - 6, anchor: 'end', w: M.left + PW - cxc, h: M.top + PH - cyc },
                  { q: 'lagging', x: M.left + 6, y: M.top + PH - 6, anchor: 'start', w: cxc - M.left, h: M.top + PH - cyc },
                  { q: 'improving', x: M.left + 6, y: M.top + 14, anchor: 'start', w: cxc - M.left, h: cyc - M.top },
                ].filter((c) => c.w >= QUADRANTS[c.q].name.length * 6.5 + 12 && c.h >= 20).map((c) => (
                  <text key={c.q} x={c.x} y={c.y} textAnchor={c.anchor} fill={QUADRANTS[c.q].color} fontSize={11} fontWeight={600}>{QUADRANTS[c.q].name}</text>
                ))}

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
                  {tooltipBody(hoverInfo.sym, hoverInfo.idx)}
                </div>
              )}

            </div>
            )}

            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${CARD_BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={togglePlay} style={{ ...zoomBtnStyle, width: 28 }} aria-label={playing ? 'Pause' : 'Play rotation over time'} title={playing ? 'Pause' : `Play the rotation ${unit.adj} by ${unit.adj}`}>
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
                  aria-label={unit.one}
                />
                <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', color: TEXT_PRIMARY, whiteSpace: 'nowrap' }}>{unit.fmt(days[end])}</span>
                {end !== lastIdx && (
                  <button onClick={() => { setPlaying(false); setEndIdx(lastIdx); }} style={linkBtnStyle}>now</button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, marginRight: 2 }}>Read</span>
                {presets.map((pr) => (
                  <button
                    key={pr.key}
                    onClick={() => setSettings((st) => ({ ...st, ...pr.settings }))}
                    title={`${pr.blurb} — Trend ${pr.settings.trendWindow}${unit.short}, Momentum ${pr.settings.momentumWindow}${unit.short}, Smoothing ${pr.settings.smoothing}${unit.short}, Tail ${pr.settings.tailLength}${unit.short}`}
                    style={btn(presetMatching(settings, presets)?.key === pr.key)}
                  >
                    {pr.label}
                  </button>
                ))}
                {!presetMatching(settings, presets) && <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 4 }}>Custom</span>}
              </div>
              <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '6px 0 0', lineHeight: 1.5 }}>
                {presetMatching(settings, presets)
                  ? presetMatching(settings, presets).note
                  : 'Custom settings — pick a preset to reset the sliders.'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginTop: 10 }}>
                <SliderControl label="Tail" unit={unit.short} value={tailLength} min={3} max={Math.max(4, Math.min(30, lastIdx - warm + 1))} onChange={(v) => setSetting('tailLength', v)} />
                <SliderControl label="Trend" unit={unit.short} value={trendWindow} min={5} max={40} onChange={(v) => setSetting('trendWindow', v)} />
                <SliderControl label="Momentum" unit={unit.short} value={momentumWindow} min={2} max={15} onChange={(v) => setSetting('momentumWindow', v)} />
                <SliderControl label="Smoothing" unit={unit.short} value={smoothing} min={1} max={7} onChange={(v) => setSetting('smoothing', v)} format={(v) => (v <= 1 ? 'off' : `${v}${unit.short}`)} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: TEXT_SECONDARY, cursor: 'pointer' }}>
                  <input type="checkbox" checked={zscore} onChange={(e) => setSetting('zscore', e.target.checked)} />
                  Volatility-normalized (JdK-style)
                </label>
                <button onClick={() => setSettings(defaultSettingsFor(interval))} style={linkBtnStyle}>Reset settings</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                  <span style={{ fontSize: 12, color: TEXT_SECONDARY, marginRight: 2 }}>Zoom</span>
                  <button onClick={() => zoomBy(1.25)} style={zoomBtnStyle} aria-label="Zoom out">−</button>
                  <button onClick={() => zoomBy(0.8)} style={zoomBtnStyle} aria-label="Zoom in">+</button>
                  <button onClick={() => setManualView(null)} style={{ ...zoomBtnStyle, width: 'auto', padding: '0 7px', fontSize: 11, color: manualView ? ACCENT : TEXT_MUTED }} title="Fit to data" aria-label="Fit to data">Fit</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${CARD_BORDER}` }}>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>Overlays</span>
                <OverlayToggle
                  label="Volume"
                  checked={overlays.volume}
                  disabled={!volAvailable}
                  onChange={(v) => setOverlay('volume', v)}
                  title={volAvailable ? `Head dot size = last 7 ${unit.many}' volume vs its 30-${unit.adj} average` : 'Not available on 4-hour bars: CoinGecko only gives a rolling 24-hour volume'}
                />
                <OverlayToggle
                  label="Trend filter"
                  checked={overlays.trend}
                  onChange={(v) => setOverlay('trend', v)}
                  title={`Hollow head dot = below its own ${TREND_WINDOW}-${unit.adj} average (falling in absolute terms)`}
                />
                {funding && (
                  <OverlayToggle
                    label="Funding"
                    checked={overlays.funding}
                    onChange={(v) => setOverlay('funding', v)}
                    title={`Flag heads with extreme Hyperliquid perp funding: ▲ ≥ ${FUNDING_HOT}%/yr (crowded longs), ▼ negative`}
                  />
                )}
                {capAvailable && (
                  <OverlayToggle
                    label="Cap-weighted sectors"
                    checked={overlays.capWeighted}
                    onChange={(v) => setOverlay('capWeighted', v)}
                    title="Weight each sector's members by market cap instead of equally"
                  />
                )}
              </div>
              {(volumeOn || trendOn || fundingOn || (overlays.capWeighted && capAvailable)) && (
                <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '6px 0 0', lineHeight: 1.55 }}>
                  {[
                    volumeOn && `Bigger head = above-normal volume (7 vs 30 ${unit.many}; CoinGecko volume includes some exchanges with inflated volume, so compare a coin with its own history).`,
                    trendOn && `Hollow head = below its own ${TREND_WINDOW}-${unit.adj} average — leading ${benchmark} but still falling.`,
                    fundingOn && `▲ funding ≥ ${FUNDING_HOT}%/yr (crowded longs) · ▼ negative funding (shorts paying) — live Hyperliquid reading, shown on the latest ${unit.adj} only.`,
                    overlays.capWeighted && capAvailable && `Sectors weighted by each member’s market cap on the first ${unit.adj}, instead of equally.`,
                  ].filter(Boolean).join(' ')}
                </p>
              )}
              <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '10px 0 0', lineHeight: 1.55 }}>
                {view3d
                  ? 'Hover or tap a ticker to focus it · drag to rotate · zoom with the − / + buttons'
                  : 'Hover or tap a ticker to focus it · drag to pan · pinch or Ctrl/⌘+scroll to zoom'}
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
                    <span style={{ color: TEXT_SECONDARY, fontSize: 12 }} title={`Direction of travel over the last 3 ${unit.many}`}>{s.head?.arrow || ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(sym);
                      }}
                      title={`Focus this ticker and show its ${unit.adj}-by-${unit.adj} detail`}
                      aria-label={`Focus ${sym}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0, opacity: pinned === sym ? 1 : 0.45 }}
                    >
                      🔍
                    </button>
                    <span
                      style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: noisy ? ACCENT : TEXT_MUTED }}
                      title={`${s.flips} quadrant change(s) across the ${s.tailLen}-${unit.adj} tail${noisy ? ' — noisy, treat with caution' : ''}`}
                    >
                      {s.flips}⤢
                    </span>
                    <div style={{ textAlign: 'right', minWidth: 76 }}>
                      <div style={{ color: QUADRANTS[s.q].color, fontSize: 12 }}>{QUADRANTS[s.q].name}</div>
                      <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: TEXT_SECONDARY }}>
                        {s.last.x.toFixed(2)} / {s.last.y.toFixed(2)}
                      </div>
                      {(volumeOn || trendOn || fundingOn) && (
                        <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10, color: TEXT_MUTED }}>
                          {[
                            volumeOn && s.relVol != null && `vol ${s.relVol.toFixed(1)}×`,
                            trendOn && s.trend && `${s.trend.above ? '▲' : '▽'}${TREND_WINDOW}${unit.short}`,
                            fundingOn && Number.isFinite(s.fundingPct) && `f ${s.fundingPct >= 0 ? '+' : ''}${s.fundingPct.toFixed(0)}%`,
                          ].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <p style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.55, marginTop: 10 }}>
              Arrows show direction of travel over the last 3 {unit.many}. ⤢ counts quadrant changes across
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
                  {QUADRANTS[summary[sym].q].name} · {summary[sym].streak.days}{summary[sym].streak.from ? '' : '+'} {plural(summary[sym].streak.days)}
                </span>
              </div>
              <button onClick={() => setPinned(null)} style={{ ...btn(false), padding: '3px 9px' }}>Close</button>
            </div>
            <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8, lineHeight: 1.5 }}>
              {sym} vs {benchmark}, last {tail.length} {unit.many}. RS-Ratio/Momentum use the {trendWindow}/{momentumWindow}-{unit.adj}
              windows{smoothing > 1 ? ` on a ${smoothing}-${unit.adj} smoothed ratio` : ''}. Prices are the raw {unit.closes}.
            </p>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${CARD_BORDER}`, color: TEXT_MUTED, textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px 4px 0' }}>{interval === '1w' ? 'Week of' : interval === '4h' ? 'Bar (UTC)' : 'Day'}</th>
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
        faint (oldest) to the bold dot (the selected {unit.adj}). RS-Ratio and RS-Momentum are a standard open
        approximation of the JdK RRG method, not the exact proprietary formula; the first {warm} {unit.many} of
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

function overlayNotes(s, unit) {
  if (!s) return [];
  const out = [];
  if (s.relVol != null) out.push(`Volume ${s.relVol.toFixed(1)}× its 30-${unit.adj} average`);
  if (s.trend) out.push(`${s.trend.pct >= 0 ? '+' : ''}${s.trend.pct.toFixed(1)}% vs its ${TREND_WINDOW}-${unit.adj} average`);
  if (Number.isFinite(s.fundingPct)) out.push(`Funding ${s.fundingPct.toFixed(1)}%/yr`);
  return out;
}

function OverlayToggle({ label, checked, onChange, disabled = false, title }) {
  return (
    <label title={title} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: disabled ? TEXT_MUTED : TEXT_SECONDARY, cursor: disabled ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
