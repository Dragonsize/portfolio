// Wireframe "network globe" for the hero: host nodes, packet arcs, orbit rings, host tags, click-to-scan.
// Pure math helpers are exported for tests; createNetGlobe() touches the DOM only when called.

export const HOSTS = Object.freeze([
  { id: 'H1', lat: 52, lon: -28, ip: '10.0.1.12', port: '22/tcp', svc: 'ssh', flag: false },
  { id: 'H2', lat: 18, lon: 34, ip: '10.0.1.20', port: '443/tcp', svc: 'https', flag: false },
  { id: 'H3', lat: -14, lon: -52, ip: '10.0.2.7', port: '3306/tcp', svc: 'mysql', flag: true },
  { id: 'H4', lat: 30, lon: 112, ip: '10.0.2.31', port: '80/tcp', svc: 'http', flag: false },
  { id: 'H5', lat: -38, lon: 18, ip: '10.0.3.4', port: '21/tcp', svc: 'ftp', flag: true },
  { id: 'H6', lat: 4, lon: -140, ip: '10.0.3.18', port: '8080/tcp', svc: 'proxy', flag: false },
  { id: 'H7', lat: -48, lon: 150, ip: '10.0.4.9', port: '53/udp', svc: 'dns', flag: false },
  { id: 'H8', lat: 68, lon: 95, ip: '10.0.4.22', port: '25/tcp', svc: 'smtp', flag: false },
  { id: 'H9', lat: -6, lon: 72, ip: '10.0.5.2', port: '3389/tcp', svc: 'rdp', flag: true }
]);
export const LINKS = Object.freeze([[0, 1], [1, 3], [0, 2], [2, 4], [1, 4], [3, 7], [0, 7], [5, 2], [6, 4], [8, 1], [8, 6], [5, 0]]);

const DEG = Math.PI / 180;
export function spherePoint(latDeg, lonDeg, radius = 1) {
  const lat = latDeg * DEG, lon = lonDeg * DEG;
  return [radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)];
}
// yaw around Y, then pitch around X. +z points at the viewer.
export function rotate([x, y, z], yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}
// Perspective projection; distance is in sphere radii. A point at z=0 lands exactly `radius` px from centre.
export function project([x, y, z], { cx, cy, radius, distance }) {
  const scale = (radius * distance) / (distance - z);
  return { x: cx + x * scale, y: cy - y * scale, z };
}
// Great-circle arc between two unit vectors, lifted off the surface in the middle.
export function arcPoints(a, b, steps = 28, lift = 0.22) {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot), sin = Math.sin(omega) || 1;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, k = 1 + lift * Math.sin(Math.PI * t);
    const wa = Math.sin((1 - t) * omega) / sin, wb = Math.sin(t * omega) / sin;
    return [(a[0] * wa + b[0] * wb) * k, (a[1] * wa + b[1] * wb) * k, (a[2] * wa + b[2] * wb) * k];
  });
}
// Tilted circle around the origin: radius r, tipped by tiltX (about X) then tiltZ (about Z).
export function orbitPoints(r, tiltX, tiltZ, steps = 96) {
  const cx = Math.cos(tiltX), sx = Math.sin(tiltX), cz = Math.cos(tiltZ), sz = Math.sin(tiltZ);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y1 = -z * sx, z1 = z * cx;
    return [x * cz - y1 * sz, x * sz + y1 * cz, z1];
  });
}
// Indices of the `count` points closest (by angle) to `from` on the unit sphere.
export function nearestHosts(from, points, count) {
  return points.map((p, i) => [p[0] * from[0] + p[1] * from[1] + p[2] * from[2], i]).sort((a, b) => b[0] - a[0]).slice(0, count).map(([, i]) => i);
}
// Spread tag y positions so they never overlap.
export function spreadLabels(ys, gap, min = -Infinity) {
  const order = ys.map((y, i) => [y, i]).sort((p, q) => p[0] - q[0]);
  const out = new Array(ys.length);
  let last = min - gap;
  order.forEach(([y, i]) => { last = Math.max(y, last + gap); out[i] = last; });
  return out;
}

