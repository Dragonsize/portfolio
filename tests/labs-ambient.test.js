import test from 'node:test';
import assert from 'node:assert/strict';
import { PULSE_CONFIG, createPulse, pixelRatioFor } from '../apps/labs/ambient-pulse.js';

const sequence = (values) => { let index = 0; return () => values[index++ % values.length]; };

test('pixel ratio respects device and canvas caps', () => {
  assert.equal(pixelRatioFor(100, 100, 3), PULSE_CONFIG.maxDeviceRatio);
  const ratio = pixelRatioFor(2000, 1200, 2);
  assert.ok(ratio * ratio * 2000 * 1200 <= PULSE_CONFIG.maxCanvasPixels + 1);
});

test('random pulses align to dot grid and remain in viewport', () => {
  const pulse = createPulse(1280, 800, sequence([.4, 0, .5, .3]));
  assert.ok(pulse);
  assert.equal(pulse.segments[0].start.x, pulse.start.x);
  assert.equal(pulse.segments[0].end.y, pulse.end.y);
  assert.equal(pulse.segments[0].cells, pulse.cells);
  pulse.segments.forEach((segment) => {
    [segment.start, segment.end].forEach((point) => {
      assert.equal(point.x % PULSE_CONFIG.gridSize, 0);
      assert.equal(point.y % PULSE_CONFIG.gridSize, 0);
      assert.ok(point.x > 0 && point.x < 1280);
      assert.ok(point.y > 0 && point.y < 800);
    });
  });
  assert.ok(pulse.cells >= PULSE_CONFIG.minCells && pulse.cells <= PULSE_CONFIG.maxCells);
  assert.ok(pulse.duration >= PULSE_CONFIG.minDuration && pulse.duration <= PULSE_CONFIG.maxDuration);
});

test('branch probability uses a 70 percent threshold', () => {
  const branching = createPulse(1280, 800, sequence([.5, 0, 0, .699]));
  const noBranching = createPulse(1280, 800, sequence([.5, 0, 0, .7]));
  assert.equal(branching.segments.length, 3);
  assert.equal(noBranching.segments.length, 1);
});

test('every branch tree is binary and capped', () => {
  let calls = 0; const pulse = createPulse(1280, 800, () => calls++ ? 0 : .5);
  const childCounts = new Map();
  pulse.segments.forEach((segment) => {
    if (segment.parent === null) return;
    childCounts.set(segment.parent, (childCounts.get(segment.parent) || 0) + 1);
  });
  assert.equal(pulse.segments.length, PULSE_CONFIG.maxSegments);
  assert.ok([...childCounts.values()].every((count) => count === 2));
  assert.ok(pulse.segments.every(({ depth }) => depth <= PULSE_CONFIG.maxBranchDepth));
  assert.deepEqual([...new Set(pulse.segments.map(({ depth }) => depth))], [0, 1, 2, 3]);
});

test('tiny viewports do not generate offscreen pulses', () => {
  assert.equal(createPulse(100, 100, () => .5), null);
});
