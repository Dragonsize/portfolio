import { CHALLENGES, challengeById } from './shared/challenge-registry.js';
import { ProgressStore } from './shared/progress-store.js';
import { initLabAmbient } from './ambient-pulse.js';
import { renderInteractiveLab } from './interactive-ui.js';

const store = new ProgressStore(CHALLENGES.map(({ id }) => id));
const grid = document.querySelector('#lab-grid');
const search = document.querySelector('#search');
const category = document.querySelector('#category');
const progress = document.querySelector('#progress');
const dialog = document.querySelector('#lab-dialog');
const content = document.querySelector('#lab-content');
const toast = document.querySelector('#toast');
const themeToggle = document.querySelector('#theme-toggle');
function initialTheme() { try { const saved = localStorage.getItem('labs-theme'); if (saved === 'dark' || saved === 'light') return saved; } catch {} return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
function applyTheme(theme, persist = false) { document.documentElement.dataset.theme = theme; themeToggle.textContent = `[ theme: ${theme} ]`; themeToggle.setAttribute('aria-pressed', String(theme === 'dark')); themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`); if (persist) try { localStorage.setItem('labs-theme', theme); } catch {} document.dispatchEvent(new Event('labs-themechange')); }
themeToggle.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
applyTheme(initialTheme());
initLabAmbient();
let activeChallenge = null;
let dialogOpener = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

function renderProgress() {
  progress.textContent = `${store.count()} / ${CHALLENGES.length} labs completed locally`;
  document.querySelector('.progress-bar')?.style.setProperty('--p', String(Math.round((store.count() / CHALLENGES.length) * 100)));
}

function renderStats() {
  document.querySelector('#stat-total').textContent = String(CHALLENGES.length);
  document.querySelector('#stat-live').textContent = String(CHALLENGES.filter((challenge) => challenge.interactive).length);
}

function initReveal() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) { targets.forEach((node) => node.classList.add('in')); return; }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); }
  }), { threshold: 0.08 });
  targets.forEach((node) => observer.observe(node));
}

function renderFilters() {
  [...new Set(CHALLENGES.map(({ category: value }) => value))].forEach((value) => {
    const option = el('option', '', value);
    option.value = value;
    category.append(option);
  });
}

function matches(challenge) {
  const term = search.value.trim().toLowerCase();
  const haystack = [challenge.title, challenge.category, challenge.description, challenge.difficulty].join(' ').toLowerCase();
  return (!term || haystack.includes(term)) && (!category.value || challenge.category === category.value);
}

function renderGrid() {
  grid.replaceChildren();
  const visible = CHALLENGES.filter(matches);
  if (!visible.length) {
    grid.append(el('p', '', 'No labs match current filters.'));
    return;
  }
  visible.forEach((challenge) => {
    const solved = store.has(challenge.id);
    const card = el('article', `lab-card${solved ? ' solved' : ''}`);
    const head = el('div', 'card-head');
    const heading = el('div');
    heading.append(el('p', 'eyebrow', challenge.category), el('h2', '', challenge.title));
    head.append(heading);
    if (solved) head.append(el('span', 'tag done', 'Done ✓'));
    const tags = el('div', 'tags');
    tags.append(el('span', `tag diff-${challenge.difficulty.toLowerCase()}`, challenge.difficulty), el('span', 'tag', `${challenge.minutes} min`));
    if (challenge.interactive) tags.append(el('span', 'tag live', 'request-driven'));
    const button = el('button', 'button', solved ? 'Review lab' : 'Open lab');
    button.type = 'button';
    button.addEventListener('click', () => openLab(challenge.id, button));
    card.append(head, el('p', '', challenge.description), tags, button);
    grid.append(card);
  });
}

function list(title, values) {
  const block = el('section');
  block.append(el('h3', '', title));
  const items = el('ul');
  values.forEach((value) => items.append(el('li', '', value)));
  block.append(items);
  return block;
}

function openLab(id, opener) {
  activeChallenge = challengeById.get(id);
  if (!activeChallenge) return;
  dialogOpener = opener || document.activeElement;
  document.querySelector('#dialog-title').textContent = activeChallenge.title;
  document.querySelector('#dialog-category').textContent = `${activeChallenge.category} · ${activeChallenge.difficulty}`;
  content.replaceChildren();
  // Every lab is a request-driven simulation, so the dialog always uses the wide layout.
  dialog.classList.add('wide');
  const intro = el('div', 'lab-panel');
  intro.append(el('p', '', activeChallenge.description), list('Learning goals', activeChallenge.objectives), list('Defensive outcome', activeChallenge.remediation));
  const challenge = activeChallenge;
  content.append(intro, renderInteractiveLab(challenge, { submitFlag: (flag) => submitInteractiveFlag(challenge, flag), alreadySolved: store.has(challenge.id) }));
  dialog.showModal();
  content.querySelector('input, textarea, button')?.focus();
}

async function submitInteractiveFlag(challenge, flag) {
  if (!flag) return { ok: false, message: 'Paste the flag you found first.' };
  let response, data;
  try {
    response = await fetch('/api/lab-submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: challenge.id, flag }) });
    data = await response.json();
  } catch { return { ok: false, message: 'Network error. Try again.' }; }
  if (!response.ok) return { ok: false, message: data.error?.message || 'Validation failed.' };
  store.markSolved(challenge.id);
  renderProgress(); renderGrid();
  showToast(`${challenge.title} marked complete on this browser.`);
  return { ok: true, message: 'Flag accepted. Now fix the bug below.' };
}

function closeDialog() { dialog.close(); dialogOpener?.focus(); }

document.querySelector('#close-dialog').addEventListener('click', closeDialog);
dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(); });
dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(); });
dialog.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const nodes = [...dialog.querySelectorAll('button,input,textarea,select,summary,a[href]')].filter((node) => !node.disabled && node.offsetParent !== null);
  const first = nodes[0]; const last = nodes.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
search.addEventListener('input', renderGrid);
category.addEventListener('change', renderGrid);
document.querySelector('#reset-progress').addEventListener('click', () => {
  if (!window.confirm('Clear locally saved lab completion?')) return;
  store.reset(); renderProgress(); renderGrid(); showToast('Local lab progress cleared.');
});
renderFilters(); renderStats(); renderProgress(); renderGrid(); initReveal();