export function createNetGlobe(canvas, { reducedMotion, status, getPalette } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const hosts = HOSTS.map((h) => ({ ...h, pos: spherePoint(h.lat, h.lon) }));
  const arcs = LINKS.map(([a, b], i) => ({ points: arcPoints(hosts[a].pos, hosts[b].pos), speed: 0.00018 + (i % 4) * 0.00005, offset: i * 0.173 }));
  const lats = [-60, -30, 0, 30, 60].map((lat) => Array.from({ length: 73 }, (_, i) => spherePoint(lat, i * 5)));
  const lons = Array.from({ length: 12 }, (_, m) => Array.from({ length: 37 }, (_, i) => spherePoint(-90 + i * 5, m * 30)));
  const orbits = [
    { points: orbitPoints(1.42, 1.15, 0.35), speed: 0.00012 },
    { points: orbitPoints(1.62, 1.35, -0.5), speed: -0.00008 }
  ];

  const view = { cx: 0, cy: 0, radius: 0, distance: 3.4, width: 0, height: 0, compact: false };
  const pointer = { x: 0.5, y: 0.5, px: -1e4, py: -1e4 };
  let yaw = 0.4, pitch = 0.32, spin = 0, frame = 0, visible = true, hovered = -1, visitorHover = false;
  let visitor = null;
  let palette = { ink: '#ece6f5', accent: '#a78bfa', alert: '#d68ae5', bg: '#06040c' };
  const scan = { state: 'idle', start: 0, done: new Set() };
  const refreshPalette = () => { if (getPalette) palette = { ...palette, ...getPalette() }; };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    view.width = rect.width; view.height = rect.height;
    canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    view.compact = rect.width < 900;
    if (view.compact) { view.cx = rect.width * 0.5; view.cy = rect.height * 0.34; view.radius = Math.min(rect.width * 0.34, rect.height * 0.2); }
    else { view.cx = rect.width * 0.71; view.cy = rect.height * 0.45; view.radius = Math.min(rect.height * 0.26, rect.width * 0.16); }
  };

  const strokeLine = (points, frontAlpha, backAlpha, color, dash = []) => {
    const front = new Path2D(), back = new Path2D();
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const path = (a.z + b.z) / 2 > -0.05 ? front : back;
      path.moveTo(a.x, a.y); path.lineTo(b.x, b.y);
    }
    ctx.setLineDash(dash); ctx.strokeStyle = color;
    ctx.globalAlpha = backAlpha; ctx.stroke(back);
    ctx.globalAlpha = frontAlpha; ctx.stroke(front);
    ctx.globalAlpha = 1; ctx.setLineDash([]);
  };
  const toScreen = (p) => project(rotate(p, yaw, pitch), view);
  const pointOn = (pts, u) => {
    const v = (((u % 1) + 1) % 1) * (pts.length - 1), i = Math.floor(v), f = v - i;
    const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
  };
  const tag = (text, x, y, color, align = 'right') => {
    const w = ctx.measureText(text).width + 14, left = align === 'right' ? x - w : x;
    ctx.globalAlpha = 0.85; ctx.fillStyle = palette.bg; ctx.fillRect(left, y - 10, w, 20);
    ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.strokeRect(left + 0.5, y - 9.5, w - 1, 19);
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, left + 7, y + 0.5);
    return left;
  };

  const setStatus = (text) => { if (status) status.textContent = text; };
  const scanProgress = (time) => {
    if (scan.state !== 'running') return null;
    const p = reducedMotion?.matches ? 1 : Math.min((time - scan.start) / 1900, 1);
    const lat = 90 - 180 * p;
    hosts.forEach((h, i) => { if (h.lat >= lat) scan.done.add(i); });
    setStatus(`[ scan ] sweeping · ${String(scan.done.size).padStart(2, '0')}/${String(hosts.length).padStart(2, '0')} hosts`);
    if (p >= 1) {
      scan.state = 'done';
      setStatus(`[ scan ] done · ${hosts.length} up · ${hosts.filter((h) => h.flag).length} flagged · click to reset`);
      return null;
    }
    return lat;
  };

  const draw = (time) => {
    const { width, height, cx, cy, radius } = view;
    const { ink, accent, alert } = palette;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';

    // halo + silhouette
    const silhouette = radius * view.distance / Math.sqrt(view.distance ** 2 - 1);
    ctx.globalAlpha = 0.07; ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(cx, cy, silhouette, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.7; ctx.strokeStyle = accent; ctx.lineWidth = 1.3; ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = 1;

    // graticule
    lats.forEach((line) => strokeLine(line.map(toScreen), 0.4, 0.08, ink));
    lons.forEach((line) => strokeLine(line.map(toScreen), 0.28, 0.06, ink));

    // orbit rings with satellites
    orbits.forEach((orbit, k) => {
      const pts = orbit.points.map(toScreen);
      strokeLine(pts, 0.55, 0.15, accent, [3, 6]);
      if (reducedMotion?.matches) return;
      const s = pointOn(pts, time * orbit.speed + k * 0.5);
      ctx.globalAlpha = s.z > -0.05 ? 1 : 0.3; ctx.fillStyle = accent;
      ctx.beginPath(); ctx.moveTo(s.x, s.y - 4); ctx.lineTo(s.x + 4, s.y); ctx.lineTo(s.x, s.y + 4); ctx.lineTo(s.x - 4, s.y); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // scan ring
    const scanLat = scanProgress(time);
    if (scanLat !== null) {
      const ring = Array.from({ length: 73 }, (_, i) => spherePoint(scanLat, i * 5, 1.01)).map(toScreen);
      ctx.lineWidth = 2; strokeLine(ring, 1, 0.3, alert); ctx.lineWidth = 1;
    }

    // packet arcs
    arcs.forEach((arc) => {
      const pts = arc.points.map(toScreen);
      strokeLine(pts, 0.45, 0.08, accent, [2, 4]);
      if (reducedMotion?.matches) return;
      const p = pointOn(pts, time * arc.speed + arc.offset);
      ctx.globalAlpha = p.z > -0.05 ? 1 : 0.25; ctx.fillStyle = alert;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // visitor links
    if (visitor) visitor.arcs.forEach((arc) => {
      const pts = arc.points.map(toScreen);
      strokeLine(pts, 0.7, 0.12, alert, [4, 4]);
      if (reducedMotion?.matches) return;
      const p = pointOn(pts, time * arc.speed + arc.offset);
      ctx.globalAlpha = p.z > -0.05 ? 1 : 0.25; ctx.fillStyle = alert;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    });

    // hosts
    const screens = hosts.map((h) => toScreen(h.pos));
    const you = visitor ? toScreen(visitor.pos) : null;
    hovered = -1;
    let best = 18;
    screens.forEach((s, i) => { const d = Math.hypot(s.x - pointer.px, s.y - pointer.py); if (s.z > 0 && d < best) { best = d; hovered = i; } });
    visitorHover = !!you && you.z > 0 && Math.hypot(you.x - pointer.px, you.y - pointer.py) < Math.min(best, 18);
    if (visitorHover) hovered = -1;
    screens.forEach((s, i) => {
      const front = s.z > -0.05, scanned = scan.done.has(i), hot = scanned && hosts[i].flag;
      const color = hot ? alert : i === hovered ? accent : ink, size = i === hovered ? 5.5 : 3.5;
      ctx.globalAlpha = front ? 1 : 0.25; ctx.strokeStyle = color; ctx.fillStyle = palette.bg;
      ctx.fillRect(s.x - size, s.y - size, size * 2, size * 2); ctx.strokeRect(s.x - size + 0.5, s.y - size + 0.5, size * 2 - 1, size * 2 - 1);
      if (scanned) { ctx.fillStyle = color; ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3); }
      ctx.globalAlpha = 1;
    });

    // visitor marker
    if (you) {
      const front = you.z > -0.05;
      ctx.globalAlpha = front ? 1 : 0.3; ctx.strokeStyle = alert; ctx.fillStyle = alert;
      if (!reducedMotion?.matches && front) {
        const p = (time % 1800) / 1800;
        ctx.globalAlpha = 0.8 * (1 - p); ctx.beginPath(); ctx.arc(you.x, you.y, 5 + p * 18, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath(); ctx.moveTo(you.x, you.y - 6); ctx.lineTo(you.x + 6, you.y); ctx.lineTo(you.x, you.y + 6); ctx.lineTo(you.x - 6, you.y); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      if (you.z > 0.1) {
        ctx.strokeStyle = alert; ctx.beginPath(); ctx.moveTo(you.x - 6, you.y - 6); ctx.lineTo(you.x - 16, you.y - 18); ctx.stroke();
        tag(visitor.label, you.x - 16, you.y - 18, alert, 'right');
      }
    }

    // boxed host tags on the right for front-facing hosts
    if (!view.compact) {
      const edge = Math.min(width - 24, cx + radius * 1.95);
      const front = screens.map((s, i) => [s, i]).filter(([s]) => s.z > 0.15 && s.x < edge - 150).slice(0, 5);
      const ys = spreadLabels(front.map(([s]) => s.y), 28, 100);
      front.forEach(([s, i], k) => {
        const h = hosts[i], y = ys[k], rtt = (12 + 9 * Math.sin(time * 0.0013 + i * 1.7) + i).toFixed(1);
        const color = scan.done.has(i) && h.flag ? alert : accent;
        ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
        const left = edge - ctx.measureText(`${h.id} ${h.port} ${rtt}ms`).width - 14;
        ctx.globalAlpha = 0.5; ctx.strokeStyle = color; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(s.x + 6, s.y); ctx.lineTo((s.x + left) / 2, y); ctx.lineTo(left, y); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        tag(`${h.id} ${h.port} ${rtt}ms`, edge, y, color);
      });
    }

    // hovered host detail
    if (hovered >= 0) {
      const s = screens[hovered], h = hosts[hovered];
      const state = scan.done.has(hovered) ? (h.flag ? 'open · review' : 'open · ok') : 'unscanned';
      const text = `${h.ip} ${h.svc} ${state}`;
      const x = view.compact ? Math.max(12, s.x - 110) : s.x - 40;
      ctx.strokeStyle = accent; ctx.beginPath(); ctx.moveTo(s.x, s.y + 6); ctx.lineTo(s.x, s.y + 22); ctx.stroke();
      tag(text, x, s.y + 32, h.flag && scan.done.has(hovered) ? alert : accent, 'left');
    }
    canvas.style.cursor = hovered >= 0 || visitorHover ? 'pointer' : 'crosshair';
  };

  const tick = (time) => {
    frame = 0;
    const targetYaw = spin + (pointer.x - 0.5) * 1.3;
    const targetPitch = 0.32 + (pointer.y - 0.5) * 0.55;
    yaw += (targetYaw - yaw) * 0.06; pitch += (targetPitch - pitch) * 0.06;
    spin += 0.002;
    draw(time);
    schedule();
  };
  const schedule = () => { if (!frame && visible && !document.hidden && !reducedMotion?.matches) frame = requestAnimationFrame(tick); };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };
  const redrawStatic = () => { if (reducedMotion?.matches) { yaw = 0.4 + (pointer.x - 0.5) * 1.3; pitch = 0.32 + (pointer.y - 0.5) * 0.55; draw(performance.now()); } };

  addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = Math.min(Math.max(e.clientX / innerWidth, 0), 1);
    pointer.y = Math.min(Math.max(e.clientY / innerHeight, 0), 1);
    pointer.px = e.clientX - rect.left; pointer.py = e.clientY - rect.top;
    redrawStatic();
  }, { passive: true });
  canvas.addEventListener('click', () => {
    if (scan.state === 'running') return;
    if (scan.state === 'done') { scan.state = 'idle'; scan.done.clear(); setStatus('[ scan ] idle · click the globe'); }
    else { scan.state = 'running'; scan.start = performance.now(); }
    redrawStatic();
  });
  addEventListener('resize', () => { resize(); draw(performance.now()); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : schedule()));
  document.addEventListener('portfolio-themechange', () => { refreshPalette(); draw(performance.now()); });
  reducedMotion?.addEventListener?.('change', () => (reducedMotion.matches ? (stop(), redrawStatic()) : schedule()));
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? schedule() : stop(); }).observe(canvas);

  const setVisitor = (geo) => {
    if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) return;
    const pos = spherePoint(geo.lat, geo.lon);
    const nearest = nearestHosts(pos, hosts.map((h) => h.pos), 3);
    const place = [geo.city, geo.country].filter(Boolean).join(', ').toUpperCase() || 'UNKNOWN';
    visitor = {
      pos, source: geo.source === 'ip' ? 'ip' : 'timezone', label: `YOU · ${place}`,
      arcs: nearest.map((i, k) => ({ points: arcPoints(pos, hosts[i].pos, 28, 0.3), speed: 0.00035 + k * 0.00006, offset: k * 0.33 }))
    };
    spin = -geo.lon * DEG; // turn the globe so the visitor starts facing the viewer
    draw(performance.now());
  };

  refreshPalette(); resize(); draw(performance.now()); schedule();
  return { resize, setVisitor };
}
