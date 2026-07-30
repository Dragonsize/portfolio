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
  assert.equal(pulse.start.x % PULSE_CONFIG.gridSize, 0);
  assert.equal(pulse.start.y % PULSE_CONFIG.gridSize, 0);
  assert.equal(pulse.end.x % PULSE_CONFIG.gridSize, 0);
  assert.equal(pulse.end.y % PULSE_CONFIG.gridSize, 0);
  assert.ok(pulse.start.x > 0 && pulse.start.x < 1280);
  assert.ok(pulse.end.x > 0 && pulse.end.x < 1280);
  assert.ok(pulse.start.y > 0 && pulse.start.y < 800);
  assert.ok(pulse.end.y > 0 && pulse.end.y < 800);
  assert.ok(pulse.cells >= PULSE_CONFIG.minCells && pulse.cells <= PULSE_CONFIG.maxCells);
  assert.ok(pulse.duration >= PULSE_CONFIG.minDuration && pulse.duration <= PULSE_CONFIG.maxDuration);
});

test('tiny viewports do not generate offscreen pulses', () => {
  assert.equal(createPulse(100, 100, () => .5), null);
});
