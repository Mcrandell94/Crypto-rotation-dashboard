// Camera maths for the 3D RRG view (beta). Three axes:
//   x = RS-Ratio (left -> right), y = RS-Momentum (up), z = time (oldest
//   bar of the tail at the back, newest at the front, toward the viewer).
// The camera is orthographic: a perspective camera would shrink older
// points toward the middle, so the same RS-Ratio would sit at different
// screen positions at different times. Looking straight on ('front') this
// is exactly the 2D RRG.

// Camera angles in degrees. yaw turns the box about the vertical axis
// (positive brings the newest end round to the right); pitch tilts it
// (positive looks down on it from above).
export const VIEWS_3D = [
  { key: 'angled', label: 'Angled', yaw: 35, pitch: 20, title: 'Tails run back in time from the newest bar at the front' },
  { key: 'front', label: 'Front', yaw: 0, pitch: 0, title: 'Straight on, newest bar nearest: the usual 2D RRG' },
  { key: 'momentum', label: 'Momentum × time', yaw: 90, pitch: 0, title: 'From the side: RS-Momentum over time, oldest left, newest right' },
  { key: 'ratio', label: 'Ratio × time', yaw: 90, pitch: 90, title: 'From above: RS-Ratio over time, oldest left, newest right' },
];

// Length of the time axis relative to the RRG plane's width.
export const TIME_DEPTH = 2;

// Data -> world coordinates. x/y map their ranges onto [-1, 1]; bar index i
// maps [iOld, iNew] onto [-TIME_DEPTH/2, TIME_DEPTH/2].
export function toWorld(x, y, i, { x0, x1, y0, y1, iOld, iNew }) {
  const X = x1 > x0 ? (2 * (x - x0)) / (x1 - x0) - 1 : 0;
  const Y = y1 > y0 ? (2 * (y - y0)) / (y1 - y0) - 1 : 0;
  const Z = iNew > iOld ? TIME_DEPTH * ((i - iOld) / (iNew - iOld) - 0.5) : TIME_DEPTH / 2;
  return [X, Y, Z];
}

// World -> camera: [screen x, screen y (up), depth (larger = nearer)].
export function rotate([X, Y, Z], yawDeg, pitchDeg) {
  const a = (yawDeg * Math.PI) / 180;
  const b = (pitchDeg * Math.PI) / 180;
  const x1 = X * Math.cos(a) + Z * Math.sin(a);
  const z1 = -X * Math.sin(a) + Z * Math.cos(a);
  return [x1, Y * Math.cos(b) - z1 * Math.sin(b), Y * Math.sin(b) + z1 * Math.cos(b)];
}

export const BOX_CORNERS = [];
for (const X of [-1, 1]) for (const Y of [-1, 1]) for (const Z of [-TIME_DEPTH / 2, TIME_DEPTH / 2]) BOX_CORNERS.push([X, Y, Z]);

// A camera that fits the whole box inside the plot area
// { x0, y0, x1, y1 } (pixels) at the given angles. Returns
// project([X, Y, Z]) -> { x, y, depth } in pixels.
export function fitCamera(yawDeg, pitchDeg, area) {
  const pts = BOX_CORNERS.map((c) => rotate(c, yawDeg, pitchDeg));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const w = area.x1 - area.x0;
  const h = area.y1 - area.y0;
  const s = Math.min(w / Math.max(maxX - minX, 1e-6), h / Math.max(maxY - minY, 1e-6));
  const cx = (area.x0 + area.x1) / 2 - ((minX + maxX) / 2) * s;
  const cy = (area.y0 + area.y1) / 2 + ((minY + maxY) / 2) * s;
  return (world) => {
    const [x, y, depth] = rotate(world, yawDeg, pitchDeg);
    return { x: cx + x * s, y: cy - y * s, depth };
  };
}

// Up to `n` evenly spaced bar indices from iOld to iNew, always including both ends.
export function timeTicks(iOld, iNew, n = 4) {
  if (iNew <= iOld) return [iNew];
  const span = iNew - iOld;
  const k = Math.min(n - 1, span);
  const out = [];
  for (let j = 0; j <= k; j++) out.push(iOld + Math.round((span * j) / k));
  return [...new Set(out)];
}
