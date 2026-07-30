export const PULSE_CONFIG = Object.freeze({ gridSize: 32, minCells: 4, maxCells: 10, minBranchCells: 2, maxBranchCells: 5, branchProbability: .7, maxBranchDepth: 3, maxSegments: 15, minDelay: 350, maxDelay: 1000, minDuration: 700, maxDuration: 1100, fadeDuration: 180, trailCells: 1.5, maxConcurrent: 3, maxDeviceRatio: 1.25, maxCanvasPixels: 1250000 });

const DIRECTIONS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export function pixelRatioFor(width, height, deviceRatio = 1) {
  if (!width || !height) return 1;
  return Math.min(deviceRatio || 1, PULSE_CONFIG.maxDeviceRatio, Math.sqrt(PULSE_CONFIG.maxCanvasPixels / (width * height)));
}

const inBounds = (point, columns, rows) => point.column >= 1 && point.column < columns - 1 && point.row >= 1 && point.row < rows - 1;
const move = (point, direction, cells) => ({ column: point.column + direction[0] * cells, row: point.row + direction[1] * cells });
const maxCellsInDirection = (point, [xDirection, yDirection], columns, rows) => Math.min(xDirection > 0 ? columns - 2 - point.column : xDirection < 0 ? point.column - 1 : Infinity, yDirection > 0 ? rows - 2 - point.row : yDirection < 0 ? point.row - 1 : Infinity);
const pickCells = (minimum, maximum, random) => minimum + Math.floor(random() * (maximum - minimum + 1));

function createRoot(columns, rows, random) {
  const points = [];
  for (let row = 1; row < rows - 1; row += 1) for (let column = 1; column < columns - 1; column += 1) points.push({ column, row });
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const start = points[Math.floor(random() * points.length)]; const direction = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)]; const cells = pickCells(PULSE_CONFIG.minCells, PULSE_CONFIG.maxCells, random); const end = move(start, direction, cells);
    if (inBounds(end, columns, rows)) return { id: 0, start, end, direction, cells, depth: 0, parentId: null, fork: null };
  }
  return null;
}

function branchSegments(root, columns, rows, random) {
  const segments = [root]; const queue = [root]; let nextId = 1;
  while (queue.length && segments.length + 2 <= PULSE_CONFIG.maxSegments) {
    const parent = queue.shift();
    if (parent.depth >= PULSE_CONFIG.maxBranchDepth || random() >= PULSE_CONFIG.branchProbability) continue;
    const forkCells = pickCells(1, parent.cells - 1, random); const forkPoint = move(parent.start, parent.direction, forkCells);
    const directionIndex = DIRECTIONS.findIndex(([x, y]) => x === parent.direction[0] && y === parent.direction[1]);
    const branchDirections = [DIRECTIONS[(directionIndex + 1) % DIRECTIONS.length], DIRECTIONS[(directionIndex + DIRECTIONS.length - 1) % DIRECTIONS.length]];
    const limits = branchDirections.map((direction) => maxCellsInDirection(forkPoint, direction, columns, rows));
    if (!inBounds(forkPoint, columns, rows) || limits.some((limit) => limit < PULSE_CONFIG.minBranchCells)) continue;
    parent.fork = { ...forkPoint, cellsFromStart: forkCells, t: forkCells / parent.cells };
    const children = branchDirections.map((direction, index) => {
      const cells = pickCells(PULSE_CONFIG.minBranchCells, Math.min(PULSE_CONFIG.maxBranchCells, limits[index]), random);
      return { id: nextId++, start: forkPoint, end: move(forkPoint, direction, cells), direction, cells, depth: parent.depth + 1, parentId: parent.id, fork: null };
    });
    segments.push(...children); queue.push(...children);
  }
  return segments;
}

export function assignPulseTimeline(segments, travelMs) {
  const byId = new Map(); const timed = segments.map((segment) => ({ ...segment })); timed.forEach((segment) => byId.set(segment.id, segment));
  timed.forEach((segment) => { segment.arrivalCells = segment.parentId === null ? 0 : byId.get(segment.parentId).arrivalCells + byId.get(segment.parentId).fork.cellsFromStart; segment.completeCells = segment.arrivalCells + segment.cells; });
  const longest = Math.max(...timed.map(({ completeCells }) => completeCells)); const msPerCell = travelMs / longest;
  timed.forEach((segment) => { segment.startMs = segment.arrivalCells * msPerCell; segment.durationMs = segment.cells * msPerCell; segment.endMs = segment.startMs + segment.durationMs; });
  return { segments: timed, waveEndMs: Math.max(...timed.map(({ endMs }) => endMs)) };
}

export function trailState(segment, elapsed, config = PULSE_CONFIG) {
  const rawHead = (elapsed - segment.startMs) / segment.durationMs;
  if (rawHead < 0 || elapsed >= segment.endMs + config.fadeDuration) return { visible: false, from: 0, to: 0, alpha: 0 };
  const head = Math.min(1, rawHead); const tail = Math.max(0, head - config.trailCells / segment.cells); const afterEnd = Math.max(0, elapsed - segment.endMs);
  return { visible: true, from: tail, to: head, alpha: .9 * (1 - afterEnd / config.fadeDuration) ** 2 };
}

