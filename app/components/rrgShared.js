// Pieces shared by the 2D and 3D rotation graphs: palette, quadrant
// colours, markers, axis ticks and label placement.

export const TEXT_PRIMARY = '#E7E4DD';
export const TEXT_SECONDARY = '#8B9298';
export const TEXT_MUTED = '#6E767B';
export const CARD_BG = '#171D21';
export const CARD_BORDER = '#2A3136';
export const PLOT_BG = '#141A1D';
export const GRID = '#222A2F'; // hairline, one step off the plot surface
export const AXIS_100 = '#46525A'; // the benchmark lines — the only emphasized rules
export const ACCENT = '#C9A66B';

export const QUADRANTS = {
  leading: { name: 'Leading', color: '#7FA37F' },
  weakening: { name: 'Weakening', color: '#C9A66B' },
  lagging: { name: 'Lagging', color: '#A85D4F' },
  improving: { name: 'Improving', color: '#5E8FA8' },
};

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Axis ticks on a 1/2/5 step ladder (~4-6 per axis), labelled with just
// enough decimals for the step.
export function ticksFor(lo, hi) {
  const raw = (hi - lo) / 5;
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

// `hollow` draws the marker as an outline (used by the trend overlay).
export function Marker({ shape, x, y, r, color, ring, ringWidth = 1.5, opacity = 1, hollow = false }) {
  const fill = hollow ? PLOT_BG : color;
  const stroke = hollow ? color : ring;
  const sw = hollow ? 2.2 : ringWidth;
  if (shape === 'diamond') {
    const rr = r * 1.15;
    const d = `M ${x} ${y - rr} L ${x + rr} ${y} L ${x} ${y + rr} L ${x - rr} ${y} Z`;
    return <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} opacity={opacity} />;
  }
  return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={sw} opacity={opacity} />;
}

// Greedy label placement: try positions around each series' head and take
// the first that stays inside the plot and clear of other labels and heads.
// Labels that don't fit next to their head get a second pass further out,
// joined back to the head by a thin leader line. A label with nowhere to go
// is still dropped — the legend, tooltip and table carry that series —
// rather than stacked on top of another one.
export function placeLabels(items, bounds) {
  const obstacles = items.map((it) => {
    const r = (it.r || 5.5) + 2;
    return { x0: it.x - r, y0: it.y - r, x1: it.x + r, y1: it.y + r, owner: it.sym, head: true };
  });
  const overlaps = (a, b) => !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1);
  const h = 13;
  const width = (it) => it.text.length * 6.7 + 2;
  const near = (it) => {
    const w = width(it);
    const { x, y } = it;
    const extra = Math.max(0, (it.r || 5.5) - 5.5);
    const g = extra > 0 ? extra + 3 : 0; // push labels out past bigger heads
    return [
      { x0: x + 8 + g, y0: y - h / 2, anchor: 'start', tx: x + 9 + g, ty: y + 4 },
      { x0: x - 8 - g - w, y0: y - h / 2, anchor: 'end', tx: x - 9 - g, ty: y + 4 },
      { x0: x - w / 2, y0: y - 9 - h, anchor: 'middle', tx: x, ty: y - 12 },
      { x0: x - w / 2, y0: y + 9, anchor: 'middle', tx: x, ty: y + 19 },
      { x0: x + 6, y0: y - 6 - h, anchor: 'start', tx: x + 7, ty: y - 9 },
      { x0: x + 6, y0: y + 6, anchor: 'start', tx: x + 7, ty: y + 16 },
      { x0: x - 6 - w, y0: y - 6 - h, anchor: 'end', tx: x - 7, ty: y - 9 },
      { x0: x - 6 - w, y0: y + 6, anchor: 'end', tx: x - 7, ty: y + 16 },
    ];
  };
  // Further out, in 8 directions at two distances. The label's near edge
  // sits `d` px from the head; the leader runs from the head's rim to it.
  const far = (it) => {
    const w = width(it);
    const { x, y } = it;
    const r = it.r || 5.5;
    const out = [];
    for (const d of [22, 36]) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 1], [-1, -1], [-1, 1]]) {
        const k = dx && dy ? Math.SQRT1_2 : 1;
        const ax = x + dx * d * k; // point on the label nearest the head
        const ay = y + dy * d * k;
        const x0 = dx > 0 ? ax : dx < 0 ? ax - w : ax - w / 2;
        const y0 = dy > 0 ? ay : dy < 0 ? ay - h : ay - h / 2;
        const anchor = dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle';
        const tx = dx > 0 ? x0 + 1 : dx < 0 ? x0 + w - 1 : x0 + w / 2;
        out.push({
          x0, y0, anchor, tx, ty: y0 + h - 3,
          leader: { x1: x + dx * (r + 1) * k, y1: y + dy * (r + 1) * k, x2: ax - dx * 1, y2: ay - dy * 1 },
        });
      }
    }
    return out;
  };
  const out = {};
  const tryPlace = (it, candidates) => {
    const w = width(it);
    for (const c of candidates) {
      const r = { x0: c.x0, y0: c.y0, x1: c.x0 + w, y1: c.y0 + h };
      const inside = r.x0 >= bounds.x0 && r.x1 <= bounds.x1 && r.y0 >= bounds.y0 && r.y1 <= bounds.y1;
      const blocked = obstacles.some((o) => !(o.head && o.owner === it.sym) && overlaps(r, o));
      if (inside && !blocked) {
        obstacles.push({ ...r, owner: it.sym, head: false });
        out[it.sym] = c;
        return;
      }
    }
  };
  for (const it of items) tryPlace(it, near(it));
  for (const it of items) if (!out[it.sym]) tryPlace(it, far(it));
  return out;
}
