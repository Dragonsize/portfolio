export const PULSE_CONFIG = Object.freeze({ gridSize: 32, minCells: 4, maxCells: 10, minDelay: 350, maxDelay: 1000, minDuration: 700, maxDuration: 1100, maxConcurrent: 3, maxDeviceRatio: 1.25, maxCanvasPixels: 1250000 });

export function pixelRatioFor(width, height, deviceRatio = 1) {
  if (!width || !height) return 1;
  return Math.min(deviceRatio || 1, PULSE_CONFIG.maxDeviceRatio, Math.sqrt(PULSE_CONFIG.maxCanvasPixels / (width * height)));
}

export function createPulse(width, height, random = Math.random) {
  const { gridSize, minCells, maxCells, minDuration, maxDuration } = PULSE_CONFIG;
  const columns = Math.floor(width / gridSize); const rows = Math.floor(height / gridSize);
  if (columns < minCells * 2 + 3 || rows < minCells * 2 + 3) return null;
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const points = [];
  for (let row = 1; row < rows - 1; row += 1) for (let column = 1; column < columns - 1; column += 1) points.push({ column, row });
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const start = points[Math.floor(random() * points.length)]; const [xDirection, yDirection] = directions[Math.floor(random() * directions.length)]; const cells = minCells + Math.floor(random() * (maxCells - minCells + 1)); const end = { column: start.column + xDirection * cells, row: start.row + yDirection * cells };
    if (end.column < 1 || end.column >= columns - 1 || end.row < 1 || end.row >= rows - 1) continue;
    return { start: { x: start.column * gridSize, y: start.row * gridSize }, end: { x: end.column * gridSize, y: end.row * gridSize }, cells, duration: minDuration + Math.floor(random() * (maxDuration - minDuration + 1)) };
  }
  return null;
}

export function initLabAmbient() {
  const canvas = document.querySelector('#lab-signal-field'); const context = canvas?.getContext('2d'); if (!context) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)'); const desktop = matchMedia('(min-width: 761px)');
  let width = 0; let height = 0; let frame = 0; let palette = {}; let pulses = []; const timers = new Set();
  const canAnimate = () => !document.hidden && !reducedMotion.matches && desktop.matches;
  const refreshPalette = () => { const style = getComputedStyle(document.documentElement); palette = { pulse: style.getPropertyValue('--ambient-pulse').trim(), glow: style.getPropertyValue('--ambient-glow').trim() }; };
  const clear = () => { cancelAnimationFrame(frame); timers.forEach(clearTimeout); timers.clear(); frame = 0; pulses = []; context.clearRect(0, 0, width, height); };
  const drawSegment = (start, end, from, to, alpha, widthValue) => { const x = (amount) => start.x + (end.x - start.x) * amount; const y = (amount) => start.y + (end.y - start.y) * amount; context.globalAlpha = alpha; context.lineWidth = widthValue; context.beginPath(); context.moveTo(x(from), y(from)); context.lineTo(x(to), y(to)); context.stroke(); };
  const drawPulse = (pulse, time) => { const progress = Math.min(1, (time - pulse.startedAt) / pulse.duration); context.strokeStyle = palette.pulse; drawSegment(pulse.start, pulse.end, 0, 1, .12 * (1 - progress), .8); const tail = Math.max(0, progress - .18); drawSegment(pulse.start, pulse.end, tail, progress, .9 * (1 - progress * .35), 1.5); const x = pulse.start.x + (pulse.end.x - pulse.start.x) * progress; const y = pulse.start.y + (pulse.end.y - pulse.start.y) * progress; context.fillStyle = palette.glow; context.globalAlpha = .9 * (1 - progress * .3); context.beginPath(); context.arc(x, y, 2.2, 0, Math.PI * 2); context.fill(); return progress < 1; };
  const animate = (time) => { frame = 0; if (!canAnimate()) return clear(); context.clearRect(0, 0, width, height); pulses = pulses.filter((pulse) => drawPulse(pulse, time)); context.globalAlpha = 1; if (pulses.length) frame = requestAnimationFrame(animate); schedule(); };
  const requestFrame = () => { if (!frame && pulses.length) frame = requestAnimationFrame(animate); };
  const schedule = () => { if (!canAnimate() || pulses.length + timers.size >= PULSE_CONFIG.maxConcurrent) return; const delay = PULSE_CONFIG.minDelay + Math.random() * (PULSE_CONFIG.maxDelay - PULSE_CONFIG.minDelay); const timer = setTimeout(() => { timers.delete(timer); if (!canAnimate()) return; const next = createPulse(width, height); if (next) { pulses.push({ ...next, startedAt: performance.now() }); requestFrame(); } schedule(); }, delay); timers.add(timer); };
  const resize = () => { width = innerWidth; height = innerHeight; const ratio = pixelRatioFor(width, height, devicePixelRatio || 1); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); context.setTransform(ratio, 0, 0, ratio, 0, 0); clear(); schedule(); };
  addEventListener('resize', resize); document.addEventListener('visibilitychange', () => document.hidden ? clear() : schedule()); document.addEventListener('labs-themechange', refreshPalette); reducedMotion.addEventListener('change', () => reducedMotion.matches ? clear() : schedule()); desktop.addEventListener('change', () => desktop.matches ? resize() : clear()); refreshPalette(); resize();
}
