import { CHALLENGES, challengeById } from './shared/challenge-registry.js';
import { ProgressStore } from './shared/progress-store.js';

const store = new ProgressStore(CHALLENGES.map(({ id }) => id));
const grid = document.querySelector('#lab-grid');
const search = document.querySelector('#search');
const category = document.querySelector('#category');
const progress = document.querySelector('#progress');
const dialog = document.querySelector('#lab-dialog');
const content = document.querySelector('#lab-content');
const toast = document.querySelector('#toast');
const themeToggle = document.querySelector('#theme-toggle');
function initialTheme() { try { const saved = localStorage.getItem('labs-theme'); if (saved === 'dark' || saved === 'light') return saved; } catch {} return 'light'; }
function applyTheme(theme, persist = false) { document.documentElement.dataset.theme = theme; themeToggle.textContent = `[ theme: ${theme} ]`; themeToggle.setAttribute('aria-pressed', String(theme === 'dark')); themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`); if (persist) try { localStorage.setItem('labs-theme', theme); } catch {} }
themeToggle.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
applyTheme(initialTheme());
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
    head.append(heading, el('span', 'tag', solved ? 'Completed' : challenge.difficulty));
    const tags = el('div', 'tags');
    tags.append(el('span', 'tag', `${challenge.minutes} min`), el('span', 'tag', challenge.difficulty));
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

function output(data) {
  const result = el('pre', 'output');
  result.textContent = JSON.stringify(data, null, 2);
  return result;
}

async function runScenario(challenge, input) {
  const response = await fetch(challenge.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Lab request failed.');
  return data;
}

function openLab(id, opener) {
  activeChallenge = challengeById.get(id);
  if (!activeChallenge) return;
  dialogOpener = opener || document.activeElement;
  document.querySelector('#dialog-title').textContent = activeChallenge.title;
  document.querySelector('#dialog-category').textContent = `${activeChallenge.category} · ${activeChallenge.difficulty}`;
  content.replaceChildren();
  const panel = el('div', 'lab-panel');
  panel.append(el('p', '', activeChallenge.description), list('Learning goals', activeChallenge.objectives), list('Defensive outcome', activeChallenge.remediation));
  const form = el('form', 'lab-form');
  form.append(el('label', '', activeChallenge.control.label));
  const row = el('div', 'form-row');
  const input = el('input', 'lab-input');
  input.name = 'input'; input.placeholder = activeChallenge.control.placeholder; input.autocomplete = 'off';
  const run = el('button', 'button', 'Run simulation'); run.type = 'submit';
  row.append(input, run);
  const result = el('div');
  form.append(row, result);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    run.disabled = true;
    try {
      const data = await runScenario(activeChallenge, input.value);
      result.replaceChildren(output(data));
      if (data.flag) addSubmission(result, activeChallenge);
    } catch (error) { result.replaceChildren(el('p', '', error.message)); }
    finally { run.disabled = false; }
  });
  panel.append(form);
  content.append(panel);
  dialog.showModal();
  input.focus();
}

function addSubmission(container, challenge, discoveredFlag) {
  const form = el('form', 'lab-form');
  form.append(el('h3', '', 'Submit simulation evidence'));
  const row = el('div', 'form-row');
  const input = el('input', 'lab-input'); input.placeholder = 'flag{...}'; input.autocomplete = 'off';
  const button = el('button', 'button', 'Validate'); button.type = 'submit'; row.append(input, button); form.append(row);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const response = await fetch('/api/lab-submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: challenge.id, flag: input.value }) });
    const data = await response.json();
    if (!response.ok) { showToast(data.error?.message || 'Validation failed.'); return; }
    store.markSolved(challenge.id);
    renderProgress(); renderGrid();
    showToast(`${challenge.title} marked complete on this browser.`);
    form.replaceChildren(el('p', '', 'Completed. Keep the remediation guidance for future work.'));
  });
  container.append(form);
}

function closeDialog() { dialog.close(); dialogOpener?.focus(); }

document.querySelector('#close-dialog').addEventListener('click', closeDialog);
dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(); });
dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(); });
dialog.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const nodes = [...dialog.querySelectorAll('button,input')].filter((node) => !node.disabled);
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
renderFilters(); renderProgress(); renderGrid();
