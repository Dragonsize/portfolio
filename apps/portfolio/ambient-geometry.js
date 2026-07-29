const EPSILON = 1e-7;

export const CUBE_VERTICES = Object.freeze([
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
]);
export const CUBE_FACES = Object.freeze([
  [0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1],
  [1, 5, 6, 2], [2, 6, 7, 3], [4, 0, 3, 7]
]);

export function rotatePoint([x, y, z], { x: rx, y: ry, z: rz }) {
  const cy = Math.cos(rx); const sy = Math.sin(rx);
  const y1 = y * cy - z * sy; const z1 = y * sy + z * cy;
  const cx = Math.cos(ry); const sx = Math.sin(ry);
  const x2 = x * cx + z1 * sx; const z2 = -x * sx + z1 * cx;
  const cz = Math.cos(rz); const sz = Math.sin(rz);
  return { x: x2 * cz - y1 * sz, y: x2 * sz + y1 * cz, z: z2 };
}

export const TETRAHEDRON = Object.freeze({ vertices: [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]], faces: [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]] });
export const OCTAHEDRON = Object.freeze({ vertices: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], faces: [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]] });
export const CUBE = Object.freeze({ vertices: CUBE_VERTICES, faces: CUBE_FACES });

export function createSphereMesh(rings = 5, segments = 8) {
  const vertices = [[0, 1, 0]]; const faces = [];
  for (let ring = 1; ring < rings; ring += 1) { const phi = Math.PI * ring / rings; for (let segment = 0; segment < segments; segment += 1) { const theta = Math.PI * 2 * segment / segments; vertices.push([Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)]); } }
  const bottom = vertices.push([0, -1, 0]) - 1;
  for (let segment = 0; segment < segments; segment += 1) faces.push([0, 1 + segment, 1 + (segment + 1) % segments]);
  for (let ring = 0; ring < rings - 2; ring += 1) { const start = 1 + ring * segments; const next = start + segments; for (let segment = 0; segment < segments; segment += 1) faces.push([start + segment, next + segment, next + (segment + 1) % segments, start + (segment + 1) % segments]); }
  const finalStart = 1 + (rings - 2) * segments; for (let segment = 0; segment < segments; segment += 1) faces.push([finalStart + segment, bottom, finalStart + (segment + 1) % segments]);
  return { vertices, faces };
}

export function buildMesh(mesh, instance) {
  const vertices = mesh.vertices.map((vertex) => { const point = rotatePoint(vertex.map((value) => value * instance.size), instance.rotation); return { x: point.x + instance.position.x, y: point.y + instance.position.y, z: point.z + instance.position.z }; });
  const faces = mesh.faces.map((indices) => ({ indices, triangles: indices.slice(1, -1).map((_, index) => [vertices[indices[0]], vertices[indices[index + 1]], vertices[indices[index + 2]]]) }));
  return { vertices, faces, triangles: faces.flatMap((face) => face.triangles) };
}

export function buildCube(cube) { return buildMesh(CUBE, cube); }

export function projectPoint(point, camera) {
  if (point.z <= camera.near) return null;
  return { x: camera.width / 2 + camera.focal * point.x / point.z, y: camera.height / 2 - camera.focal * point.y / point.z, z: point.z };
}

export function segmentIntersectionParameter(a, b, c, d) {
  const rX = b.x - a.x; const rY = b.y - a.y;
  const sX = d.x - c.x; const sY = d.y - c.y;
  const denominator = rX * sY - rY * sX;
  if (Math.abs(denominator) < EPSILON) return null;
  const qX = c.x - a.x; const qY = c.y - a.y;
  const t = (qX * sY - qY * sX) / denominator;
  const u = (qX * rY - qY * rX) / denominator;
  return t > EPSILON && t < 1 - EPSILON && u > EPSILON && u < 1 - EPSILON ? t : null;
}

export function screenToWorldParameter(u, zA, zB) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return (u / zB) / (((1 - u) / zA) + (u / zB));
}

export function rayTriangleDepth(direction, [a, b, c]) {
  const edge1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const edge2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const p = cross(direction, edge2); const determinant = dot(edge1, p);
  if (Math.abs(determinant) < EPSILON) return null;
  const inverse = 1 / determinant; const tVector = { x: -a.x, y: -a.y, z: -a.z };
  const u = dot(tVector, p) * inverse;
  if (u < -EPSILON || u > 1 + EPSILON) return null;
  const q = cross(tVector, edge1); const v = dot(direction, q) * inverse;
  if (v < -EPSILON || u + v > 1 + EPSILON) return null;
  const depth = dot(edge2, q) * inverse;
  return depth > EPSILON ? depth : null;
}

export function classifyProjectedLink(link, triangles, camera) {
  const breakpoints = [0, 1];
  for (const triangle of triangles) {
    const projected = triangle.map((point) => projectPoint(point, camera));
    if (projected.some((point) => !point)) continue;
    for (let index = 0; index < 3; index += 1) {
      const intersection = segmentIntersectionParameter(link.screenA, link.screenB, projected[index], projected[(index + 1) % 3]);
      if (intersection !== null) breakpoints.push(intersection);
    }
  }
  const values = [...new Set(breakpoints.sort((a, b) => a - b).map((value) => Number(value.toFixed(6))))];
  const fragments = [];
  for (let index = 0; index < values.length - 1; index += 1) {
    const u0 = values[index]; const u1 = values[index + 1];
    if (u1 - u0 < EPSILON) continue;
    const u = (u0 + u1) / 2; const t = screenToWorldParameter(u, link.a.z, link.b.z);
    const point = lerp(link.a, link.b, t);
    const screen = lerp(link.screenA, link.screenB, u);
    const direction = { x: (screen.x - camera.width / 2) / camera.focal, y: -(screen.y - camera.height / 2) / camera.focal, z: 1 };
    let nearest = Infinity;
    for (const triangle of triangles) { const depth = rayTriangleDepth(direction, triangle); if (depth !== null && depth < nearest) nearest = depth; }
    fragments.push({ u0, u1, occluded: nearest < point.z - EPSILON });
  }
  return fragments;
}

function lerp(a, b, amount) { return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount, z: a.z + (b.z - a.z) * amount }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
