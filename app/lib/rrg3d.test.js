const test = require('node:test');
const assert = require('node:assert/strict');
const { VIEWS_3D, TIME_DEPTH, toWorld, rotate, fitCamera, BOX_CORNERS, timeTicks, depthRange } = require('./rrg3d.js');

const view = (key) => VIEWS_3D.find((v) => v.key === key);
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('toWorld maps ranges to the box, newest bar at the front', () => {
  const r = { x0: 98, x1: 102, y0: 99, y1: 101, z0: 10, z1: 20 };
  assert.deepEqual(toWorld(100, 100, 15, r), [0, 0, 0]);
  assert.deepEqual(toWorld(98, 101, 10, r), [-1, 1, -TIME_DEPTH / 2]);
  assert.deepEqual(toWorld(102, 99, 20, r), [1, -1, TIME_DEPTH / 2]);
  // a one-bar tail sits on the front plane
  assert.equal(toWorld(100, 100, 5, { ...r, z0: 5, z1: 5 })[2], TIME_DEPTH / 2);
});

test('front view is the 2D RRG, newest bar nearest', () => {
  const { yaw, pitch } = view('front');
  const [x, y, d] = rotate([0.3, -0.4, 0.7], yaw, pitch);
  assert.ok(close(x, 0.3) && close(y, -0.4) && close(d, 0.7));
  assert.ok(rotate([0, 0, 1], yaw, pitch)[2] > rotate([0, 0, -1], yaw, pitch)[2]);
});

test('side view plots momentum over time; top view plots ratio over time', () => {
  const side = view('momentum');
  // time runs left -> right, momentum is vertical, ratio collapses into depth
  let [x, y] = rotate([0.5, 0.25, 1], side.yaw, side.pitch);
  assert.ok(close(x, 1) && close(y, 0.25));
  assert.ok(rotate([0, 0, 1], side.yaw, side.pitch)[0] > rotate([0, 0, -1], side.yaw, side.pitch)[0]);
  const top = view('ratio');
  [x, y] = rotate([0.5, 0.25, -1], top.yaw, top.pitch);
  assert.ok(close(x, -1) && close(y, 0.5));
});

test('fitCamera keeps the whole box inside the plot area at any angle', () => {
  const area = { x0: 40, y0: 10, x1: 450, y1: 420 };
  for (const yaw of [-170, -90, -35, 0, 20, 35, 90, 135]) {
    for (const pitch of [-5, 0, 20, 45, 90]) {
      const project = fitCamera(yaw, pitch, area);
      for (const c of BOX_CORNERS) {
        const p = project(c);
        assert.ok(p.x >= area.x0 - 1e-6 && p.x <= area.x1 + 1e-6, `x ${yaw}/${pitch}`);
        assert.ok(p.y >= area.y0 - 1e-6 && p.y <= area.y1 + 1e-6, `y ${yaw}/${pitch}`);
      }
    }
  }
  // screen y grows downward: higher momentum is higher on screen
  const project = fitCamera(0, 0, area);
  assert.ok(project([0, 1, 0]).y < project([0, -1, 0]).y);
});

test('timeTicks spreads labels across the tail and keeps both ends', () => {
  assert.deepEqual(timeTicks(10, 16), [10, 12, 14, 16]);
  assert.deepEqual(timeTicks(10, 12), [10, 11, 12]);
  assert.deepEqual(timeTicks(7, 7), [7]);
});

test('depthRange keeps the anchor (0%) in view and pads the data', () => {
  const a = depthRange([2, 4]);
  assert.ok(close(a.z0, -0.4) && close(a.z1, 4.4));
  const r = depthRange([-6, -2]);
  assert.ok(r.z0 < -6 && r.z1 > 0);
  // a flat set still gets a usable span
  assert.deepEqual(depthRange([0, 0]), { z0: -1, z1: 1 });
  assert.deepEqual(depthRange([NaN, 1]), depthRange([1]));
});