export function createPulse(width, height, random = Math.random) {
  const { gridSize, minCells, minDuration, maxDuration } = PULSE_CONFIG; const columns = Math.floor(width / gridSize); const rows = Math.floor(height / gridSize);
  if (columns < minCells * 2 + 3 || rows < minCells * 2 + 3) return null;
  const root = createRoot(columns, rows, random); if (!root) return null;
  const rawSegments = branchSegments(root, columns, rows, random); const pixelSegments = rawSegments.map((segment) => ({ ...segment, start: { x: segment.start.column * gridSize, y: segment.start.row * gridSize }, end: { x: segment.end.column * gridSize, y: segment.end.row * gridSize }, fork: segment.fork && { x: segment.fork.column * gridSize, y: segment.fork.row * gridSize, cellsFromStart: segment.fork.cellsFromStart, t: segment.fork.t } }));
  const duration = pickCells(minDuration, maxDuration, random); const timeline = assignPulseTimeline(pixelSegments, duration);
  return { start: timeline.segments[0].start, end: timeline.segments[0].end, cells: timeline.segments[0].cells, duration, ...timeline, fadeEndMs: timeline.waveEndMs + PULSE_CONFIG.fadeDuration };
}

export function initLabAmbient() {
  const canvas = document.querySelector('#lab-signal-field'); const context = canvas?.getContext('2d'); if (!context) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)'); const desktop = matchMedia('(min-width: 761px)');
  let width = 0; let height = 0; let frame = 0; let palette = {}; let pulses = []; const timers = new Set();
  const canAnimate = () => !document.hidden && !reducedMotion.matches && desktop.matches;
  const refreshPalette = () => { const style = getComputedStyle(document.documentElement); palette = { pulse: style.getPropertyValue('--ambient-pulse').trim(), glow: style.getPropertyValue('--ambient-glow').trim() }; };
  const clear = () => { cancelAnimationFrame(frame); timers.forEach(clearTimeout); timers.clear(); frame = 0; pulses = []; context.clearRect(0, 0, width, height); };
  const drawTrail = (start, end, from, to, alpha) => { const x = (amount) => start.x + (end.x - start.x) * amount; const y = (amount) => start.y + (end.y - start.y) * amount; const gradient = context.createLinearGradient(x(from), y(from), x(to), y(to)); gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, palette.pulse); context.globalAlpha = alpha; context.lineWidth = 1.5; context.strokeStyle = gradient; context.beginPath(); context.moveTo(x(from), y(from)); context.lineTo(x(to), y(to)); context.stroke(); };
  const drawPulse = (pulse, time) => { const elapsed = time - pulse.startedAt; pulse.segments.forEach((segment) => { const state = trailState(segment, elapsed); if (!state.visible) return; drawTrail(segment.start, segment.end, state.from, state.to, state.alpha); const x = segment.start.x + (segment.end.x - segment.start.x) * state.to; const y = segment.start.y + (segment.end.y - segment.start.y) * state.to; context.fillStyle = palette.glow; context.globalAlpha = state.alpha; context.beginPath(); context.arc(x, y, 2.2, 0, Math.PI * 2); context.fill(); }); return elapsed < pulse.fadeEndMs; };
  const animate = (time) => { frame = 0; if (!canAnimate()) return clear(); context.clearRect(0, 0, width, height); pulses = pulses.filter((pulse) => drawPulse(pulse, time)); context.globalAlpha = 1; if (pulses.length) frame = requestAnimationFrame(animate); schedule(); };
  const requestFrame = () => { if (!frame && pulses.length) frame = requestAnimationFrame(animate); };
  const schedule = () => { if (!canAnimate() || pulses.length + timers.size >= PULSE_CONFIG.maxConcurrent) return; const delay = PULSE_CONFIG.minDelay + Math.random() * (PULSE_CONFIG.maxDelay - PULSE_CONFIG.minDelay); const timer = setTimeout(() => { timers.delete(timer); if (!canAnimate()) return; const next = createPulse(width, height); if (next) { pulses.push({ ...next, startedAt: performance.now() }); requestFrame(); } schedule(); }, delay); timers.add(timer); };
  const resize = () => { width = innerWidth; height = innerHeight; const ratio = pixelRatioFor(width, height, devicePixelRatio || 1); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); context.setTransform(ratio, 0, 0, ratio, 0, 0); clear(); schedule(); };
  addEventListener('resize', resize); document.addEventListener('visibilitychange', () => document.hidden ? clear() : schedule()); document.addEventListener('labs-themechange', refreshPalette); reducedMotion.addEventListener('change', () => reducedMotion.matches ? clear() : schedule()); desktop.addEventListener('change', () => desktop.matches ? resize() : clear()); refreshPalette(); resize();
}
