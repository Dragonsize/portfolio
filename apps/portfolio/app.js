import { buildMesh, CUBE, OCTAHEDRON, TETRAHEDRON, DIAMOND, ICOSAHEDRON, HEX_PRISM, classifyProjectedLink, createSphereMesh, pointHitsProjectedTriangles, projectPoint, unprojectPoint, MESH_POOL, randomMesh } from './ambient-geometry.js';

const PORTFOLIO = {
  identity: { handle: 'Dragonsize', name: 'Naven Tran', role: 'Cybersecurity-focused Computer Science student', availability: 'Contact through verified public channels below.', summary: 'Computer Science student focused on cybersecurity, building Python security tools and completing hands-on labs.', footerNotice: 'Security work shown for authorized, legal learning only.' },
  labs: { href: 'https://labs-naventran.vercel.app/', label: 'OPEN LEARNING LABS' },
  skills: [{ title: 'Web security testing', detail: 'SQLi, XSS, and authentication testing in legal lab and CTF environments.' }, { title: 'Network analysis & auditing', detail: 'Python tooling for TCP service discovery and baseline audit checks.' }, { title: 'Development & systems', detail: 'Python, JavaScript, HTML/CSS, C, C++, Linux, Git, and Postman.' }],
  projects: [{ title: 'Real-Time Messaging Platform', summary: 'Node.js, Express, WebSockets, and Supabase PostgreSQL.', description: 'Real-time messaging application built around Node.js and Express, using WebSockets for live communication and Supabase PostgreSQL for persistence.', tags: ['Node.js', 'Express', 'WebSockets', 'Supabase'] }, { title: 'CTF Image Forensics Toolkit', summary: 'Bash-based structured image triage and reporting toolkit.', description: 'Bash toolkit for CTF image-forensics workflows. It organizes repeatable triage steps and produces structured findings for authorized challenge analysis.', tags: ['Bash', 'CTF', 'Image forensics'] }, { title: 'Network Audit Scanner', summary: 'Concurrent Python TCP scanner and baseline audit checker.', description: 'Python tool for authorized network assessment. It performs concurrent TCP service discovery and checks results against baseline audit expectations.', tags: ['Python', 'Network auditing', 'TCP'] }],
  competitions: [{ competition: 'Municipal Academic Excellence Award', placement: 'Third Prize', year: '2025' }, { competition: 'IT-Zone’s Software Contest', placement: 'First Prize', year: '2026' }, { competition: 'IT-Zone’s Software Contest', placement: 'Best Individual', year: '2026' }],
  certifications: [{ name: 'IELTS 7.5', fullName: 'IELTS Certificate — Band 7.5', issuer: 'IELTS', year: '2025' }, { name: 'OPSWAT', fullName: 'Introduction to Critical Infrastructure Protection', issuer: 'OPSWAT', year: '2026' }],
  experience: [{ period: '2025–Present', role: 'Computer Science student', organization: 'Ton Duc Thang University', description: 'Major in Computer Science.' }],
  contacts: [{ label: 'GitHub: Dragonsize', href: 'https://github.com/Dragonsize' }, { label: 'Email: tranphate@gmail.com', href: 'mailto:tranphate@gmail.com' }]
};
const $ = (selector) => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktopPointer = matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)');
const themeToggle = $('#theme-toggle');
function applyTheme(theme, persist = false) { document.documentElement.dataset.theme = theme; themeToggle.textContent = `[ theme: ${theme} ]`; themeToggle.setAttribute('aria-pressed', String(theme === 'dark')); themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`); if (persist) try { localStorage.setItem('portfolio-theme', theme); } catch {} document.dispatchEvent(new Event('portfolio-themechange')); }
function initialTheme() { try { const saved = localStorage.getItem('portfolio-theme'); if (saved === 'dark' || saved === 'light') return saved; } catch {} return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
themeToggle.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
applyTheme(initialTheme());
function node(tag, text = '', className = '') { const element = document.createElement(tag); element.textContent = text; element.className = className; return element; }
function externalLink(label, href, className = '') { try { const parsed = new URL(href); if (!['https:', 'mailto:'].includes(parsed.protocol)) return null; const link = node('a', label, className); link.href = parsed.href; if (parsed.protocol === 'https:') { link.target = '_blank'; link.rel = 'noopener noreferrer'; } return link; } catch { return null; } }
function renderPortfolio() {
  document.title = `${PORTFOLIO.identity.handle} — Portfolio`;

  // Ticker
  const ticker = $('#ticker-track');
  const signal = 'SECURITY RESEARCH · NETWORK AUDITING · CTF PRACTICE · PYTHON TOOLS · AUTHORIZED LEARNING · ';
  if (ticker) ticker.textContent = signal.repeat(2);
  const tickerSummary = $('#ticker-summary');
  if (tickerSummary) tickerSummary.textContent = signal.trim();

  // Identity
  $('#identity-name').textContent = PORTFOLIO.identity.name;
  $('#identity-role').textContent = PORTFOLIO.identity.role;
  $('#identity-summary').textContent = PORTFOLIO.identity.summary;
  $('#identity-availability').textContent = PORTFOLIO.identity.availability;
  $('#footer-notice').textContent = PORTFOLIO.identity.footerNotice;

  // Hero transcript
  $('#hero-transcript').replaceChildren(
    ...[['handle', PORTFOLIO.identity.handle], ['role', PORTFOLIO.identity.role], ['status', PORTFOLIO.identity.availability]]
      .map(([label, value]) => node('p', `${label}: ${value}`))
  );

  // Labs link
  const labs = $('#labs-link');
  labs.href = PORTFOLIO.labs.href;
  labs.textContent = `> ${PORTFOLIO.labs.label}`;

  // Skills tabs + panel
  const tabs = $('#skill-tabs');
  const panel = $('#skill-panel');
  const selectSkill = (index) => {
    const skill = PORTFOLIO.skills[index];
    const preserved = panel.querySelectorAll('.skill-meter');
    panel.replaceChildren(node('h3', skill.title), node('p', skill.detail));
    [...tabs.children].forEach((button, buttonIndex) => {
      button.setAttribute('aria-selected', String(buttonIndex === index));
      button.tabIndex = buttonIndex === index ? 0 : -1;
    });
    preserved.forEach(m => panel.append(m));
  };
  PORTFOLIO.skills.forEach((skill, index) => {
    const button = node('button', `[${index + 1}] ${skill.title}`, 'skill-tab');
    button.type = 'button';
    button.role = 'tab';
    button.addEventListener('click', () => selectSkill(index));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? PORTFOLIO.skills.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + PORTFOLIO.skills.length) % PORTFOLIO.skills.length;
      selectSkill(next);
      tabs.children[next].focus();
    });
    tabs.append(button);
  });
  selectSkill(0);

  // Skill meters in panel
  const skillMeterValues = [85, 70, 75];
  PORTFOLIO.skills.forEach((skill, index) => {
    const meter = node('div', '', 'skill-meter');
    const fill = node('div', '', 'skill-meter-fill');
    fill.setAttribute('data-fill', skillMeterValues[index]);
    meter.append(fill);
    panel.append(meter);
  });

  // Projects
  const projects = $('#project-grid');
  PORTFOLIO.projects.forEach((project) => {
    const card = node('article', '', 'card');
    const details = document.createElement('details');
    details.append(node('summary', '> VIEW DETAILS'), node('p', project.description));
    card.append(node('h3', project.title), node('p', project.summary), details);
    const tags = node('div', '', 'tags');
    project.tags.forEach((tag) => tags.append(node('span', `#${tag}`)));
    card.append(tags);
    projects.append(card);
  });

  // Competitions
  const competitionBody = $('#competition-table-body');
  PORTFOLIO.competitions.forEach((item) => {
    const row = document.createElement('tr');
    [item.competition, item.placement, item.year].forEach((value) => row.append(node('td', value)));
    competitionBody.append(row);
  });

  // Certifications (with cert-badge for pulse animation)
  const certs = $('#cert-grid');
  PORTFOLIO.certifications.forEach((cert) => {
    const card = node('article', '', 'card cert-badge');
    card.append(node('h3', cert.name), node('p', cert.fullName), node('p', `${cert.issuer} · ${cert.year}`, 'muted'));
    certs.append(card);
  });

  // Experience
  const experience = $('#experience-list');
  PORTFOLIO.experience.forEach((item) => {
    const row = node('li', '', 'timeline-item');
    row.append(node('h3', `${item.period} — ${item.role}`), node('p', item.organization), node('p', item.description, 'muted'));
    experience.append(row);
  });

  // Contacts
  const contacts = $('#contact-links');
  PORTFOLIO.contacts.forEach((item) => {
    const link = externalLink(item.label, item.href, 'contact-link');
    if (link) contacts.append(link);
  });
}
function initTerminal() { const drawer = $('#terminal-drawer'); const output = $('#terminal-output'); const input = $('#terminal-input'); const open = () => { drawer.classList.add('is-open'); drawer.inert = false; drawer.setAttribute('aria-hidden', 'false'); input.focus(); }; const close = () => { drawer.classList.remove('is-open'); drawer.inert = true; drawer.setAttribute('aria-hidden', 'true'); $('#open-terminal').focus(); }; $('#open-terminal').addEventListener('click', open); $('#close-terminal').addEventListener('click', close); $('#terminal-form').addEventListener('submit', (event) => { event.preventDefault(); const value = input.value.trim(); if (!value) return; output.append(Object.assign(document.createElement('p'), { textContent: `visitor@portfolio:~$ ${value}` }), Object.assign(document.createElement('p'), { textContent: value === 'help' ? 'Commands: help, about, projects, contact, clear' : value === 'clear' ? '' : 'command not found' })); if (value === 'clear') output.replaceChildren(); input.value = ''; }); }
function initAmbientScene() {
  const canvas = $('#signal-field'); const context = canvas?.getContext('2d'); if (!context) return;

  const sphereMesh = createSphereMesh(4, 7);
  const meshPool = [CUBE, TETRAHEDRON, OCTAHEDRON, DIAMOND, ICOSAHEDRON, HEX_PRISM, sphereMesh];
  const allMeshes = meshPool.slice();

  const rand = (min, max) => min + Math.random() * (max - min);
  const pickMesh = (exclude) => { let i; do { i = Math.floor(Math.random() * allMeshes.length); } while (allMeshes[i] === exclude && allMeshes.length > 1); return i; };

  // factory: 5-7 shapes spread across canvas, each with random mesh type
  const meshTypeRng = () => Math.floor(Math.random() * meshPool.length);
  const initialCount = 5 + Math.floor(Math.random() * 3); // 5-7
  const shapes = [...Array(initialCount)].map(() => {
    const m = meshTypeRng();
    return {
      x: rand(-6, 6), y: rand(-4.5, 4.5),
      vx: rand(0.8, 2.5) * (Math.random() < .5 ? 1 : -1), vy: rand(0.5, 1.5) * (Math.random() < .5 ? 1 : -1),
      depth: rand(7, 12), size: rand(.4, 1.2),
      meshType: m, rotX: rand(0, 6), rotY: rand(0, 6), rotZ: rand(0, 6),
      angX: rand(.0002, .0006), angY: rand(.0002, .0006), angZ: rand(.0001, .0004)
    };
  });

  const nodes = [{ x: -3.7, y: 1.8, z: 11 }, { x: -1.8, y: .7, z: 9 }, { x: .5, y: 1.5, z: 12 }, { x: 3.2, y: .4, z: 9 }, { x: -3.1, y: -1.7, z: 11 }, { x: -.7, y: -1.2, z: 8 }, { x: 1.8, y: -1.8, z: 12 }, { x: 4, y: -1, z: 10 }];
  const links = [[0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [4, 5], [5, 6], [6, 7], [3, 7], [2, 6]];

  let width = 0, height = 0, ratio = 1, frame = 0, last = 0, palette = {};
  const camera = { width: 0, height: 0, focal: 0, near: .1 };

  const canAnimate = () => !document.hidden && !reducedMotion.matches && desktopPointer.matches;
  const refreshPalette = () => { const s = getComputedStyle(document.documentElement); palette = { line: s.getPropertyValue('--ambient-line').trim(), face: s.getPropertyValue('--ambient-face').trim(), edge: s.getPropertyValue('--ambient-edge').trim(), glow: s.getPropertyValue('--ambient-glow').trim() }; };

  const pt = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
  const drawLink = (a, b, alpha, dashed) => { context.setLineDash(dashed ? [4, 5] : []); context.globalAlpha = alpha; context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke(); };

  const meshBounds = (faces) => { const pts = faces.flat(); return { left: Math.min(...pts.map(p => p.x)), right: Math.max(...pts.map(p => p.x)), top: Math.min(...pts.map(p => p.y)), bottom: Math.max(...pts.map(p => p.y)) }; };
  const drawScans = (faces, bounds, index, time) => {
    const mid = Math.round((bounds.top + bounds.bottom) / 2) + .5;
    faces.forEach(points => {
      context.save();
      context.beginPath(); context.moveTo(points[0].x, points[0].y); points.slice(1).forEach(p => context.lineTo(p.x, p.y)); context.closePath(); context.clip();
      context.globalAlpha = .74; context.strokeStyle = palette.edge; context.setLineDash([]); context.beginPath(); context.moveTo(bounds.left - 2, mid); context.lineTo(bounds.right + 2, mid); context.stroke(); context.globalAlpha = .28; context.fillStyle = palette.line; context.fillRect(bounds.left - 2, mid - 4, bounds.right - bounds.left + 4, 1); context.fillRect(bounds.left - 2, mid + 4, bounds.right - bounds.left + 4, 1);
      context.restore();
    });
    if (reducedMotion.matches) return;
    const phase = (time + index * 1780) % (9300 + index * 1100);
    if (phase > 170) return;
    const alpha = .58 * (1 - phase / 170);
    [[-3, 2, 7], [0, 3, -6], [4, 1, 4]].forEach(([dy, h, dx]) => faces.forEach(points => {
      context.save();
      context.beginPath(); context.moveTo(points[0].x, points[0].y); points.slice(1).forEach(p => context.lineTo(p.x, p.y)); context.closePath(); context.clip(); context.beginPath(); context.rect(bounds.left, mid + dy, bounds.right - bounds.left, h); context.clip();
      context.globalAlpha = alpha; context.fillStyle = palette.glow; context.fillRect(bounds.left + dx, mid + dy, bounds.right - bounds.left, h);
      context.restore();
    }));
  };

  // s.x, s.y in world coords [-4, 4]; z from depth + size
  const posOf = (s) => ({ x: s.x, y: s.y, z: s.depth + s.size * 2 });
  const meshOf = (s, time) => buildMesh(meshPool[s.meshType], { position: posOf(s), size: s.size, rotation: { x: s.rotX + time * s.angX, y: s.rotY + time * s.angY, z: s.rotZ + time * s.angZ } });
  // bounce at world bounds — derived from canvas size for full viewport coverage
  let X_BOUND = 8.5, Y_BOUND = 6.5;
  const bounce = (s) => { if (s.x < -X_BOUND || s.x > X_BOUND) s.vx = -s.vx; if (s.y < -Y_BOUND || s.y > Y_BOUND) s.vy = -s.vy; s.x = Math.max(-X_BOUND, Math.min(X_BOUND, s.x)); s.y = Math.max(-Y_BOUND, Math.min(Y_BOUND, s.y)); };

  const maybeSlash = (time) => {};

  const waffleSlash = (s, time) => {
    if (!s.slash) return null;
    const t = (time - s.slash.startedAt) / 400; // 400ms vortex cycle
    if (t >= 1) { s.slash = null; return null; }
    // phase: 0-0.5 opening + destroy, 0.5-1 closing + reveal
    const phase = t < 0.5 ? 'open' : 'close';
    const half = t < 0.5 ? t * 2 : (t - 0.5) * 2; // 0-1 within half
    return { alpha: 1 - t * 0.6, phase, half, t };
  };

  const maybeWaffle = (s, time) => {
    if (s.slash) return;
    const sinceLast = time - (s.lastSlash || 0);
    const minWait = 4000 + Math.random() * 5000;
    if (sinceLast > minWait && Math.random() < .02) {
      s.slash = { startedAt: time, angle: Math.random() * Math.PI * 2, lines: Math.floor(3 + Math.random() * 4), triggered: false };
      s.lastSlash = time;
      s.justTriggered = true;
    }
  };

  const triggerWaffle = (s) => {
    if (!s.slash || s.slash.triggered) return;
    s.slash.triggered = true;
    s.meshType = pickMesh(allMeshes[s.meshType]);
    s.vx = rand(.8, 2.5) * (Math.random() < .5 ? 1 : -1);
    s.vy = rand(.5, 1.5) * (Math.random() < .5 ? 1 : -1);
    s.angX = rand(.0002, .0006); s.angY = rand(.0002, .0006); s.angZ = rand(.0001, .0004);
    s.size = rand(.4, 1.1);
    s.depth = rand(6, 12);
  };

  const drawVortex = (s, time, proj) => {
    const wp = s._wp;
    if (!wp) return;
    const { phase, half, alpha, t } = wp;
    const cx = proj.x, cy = proj.y;
    const isMidpoint = phase === 'close' && half < 0.05; // just crossed midpoint
    // vortex ring radius: grows on open, shrinks on close
    const maxR = Math.min(width, height) * 0.18;
    const r = phase === 'open' ? half * maxR : (1 - half) * maxR;
    const arms = 6, ringCount = 3;
    context.save();
    // spinning rings
    for (let ring = 0; ring < ringCount; ring++) {
      const ringR = r * (0.4 + ring * 0.3);
      const armAlpha = alpha * 0.55 * (1 - ring / ringCount);
      context.globalAlpha = armAlpha;
      context.strokeStyle = palette.glow;
      context.lineWidth = 2.5 - ring * 0.5;
      context.shadowColor = palette.glow;
      context.shadowBlur = 10;
      for (let a = 0; a < arms; a++) {
        const angle = (a / arms) * Math.PI * 2 + t * 12 + ring * 0.5; // spin
        const sweep = Math.PI * 0.55;
        context.beginPath();
        context.arc(cx, cy, ringR, angle, angle + sweep);
        context.stroke();
      }
    }
    // center flash at midpoint
    if (isMidpoint) {
      context.globalAlpha = 0.85;
      context.shadowColor = '#fff';
      context.shadowBlur = 25;
      context.fillStyle = '#fff';
      context.beginPath();
      context.arc(cx, cy, maxR * 0.35, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  };

  const draw = (time = performance.now()) => {
    if (!width) return;
    // move shapes in world coords — vx/vy are world-units per frame (~60fps)
    shapes.forEach(s => { s.x += s.vx / 60; s.y += s.vy / 60; bounce(s); maybeWaffle(s, time); s._wp = waffleSlash(s, time); });
    // separation: gently push apart when shapes overlap (tendency to spread out)
    for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i], b = shapes[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || .001;
      if (dist < 2.2) { const push = (2.2 - dist) / 60; const ux = dx / dist, uy = dy / dist; a.vx += ux * push; a.vy += uy * push; b.vx -= ux * push; b.vy -= uy * push; }
    }
    context.clearRect(0, 0, width, height);
    context.shadowBlur = 0; context.shadowColor = 'transparent'; context.lineWidth = .8;
    const meshes = shapes.map(s => meshOf(s, time));
    const triangles = meshes.flatMap(m => m.triangles);
    const projected = nodes.map(n => projectPoint(n, camera));
    const classified = links.map(([a, b]) => ({ a, b, fragments: projected[a] && projected[b] ? classifyProjectedLink({ a: nodes[a], b: nodes[b], screenA: projected[a], screenB: projected[b] }, triangles, camera) : [] }));
    context.lineWidth = .8; context.strokeStyle = palette.line;
    classified.forEach(({ a, b, fragments }) => fragments.filter(p => p.occluded).forEach(p => drawLink(pt(projected[a], projected[b], p.u0), pt(projected[a], projected[b], p.u1), .35, true)));
    meshes.forEach((mesh, index) => {
      const faces = mesh.faces.map(face => face.indices.map(v => projectPoint(mesh.vertices[v], camera))).filter(face => face.every(Boolean));
      if (!faces.length) return;
      const bounds = meshBounds(faces);
      const s = shapes[index];
      let meshAlpha = 1;
      if (s._wp) {
        // fade shape out during vortex open, in during close
        meshAlpha = s._wp.phase === 'open' ? (1 - s._wp.half) : s._wp.half;
        meshAlpha = Math.max(meshAlpha, 0.08); // never fully invisible
      }
      faces.forEach(face => { context.globalAlpha = .48 * meshAlpha; context.fillStyle = palette.face; context.beginPath(); context.moveTo(face[0].x, face[0].y); face.slice(1).forEach(p => context.lineTo(p.x, p.y)); context.closePath(); context.fill(); context.globalAlpha = .7 * meshAlpha; context.strokeStyle = palette.edge; context.setLineDash([]); context.stroke(); });
      drawScans(faces, bounds, index, time);
    });
    context.strokeStyle = palette.line;
    classified.forEach(({ a, b, fragments }) => fragments.filter(p => !p.occluded).forEach(p => drawLink(pt(projected[a], projected[b], p.u0), pt(projected[a], projected[b], p.u1), .62, false)));
    context.fillStyle = palette.edge; context.globalAlpha = .65; context.setLineDash([]);
    projected.forEach(p => { if (!p) return; context.beginPath(); context.arc(p.x, p.y, 1.6, 0, Math.PI * 2); context.fill(); });
    context.globalAlpha = 1;
    // draw per-shape vortex slash (open→destroy→close→reveal)
    shapes.forEach((s) => {
      if (s._wp) {
        const proj = projectPoint(posOf(s), camera);
        if (proj) drawVortex(s, time, proj);
        // trigger shape swap when vortex crosses midpoint (halfway through cycle)
        const { phase, half } = s._wp;
        if (phase === 'close' && half < 0.05) {
          s.justTriggered = true;
        }
      }
      if (s.justTriggered) { triggerWaffle(s); s.justTriggered = false; }
    });
  };

  const resize = () => { width = innerWidth; height = innerHeight; ratio = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(2000000 / (width * height))); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); context.setTransform(ratio, 0, 0, ratio, 0, 0); Object.assign(camera, { width, height, focal: Math.min(width, height) * .92 });
    // world bounds at screen edge, using representative depth 9 (mid of shape depth range)
    const refDepth = 9;
    X_BOUND = (width / 2) * refDepth / camera.focal;
    Y_BOUND = (height / 2) * refDepth / camera.focal;
    draw(); };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };
  const loop = (time) => { frame = 0; if (!canAnimate()) return; if (time - last >= 33) { last = time; draw(time); } frame = requestAnimationFrame(loop); };
  const schedule = () => { if (!frame && canAnimate()) frame = requestAnimationFrame(loop); };

  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : schedule());
  document.addEventListener('portfolio-themechange', () => { refreshPalette(); draw(); });
  reducedMotion.addEventListener('change', () => reducedMotion.matches ? (stop(), draw()) : schedule());
  desktopPointer.addEventListener('change', () => desktopPointer.matches ? (resize(), schedule()) : (stop(), context.clearRect(0, 0, width, height)));
  refreshPalette(); resize(); schedule();
}
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.panel[data-reveal]').forEach((panel) => observer.observe(panel));
}
renderPortfolio(); initTerminal(); initAmbientScene(); initScrollReveal();
