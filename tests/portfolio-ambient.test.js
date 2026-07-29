import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCube, buildMesh, CUBE, OCTAHEDRON, TETRAHEDRON, classifyProjectedLink, createSphereMesh, projectPoint, screenToWorldParameter } from '../apps/portfolio/ambient-geometry.js';

const camera = { width: 1000, height: 700, focal: 600, near: .1 };
const cube = buildCube({ position: { x: 0, y: 0, z: 5 }, size: 1, rotation: { x: 0, y: 0, z: 0 } });
function link(a, b) { return { a, b, screenA: projectPoint(a, camera), screenB: projectPoint(b, camera) }; }

test('generic meshes produce triangulated faces', () => {
  const instance = { position: { x: 0, y: 0, z: 5 }, size: 1, rotation: { x: 0, y: 0, z: 0 } };
  assert.equal(buildMesh(CUBE, instance).triangles.length, 12);
  assert.equal(buildMesh(TETRAHEDRON, instance).triangles.length, 4);
  assert.equal(buildMesh(OCTAHEDRON, instance).triangles.length, 8);
  assert.ok(buildMesh(createSphereMesh(4, 7), instance).triangles.length > 20);
});

test('screen-to-world conversion preserves endpoints', () => {
  assert.equal(screenToWorldParameter(0, 4, 10), 0);
  assert.equal(screenToWorldParameter(1, 4, 10), 1);
});

test('link behind cube splits into dashed center fragment', () => {
  const fragments = classifyProjectedLink(link({ x: -3, y: 0, z: 9 }, { x: 3, y: 0, z: 9 }), cube.triangles, camera);
  assert.ok(fragments.some((fragment) => fragment.occluded));
  assert.ok(fragments.some((fragment) => !fragment.occluded));
});

test('link in front of cube remains solid', () => {
  const fragments = classifyProjectedLink(link({ x: -3, y: 0, z: 3 }, { x: 3, y: 0, z: 3 }), cube.triangles, camera);
  assert.ok(fragments.every((fragment) => !fragment.occluded));
});

test('link missing cube silhouette remains solid', () => {
  const fragments = classifyProjectedLink(link({ x: -3, y: 3, z: 9 }, { x: 3, y: 3, z: 9 }), cube.triangles, camera);
  assert.equal(fragments.length, 1);
  assert.equal(fragments[0].occluded, false);
});
