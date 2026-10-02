'use client';

import { useState, useRef, useEffect } from 'react';
import { VIEWS_3D, TIME_DEPTH, toWorld, fitCamera } from '../lib/rrg3d';
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, CARD_BORDER, PLOT_BG, GRID, AXIS_100, ACCENT, QUADRANTS,
  clamp, ticksFor, Marker, placeLabels,
} from './rrgShared';

const M = { left: 40, right: 40, top: 18, bottom: 36 };
const ZF = TIME_DEPTH / 2; // front plane (newest bar, or highest trend)
const ZB = -TIME_DEPTH / 2; // back plane

// 3D rotation graph (beta): the 2D RRG with time as depth. Each tail runs
// from its oldest bar at the back to the current bar at the front, so paths
// that cross over each other on the flat chart are pulled apart in time.
// Drag to rotate (mouse: both ways; touch: sideways, so the page still
// scrolls); the view buttons jump to fixed angles, including straight-on
// (= the 2D chart) and the two side-on views that read as RS-Momentum and
// RS-Ratio over time. Depth can instead be the absolute trend (price vs
// its own average): tails then move forward/back as a coin rises/falls in
// its own terms, and a shaded plane marks 0% (at its average).
//
// series: [{ sym, color, shape, label, points: [{ x, y, z, idx }], dim, headR, hollow, pinned, flag }]
//   (z is the depth value: the bar index for time, the trend % for trend)
// ranges: { x0, x1, y0, y1 } on the RRG axes.
// depth: { name, z0, z1, ticks: [{ v, label }], zeroPlane, caption, sideTitle, topTitle }
export default function RrgPlot3D({
  W, series, ranges, depth, focus, onHoverSym, onPin, tooltip, ariaLabel,
}) {
  const H = W;
  const [angles, setAngles] = useState({ yaw: VIEWS_3D[0].yaw, pitch: VIEWS_3D[0].pitch });
  const [viewKey, setViewKey] = useState(VIEWS_3D[0].key);
  const [hoverPt, setHoverPt] = useState(null); // { sym, idx }

  // Ease between preset views rather than jumping (skipped for reduced motion).
  const animRef = useRef(null);
  useEffect(() => () => cancelAnimationFrame(animRef.current), []);
  const goTo = (v) => {
    setViewKey(v.key);
    cancelAnimationFrame(animRef.current);
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return setAngles({ yaw: v.yaw, pitch: v.pitch });
    const from = angles;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 350);
      const e = 1 - (1 - k) ** 3;
      setAngles({ yaw: from.yaw + (v.yaw - from.yaw) * e, pitch: from.pitch + (v.pitch - from.pitch) * e });
      if (k < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  };

  const area = { x0: M.left, y0: M.top, x1: W - M.right, y1: H - M.bottom };
  const project = fitCamera(angles.yaw, angles.pitch, area);
  const r = { ...ranges, z0: depth.z0, z1: depth.z1 };
  const P = (x, y, z) => project(toWorld(x, y, z, r));
  const PW = (X, Y, Z) => project([X, Y, Z]);
  const zOf = (v) => toWorld(0, 0, v, r)[2];
  const [X100, Y100] = toWorld(100, 100, depth.z1, r).map((v) => clamp(v, -1, 1));
  const line = (a, b) => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });

  // ---- series geometry, painted back to front
  const showStems = angles.pitch > 8 && angles.pitch < 75;
  const items = [];
  const heads = [];
  for (const s of series) {
    const pts = s.points.map((p) => ({ ...p, ...P(p.x, p.y, p.z) }));
    const n = pts.length;
    if (!n) continue;
    const op = s.dim ? 0.14 : 1;
    for (let i = 1; i < n; i++) {
      const t = n > 2 ? (i - 1) / (n - 2) : 1;
      items.push({
        depth: (pts[i - 1].depth + pts[i].depth) / 2,
        el: (
          <line
            key={`${s.sym}-s${i}`} {...line(pts[i - 1], pts[i])}
            stroke={s.color} strokeWidth={1.4 + t} strokeLinecap="round" opacity={op * (0.3 + t * 0.6)}
          />
        ),
      });
    }
    for (let i = 0; i < n - 1; i++) {
      const t = n > 1 ? i / (n - 1) : 1;
      items.push({
        depth: pts[i].depth + 1e-3,
        el: <Marker key={`${s.sym}-d${i}`} shape={s.shape} x={pts[i].x} y={pts[i].y} r={2 + t * 1.2} color={s.color} ring={PLOT_BG} ringWidth={1} opacity={op * (0.35 + t * 0.5)} />,
      });
    }
    const h = pts[n - 1];
    // A faint stem from the head down to the floor locates it in depth when
    // looking down at an angle (straight on or side-on it adds nothing).
    if (showStems) {
      const hw = toWorld(s.points[n - 1].x, s.points[n - 1].y, s.points[n - 1].z, r);
      const floor = project([hw[0], -1, hw[2]]);
      items.push({ depth: h.depth - 1e-3, el: <line key={`${s.sym}-stem`} {...line(h, floor)} stroke={s.color} strokeWidth={1} strokeDasharray="2 3" opacity={op * 0.45} /> });
    }
    items.push({
      depth: h.depth + 2e-3,
      el: (
        <Marker
          key={`${s.sym}-h`} shape={s.shape} x={h.x} y={h.y} r={s.headR} color={s.color}
          ring={s.pinned ? ACCENT : PLOT_BG} ringWidth={2} hollow={s.hollow} opacity={op}
        />
      ),
    });
    // Funding overlay flags, as on the 2D chart: ▲ crowded longs, ▼ shorts paying.
    if (s.flag) {
      const fx = h.x + s.headR + 1;
      const fy = h.y - s.headR - 1;
      const d = s.flag === 'crowded-long'
        ? `M ${fx} ${fy - 6} L ${fx + 4} ${fy + 1} L ${fx - 4} ${fy + 1} Z`
        : `M ${fx} ${fy + 1} L ${fx + 4} ${fy - 6} L ${fx - 4} ${fy - 6} Z`;
      items.push({ depth: h.depth + 3e-3, el: <path key={`${s.sym}-f`} d={d} fill={s.flag === 'crowded-long' ? ACCENT : '#5E8FA8'} stroke={PLOT_BG} strokeWidth={1} opacity={op} /> });
    }
    heads.push({ sym: s.sym, x: h.x, y: h.y, r: s.headR, text: s.label, dim: s.dim, pts });
  }
  items.sort((a, b) => a.depth - b.depth);

  const labelPlacement = placeLabels(
    [...heads].filter((h) => h.x >= area.x0 && h.x <= area.x1 && h.y >= area.y0 && h.y <= area.y1)
      .sort((a, b) => (b.sym === focus) - (a.sym === focus)),
    { x0: area.x0 + 2, y0: area.y0 + 2, x1: area.x1 - 2, y1: area.y1 - 2 },
  );

  // ---- box, quadrant columns and depth slices
  const box = [];
  for (const Y of [-1, 1]) for (const Z of [ZB, ZF]) box.push(line(PW(-1, Y, Z), PW(1, Y, Z)));
  for (const X of [-1, 1]) for (const Z of [ZB, ZF]) box.push(line(PW(X, -1, Z), PW(X, 1, Z)));
  for (const X of [-1, 1]) for (const Y of [-1, 1]) box.push(line(PW(X, Y, ZB), PW(X, Y, ZF)));
  const ticks = depth.ticks;
  const zeroZ = depth.zeroPlane && depth.z0 < 0 && depth.z1 > 0 ? zOf(0) : null;
  const slice = (Z) => [PW(-1, -1, Z), PW(1, -1, Z), PW(1, 1, Z), PW(-1, 1, Z)];
  const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const washes = [
    { q: 'leading', X: [X100, 1], Y: [Y100, 1] },
    { q: 'weakening', X: [X100, 1], Y: [-1, Y100] },
    { q: 'lagging', X: [-1, X100], Y: [-1, Y100] },
    { q: 'improving', X: [-1, X100], Y: [Y100, 1] },
  ];
  // Quadrant names, while the RRG plane faces the viewer enough to read them
  // (left off on phone widths, where they crowd the ticker labels; the
  // quadrant cards above the chart carry them).
  const facing = Math.abs(Math.cos((angles.yaw * Math.PI) / 180) * Math.cos((angles.pitch * Math.PI) / 180));

  // ---- axis tick labels, on whichever edge of each axis sits outermost
  const center = PW(0, 0, 0);
  const edgeLabels = (ends, valuesAt, pick) => {
    const cands = ends.map(([a, b]) => ({ a, b, pa: project(a), pb: project(b) }));
    const best = cands.reduce((m, c) => (pick(c) > pick(m) ? c : m));
    if (Math.hypot(best.pb.x - best.pa.x, best.pb.y - best.pa.y) < 50) return [];
    const mx = (best.pa.x + best.pb.x) / 2 - center.x;
    const my = (best.pa.y + best.pb.y) / 2 - center.y;
    const len = Math.hypot(mx, my) || 1;
    const ox = (mx / len) * 12;
    const oy = (my / len) * 12;
    const anchor = ox > 4 ? 'start' : ox < -4 ? 'end' : 'middle';
    return valuesAt(best.a, best.b).map(({ w, label }) => {
      const p = project(w);
      // Keep each label inside the svg (≈6px per character at 10px mono).
      const tw = label.length * 6.1;
      const lo = anchor === 'end' ? tw + 2 : anchor === 'middle' ? tw / 2 + 2 : 2;
      const hi = anchor === 'start' ? W - tw - 2 : anchor === 'middle' ? W - tw / 2 - 2 : W - 2;
      return { x: clamp(p.x + ox, lo, hi), y: clamp(p.y + oy + 3, 10, H - 3), label, anchor };
    });
  };
  const mid = (c) => ({ x: (c.pa.x + c.pb.x) / 2, y: (c.pa.y + c.pb.y) / 2 });
  const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const xTickLabels = edgeLabels(
    [[-1, ZF], [1, ZF], [-1, ZB], [1, ZB]].map(([Y, Z]) => [[-1, Y, Z], [1, Y, Z]]),
    (a, b) => ticksFor(ranges.x0, ranges.x1).map((t) => ({ w: lerp(a, b, (t.v - ranges.x0) / (ranges.x1 - ranges.x0)), label: t.label })),
    (c) => mid(c).y - mid(c).x * 0.01,
  );
  const yTickLabels = edgeLabels(
    [[-1, ZF], [1, ZF], [-1, ZB], [1, ZB]].map(([X, Z]) => [[X, -1, Z], [X, 1, Z]]),
    (a, b) => ticksFor(ranges.y0, ranges.y1).map((t) => ({ w: lerp(a, b, (t.v - ranges.y0) / (ranges.y1 - ranges.y0)), label: t.label })),
    (c) => -mid(c).x + mid(c).y * 0.01,
  );
  const tTickLabels = edgeLabels(
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([X, Y]) => [[X, Y, ZB], [X, Y, ZF]]),
    (a, b) => ticks.map((t) => ({ w: lerp(a, b, (zOf(t.v) - ZB) / (ZF - ZB)), label: t.label })),
    (c) => mid(c).y + mid(c).x * 0.01,
  );

  // ---- pointer: drag rotates, hover/tap reads a point, tapping a head pins it
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const nearest = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best = null;
    for (const h of heads) {
      h.pts.forEach((p, i) => {
        const isHead = i === h.pts.length - 1;
        const d = Math.hypot(p.x - mx, p.y - my) - (isHead ? 4 : 0);
        if (!best || d < best.d) best = { sym: h.sym, idx: p.idx, d, isHead };
      });
    }
    return best && best.d <= 20 ? best : null;
  };
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false, touch: e.pointerType !== 'mouse' };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (d) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) < 3) return;
      dragRef.current = { ...d, x: e.clientX, y: e.clientY, moved: true };
      cancelAnimationFrame(animRef.current);
      setViewKey(null);
      setAngles((a) => ({
        yaw: a.yaw + dx * 0.45,
        pitch: d.touch ? a.pitch : clamp(a.pitch + dy * 0.45, -10, 90),
      }));
      setHoverPt(null);
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const hit = nearest(e);
    setHoverPt(hit ? { sym: hit.sym, idx: hit.idx } : null);
    onHoverSym(hit ? hit.sym : null);
  };
  const endDrag = () => {
    movedRef.current = !!dragRef.current?.moved;
    dragRef.current = null;
  };
  const onClick = (e) => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    const hit = nearest(e);
    setHoverPt(hit ? { sym: hit.sym, idx: hit.idx } : null);
    if (hit?.isHead) onPin(hit.sym);
  };

  const hover = (() => {
    if (!hoverPt) return null;
    const h = heads.find((x) => x.sym === hoverPt.sym);
    const p = h?.pts.find((x) => x.idx === hoverPt.idx);
    return p ? { ...hoverPt, px: p.x, py: p.y } : null;
  })();

  const btn = (active) => ({
    background: active ? '#1E252A' : 'transparent',
    border: `1px solid ${active ? ACCENT : CARD_BORDER}`,
    color: active ? ACCENT : TEXT_SECONDARY,
    borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
  });

  return (
    <div>
      <div style={{ position: 'relative', width: W }}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={() => { dragRef.current = null; }}
          onClick={onClick}
          onPointerLeave={() => {
            endDrag();
            setHoverPt(null);
            onHoverSym(null);
          }}
          role="img"
          aria-label={ariaLabel}
          style={{ display: 'block', cursor: 'grab', userSelect: 'none', touchAction: 'pan-y' }}
        >
          <rect x={0} y={0} width={W} height={H} fill={PLOT_BG} />

          {/* back plane: quadrant washes and names */}
          {washes.map((w) => (
            <polygon key={w.q} points={poly([PW(w.X[0], w.Y[0], ZB), PW(w.X[1], w.Y[0], ZB), PW(w.X[1], w.Y[1], ZB), PW(w.X[0], w.Y[1], ZB)])} fill={QUADRANTS[w.q].color} opacity={0.09} />
          ))}
          {/* depth slices: the RRG plane at each labelled bar (or trend level) */}
          {ticks.map((t) => <polygon key={`sl${t.v}`} points={poly(slice(zOf(t.v)))} fill="none" stroke={GRID} strokeWidth={1} />)}
          {/* trend axis: the 0% plane (price at its own average) */}
          {zeroZ != null && <polygon points={poly(slice(zeroZ))} fill={AXIS_100} fillOpacity={0.12} stroke={AXIS_100} strokeWidth={1} />}
          {box.map((l, k) => <line key={`b${k}`} {...l} stroke={GRID} strokeWidth={1} />)}
          {/* quadrant boundaries: the 100 lines on the back and front planes,
              where they meet the box's faces, and the 100/100 spine through depth */}
          {[ZB, ZF].map((Z) => (
            <g key={`c${Z}`}>
              <line {...line(PW(X100, -1, Z), PW(X100, 1, Z))} stroke={AXIS_100} strokeWidth={1} />
              <line {...line(PW(-1, Y100, Z), PW(1, Y100, Z))} stroke={AXIS_100} strokeWidth={1} />
            </g>
          ))}
          {[[X100, -1], [X100, 1]].map(([X, Y]) => <line key={`fx${Y}`} {...line(PW(X, Y, ZB), PW(X, Y, ZF))} stroke={GRID} strokeWidth={1} />)}
          {[[-1, Y100], [1, Y100]].map(([X, Y]) => <line key={`fy${X}`} {...line(PW(X, Y, ZB), PW(X, Y, ZF))} stroke={GRID} strokeWidth={1} />)}
          <line {...line(PW(X100, Y100, ZB), PW(X100, Y100, ZF))} stroke={AXIS_100} strokeWidth={1} strokeDasharray="4 4" />
          {facing > 0.6 && W >= 420 && [
            { q: 'leading', X: 1, Y: 1, ok: X100 < 0.5 && Y100 < 0.8 },
            { q: 'weakening', X: 1, Y: -1, ok: X100 < 0.5 && Y100 > -0.8 },
            { q: 'lagging', X: -1, Y: -1, ok: X100 > -0.5 && Y100 > -0.8 },
            { q: 'improving', X: -1, Y: 1, ok: X100 > -0.5 && Y100 < 0.8 },
          ].filter((c) => c.ok).map((c) => {
            // Each quadrant is a column through depth, so its name can sit at
            // either end: use whichever corner is on the box's outline, away
            // from the tails in the middle.
            const [p] = [PW(c.X, c.Y, ZB), PW(c.X, c.Y, ZF)]
              .sort((a, b) => Math.hypot(b.x - center.x, b.y - center.y) - Math.hypot(a.x - center.x, a.y - center.y));
            const right = p.x > center.x;
            const below = p.y > center.y;
            return (
              <text
                key={c.q} x={p.x + (right ? -6 : 6)} y={p.y + (below ? -6 : 14)} textAnchor={right ? 'end' : 'start'}
                fill={QUADRANTS[c.q].color} fontSize={10} fontWeight={600} opacity={0.85}
              >
                {QUADRANTS[c.q].name}
              </text>
            );
          })}

          {items.map((it) => it.el)}

          {heads.map((h) => {
            const pl = labelPlacement[h.sym];
            if (!pl) return null;
            return (
              <g key={`lbl-${h.sym}`} opacity={h.dim ? 0.2 : 1} pointerEvents="none">
                {pl.leader && <line {...pl.leader} stroke={TEXT_MUTED} strokeWidth={1} />}
                <text
                  x={pl.tx} y={pl.ty} textAnchor={pl.anchor} fill={TEXT_PRIMARY} stroke={PLOT_BG} strokeWidth={3}
                  paintOrder="stroke" fontSize={11} fontWeight={focus === h.sym ? 700 : 500} fontFamily="ui-monospace,monospace"
                >
                  {h.text}
                </text>
              </g>
            );
          })}

          {[...xTickLabels, ...yTickLabels].map((t, k) => (
            <text key={`t${k}`} x={t.x} y={t.y} textAnchor={t.anchor} fill={TEXT_MUTED} fontSize={10} fontFamily="ui-monospace,monospace">{t.label}</text>
          ))}
          {tTickLabels.map((t, k) => (
            <text key={`tt${k}`} x={t.x} y={t.y} textAnchor={t.anchor} fill={TEXT_SECONDARY} fontSize={10} fontFamily="ui-monospace,monospace">{t.label}</text>
          ))}
        </svg>

        {hover && (
          <div
            style={{
              position: 'absolute', left: clamp(hover.px + 12, 0, W - 176), top: clamp(hover.py - 58, 0, H - 64), width: 170,
              background: '#0E1316', border: `1px solid ${CARD_BORDER}`, borderRadius: 4, padding: '6px 8px',
              pointerEvents: 'none', fontSize: 11, lineHeight: 1.45,
            }}
          >
            {tooltip(hover.sym, hover.idx)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 12, color: TEXT_SECONDARY, marginRight: 2 }}>View</span>
        {VIEWS_3D.map((v) => {
          const label = v.label.replace('time', depth.name);
          const title = v.key === 'momentum' ? depth.sideTitle : v.key === 'ratio' ? depth.topTitle : v.title;
          return <button key={v.key} onClick={() => goTo(v)} title={title} style={btn(viewKey === v.key)}>{label}</button>;
        })}
      </div>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '6px 0 0', lineHeight: 1.5 }}>{depth.caption}</p>
    </div>
  );
}
