import test from 'node:test';
import assert from 'node:assert/strict';
import { HOSTS, LINKS, arcPoints, orbitPoints, project, rotate, spherePoint, spreadLabels } from '../apps/portfolio/net-globe.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('sphere points sit on the unit sphere and face the viewer at lon 0', () => {
  const p = spherePoint(0, 0);
  close(p[2], 1);
  HOSTS.forEach((h) => close(Math.hypot(...spherePoint(h.lat, h.lon)), 1));
});

test('rotation preserves length and positive pitch tips the north pole toward the viewer', () => {
  const r = rotate([0.3, -0.4, 0.5], 1.1, -0.7);
  close(Math.hypot(...r), Math.hypot(0.3, -0.4, 0.5));
  assert.ok(rotate([0, 1, 0], 0, 0.3)[2] > 0);
});

test('projection puts the centre-plane rim exactly one radius from centre', () => {
  const view = { cx: 100, cy: 50, radius: 40, distance: 3.4 };
  const p = project([1, 0, 0], view);
  close(p.x, 140); close(p.y, 50);
  assert.ok(project([0, 0, 1], view).z > 0);
});

test('arcs start and end on the hosts and lift in the middle', () => {
  const a = spherePoint(10, 0), b = spherePoint(-20, 80);
  const arc = arcPoints(a, b, 20, 0.2);
  arc[0].forEach((v, i) => close(v, a[i]));
  arc[20].forEach((v, i) => close(v, b[i]));
  close(Math.hypot(...arc[10]), 1.2);
});

test('every link references a real host', () => {
  LINKS.forEach(([a, b]) => { assert.ok(HOSTS[a] && HOSTS[b]); assert.notEqual(a, b); });
});

test('label spreading keeps a minimum gap and floor', () => {
  const out = spreadLabels([200, 205, 100, 90], 30, 120);
  assert.deepEqual([...out].sort((x, y) => x - y), [120, 150, 200, 230]);
  assert.equal(out[3], 120);
  assert.equal(out[2], 150);
});

test('orbit rings keep a constant radius after tilting', () => {
  orbitPoints(1.5, 1.1, -0.4, 24).forEach((p) => close(Math.hypot(...p), 1.5));
});
