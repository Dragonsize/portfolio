import { PORTFOLIO } from './data.js';
import { createNetGlobe } from './net-globe.js';
import { locateVisitor } from './visitor-geo.js';
import { initTerminal } from './terminal.js';

let visitorGeo = null;

document.documentElement.classList.add('js');
const $ = (selector) => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function el(tag, text = '', className = '') {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function safeLink(label, href, className = '') {
  try {
    const url = new URL(href);
    if (!['https:', 'mailto:'].includes(url.protocol)) return null;
    const a = el('a', label, className);
    a.href = url.href;
    if (url.protocol === 'https:') { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  } catch { return null; }
}
const pad = (n) => String(n).padStart(2, '0');

/* theme */
const themeToggle = $('#theme-toggle');
function applyTheme(theme, persist = false) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = `[ theme: ${theme} ]`;
  themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  if (persist) { try { localStorage.setItem('portfolio-theme', theme); } catch {} }
  document.dispatchEvent(new Event('portfolio-themechange'));
}
function initialTheme() {
  try { const saved = localStorage.getItem('portfolio-theme'); if (saved === 'dark' || saved === 'light') return saved; } catch {}
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
const toggleTheme = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
themeToggle.addEventListener('click', toggleTheme);
applyTheme(initialTheme());
const cssPalette = () => {
  const s = getComputedStyle(document.documentElement);
  const v = (name) => s.getPropertyValue(name).trim();
  return { ink: v('--text'), accent: v('--accent'), alert: v('--meta'), bg: v('--bg') };
};

/* content */
function renderPortfolio() {
  const { identity, labs, stats, projects, competitions, certifications, education, skills, contacts, github, signal } = PORTFOLIO;
  $('#identity-summary').textContent = identity.summary;
  $('#labs-link').href = labs.href;
  $('#ticker-track').textContent = `${signal.join(' · ')} · `.repeat(4);

  const list = $('#project-list');
  const all = [{ ...labs, live: true, href: labs.href, linkLabel: 'open labs' }, ...projects.map((p) => ({ ...p, href: github, linkLabel: 'github' }))];
  all.forEach((p, i) => {
    const li = el('li', '', 'project');
    const title = el('div');
    title.append(el('h3', p.title));
    if (p.live) title.append(el('span', 'LIVE', 'project-tag'));
    const body = el('div');
    body.append(el('p', p.summary));
    const tags = el('ul', '', 'tags');
    p.tags.forEach((t) => tags.append(el('li', `#${t}`)));
    body.append(tags);
    li.append(el('span', `[${pad(i + 1)}]`, 'project-idx'), title, body);
    const link = safeLink(p.linkLabel, p.href, 'project-link');
    if (link) li.append(link);
    list.append(li);
  });

  $('#stats').replaceChildren(...stats.map((s) => {
    const item = el('div', '', 'stat');
    const value = el('b', s.value);
    value.dataset.count = s.value;
    item.append(value, el('span', s.label));
    return item;
  }));

  const logRow = (year, title, detail) => {
    const li = el('li');
    const text = el('div');
    text.append(el('b', title), el('span', detail));
    li.append(el('time', year), text);
    return li;
  };
  $('#experience-list').replaceChildren(...PORTFOLIO.experience.map((x) => logRow(x.period, `${x.role} · ${x.org}`, x.detail)));
  $('#competition-list').replaceChildren(...competitions.map((c) => logRow(c.year, c.result, c.name)));
  $('#cert-list').replaceChildren(...certifications.map((c) => logRow(c.year, c.name, c.detail)));
  $('#education').replaceChildren(logRow(`${education.period.split(' ')[0]}+`, education.school, education.detail));

  $('#skill-grid').replaceChildren(...skills.map((s) => {
    const card = el('article', '', 'skill');
    const items = el('ul');
    s.items.forEach((item) => items.append(el('li', item)));
    card.append(el('h3', s.title), items);
    return card;
  }));

  const email = contacts.find((c) => c.href.startsWith('mailto:'));
  if (email) { $('#contact-email').href = email.href; $('#contact-email').textContent = email.value; }
  $('#contact-links').replaceChildren(...contacts.filter((c) => c !== email).map((c) => safeLink(`> ${c.label.toLowerCase()} ↗`, c.href, 'btn')).filter(Boolean));
}

/* hero text effects */
function scramble(element, duration = 900) {
  const final = element.textContent;
  const glyphs = '!<>-_/[]{}=+*^?#01';
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const settled = Math.floor(p * final.length);
    element.textContent = [...final].map((ch, i) => (i < settled || ch === ' ' ? ch : glyphs[Math.floor(Math.random() * glyphs.length)])).join('');
    if (p < 1) requestAnimationFrame(step); else element.textContent = final;
  };
  requestAnimationFrame(step);
}
function typewriter(element, lines) {
  let line = 0, chars = lines[0].length, deleting = true;
  const step = () => {
    const text = lines[line];
    if (deleting) { chars -= 1; if (chars <= 0) { deleting = false; line = (line + 1) % lines.length; } }
    else { chars += 1; if (chars >= lines[line].length) deleting = true; }
    element.textContent = lines[line].slice(0, Math.max(chars, 0)) || '';
    const pause = !deleting && chars === 0 ? 300 : deleting && chars === text.length ? 2200 : deleting ? 28 : 55;
    setTimeout(step, pause);
  };
  setTimeout(step, 2600);
}
function countUp(element) {
  const match = /^(\d+(?:\.\d+)?)(.*)$/.exec(element.dataset.count);
  if (!match) return;
  const target = parseFloat(match[1]), decimals = (match[1].split('.')[1] || '').length, suffix = match[2];
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / 1100, 1), eased = 1 - (1 - p) ** 3;
    element.textContent = (target * eased).toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* terminal */
function setupTerminal() {
  return initTerminal({
    data: PORTFOLIO,
    drawer: $('#terminal-drawer'), output: $('#terminal-output'), input: $('#terminal-input'), form: $('#terminal-form'),
    promptLabel: $('#terminal-prompt'), trigger: $('#open-terminal'), closeButton: $('#close-terminal'),
    hooks: {
      scan: () => $('#net-globe')?.dispatchEvent(new MouseEvent('click')),
      toggleTheme,
      theme: () => document.documentElement.dataset.theme,
      getVisitor: () => visitorGeo,
      host: () => location.host || 'localhost',
      open: (href) => { const a = safeLink('', href); if (a) a.click(); }
    }
  });
}

/* scroll reveal + active nav */
function initScroll() {
  const reveal = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    if (!reducedMotion.matches) e.target.querySelectorAll('[data-count]').forEach(countUp);
    reveal.unobserve(e.target);
  }), { threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach((s) => reveal.observe(s));

  const links = new Map([...document.querySelectorAll('.nav-links a')].map((a) => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((a) => a.classList.remove('active'));
    links.get(e.target.id)?.classList.add('active');
  }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main > section').forEach((s) => spy.observe(s));
}

renderPortfolio();
setupTerminal();
initScroll();
if (!reducedMotion.matches) {
  document.querySelectorAll('[data-scramble]').forEach((n) => scramble(n));
  typewriter($('#typed-line'), PORTFOLIO.taglines);
}
const globe = createNetGlobe($('#net-globe'), { reducedMotion, status: $('#scan-status'), getPalette: cssPalette });
locateVisitor().then((geo) => { visitorGeo = geo; globe?.setVisitor(geo); });
