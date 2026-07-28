const PORTFOLIO = {
  labsUrl: 'http://localhost:3001/',
  projects: [
    { id: 'research-tool', title: 'Research tool', summary: 'Replace with verified scope, outcome, and implementation details.', tags: ['Security', 'Tooling'], details: '', evidence: [] },
    { id: 'case-study', title: 'Case study', summary: 'Replace with an approved write-up, repository, or public demonstration.', tags: ['Research', 'Writing'], details: '', evidence: [] },
    { id: 'lab-design', title: 'Lab design', summary: 'Replace with a verified example of educational scenario design or platform work.', tags: ['Education', 'Web'], details: '', evidence: [] }
  ],
  practiceGroups: [
    { title: 'Application security', items: ['Web application security', 'Secure design review'] },
    { title: 'Technical work', items: ['Security tooling', 'Technical writing'] },
    { title: 'Learning design', items: ['Educational lab design'] }
  ],
  publicRecord: [],
  contacts: [
    { label: 'GitHub — replace URL', href: 'https://github.com/your-handle' },
    { label: 'LinkedIn — replace URL', href: 'https://www.linkedin.com/in/your-handle/' },
    { label: 'Email — replace address', href: 'mailto:you@example.com' }
  ]
};

const $ = (selector) => document.querySelector(selector);
const output = $('#terminal-output');
const input = $('#terminal-input');
const dialog = $('#terminal-dialog');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let opener = null;
let history = [];
let historyIndex = 0;

function textNode(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function validLink(value) {
  try {
    const url = new URL(value, window.location.href);
    return ['https:', 'mailto:'].includes(url.protocol);
  } catch { return false; }
}

function externalLink(label, href, className = '') {
  if (!validLink(href)) return null;
  const link = textNode('a', className, label);
  link.href = href;
  if (href.startsWith('https:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  return link;
}

function renderProjects() {
  const projectGrid = $('#project-grid');
  projectGrid.replaceChildren();
  PORTFOLIO.projects.forEach((project) => {
    const card = textNode('article', 'project');
    const tags = textNode('div', 'tags');
    project.tags.forEach((tag) => tags.append(textNode('span', 'tag', tag)));
    card.append(textNode('h3', '', project.title), textNode('p', 'project-summary', project.summary), tags);

    if (project.details || project.evidence?.length) {
      const details = textNode('details', 'project-details');
      const summary = textNode('summary', '', 'Show project scope');
      details.append(summary);
      if (project.details) details.append(textNode('p', '', project.details));
      const evidence = textNode('div', 'evidence-links');
      project.evidence.forEach(({ label, href }) => {
        const link = externalLink(label, href);
        if (link) evidence.append(link);
      });
      if (evidence.childElementCount) details.append(evidence);
      card.append(details);
    }
    projectGrid.append(card);
  });
}

function renderPractice() {
  const container = $('#practice-groups');
  container.replaceChildren();
  PORTFOLIO.practiceGroups.forEach((group) => {
    const card = textNode('section', 'practice-card');
    const list = textNode('ul', 'practice-list');
    group.items.forEach((item) => list.append(textNode('li', '', item)));
    card.append(textNode('h3', '', group.title), list);
    container.append(card);
  });
}

function renderRecord() {
  const section = $('#record');
  const list = $('#record-list');
  list.replaceChildren();
  if (!PORTFOLIO.publicRecord.length) { section.classList.add('hidden'); return; }
  PORTFOLIO.publicRecord.forEach((entry) => {
    const item = textNode('li', 'record-item');
    const heading = textNode('h3', '', `${entry.year} — ${entry.title}`);
    item.append(heading, textNode('p', '', entry.description));
    const link = externalLink('View public evidence ↗', entry.href || '');
    if (link) item.append(link);
    list.append(item);
  });
  section.classList.remove('hidden');
}

function renderContacts() {
  const contacts = $('#contact-links');
  contacts.replaceChildren();
  PORTFOLIO.contacts.forEach((contact) => {
    const link = externalLink(contact.label, contact.href, 'contact-link');
    if (link) contacts.append(link);
  });
}

function renderPortfolio() {
  renderProjects();
  renderPractice();
  renderRecord();
  renderContacts();
  ['#labs-link', '#labs-cta'].forEach((selector) => { $(selector).href = PORTFOLIO.labsUrl; });
}

function print(message, type = 'terminal-response') {
  output.append(textNode('div', `terminal-line ${type}`, message));
  output.scrollTop = output.scrollHeight;
}

function openTerminal(source) {
  opener = source || document.activeElement;
  dialog.showModal();
  if (!output.childElementCount) print('Portfolio terminal ready. Type help for commands.');
  input.focus();
}

function closeTerminal() { dialog.close(); opener?.focus(); }

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView({ behavior: motionQuery.matches ? 'auto' : 'smooth' });
  return true;
}

const commands = {
  help: () => 'Commands: about, skills, projects, project <id>, contact, labs, open <section>, status, clear, date, echo <text>, exit',
  about: () => { scrollToSection('about'); return 'Opened practice section.'; },
  skills: () => PORTFOLIO.practiceGroups.flatMap((group) => [`${group.title}:`, ...group.items.map((item) => `  ${item}`)]).join('\n'),
  projects: () => PORTFOLIO.projects.map((project) => `${project.id} — ${project.title}`).join('\n'),
  project: (args) => { const project = PORTFOLIO.projects.find((item) => item.id === args.trim()); if (!project) return 'Unknown project. Run projects for available IDs.'; scrollToSection('work'); return `${project.title}: ${project.summary}`; },
  contact: () => { scrollToSection('contact'); return 'Opened contact links.'; },
  labs: () => { window.open(PORTFOLIO.labsUrl, '_blank', 'noopener'); return 'Opened learning labs in a new tab.'; },
  open: (args) => scrollToSection(args.trim()) ? `Opened ${args.trim()}.` : 'Known sections: work, about, labs, contact.',
  status: () => 'Portfolio online. Labs are isolated deterministic simulations.',
  clear: () => { output.replaceChildren(); return null; },
  date: () => new Date().toLocaleString(),
  echo: (args) => args,
  exit: () => { window.setTimeout(closeTerminal, 0); return 'Closing terminal.'; }
};

function execute(raw) {
  const [command = '', ...rest] = raw.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const args = rest.join(' ').replaceAll(/^"|"$/g, '');
  print(`visitor@portfolio:~$ ${raw}`, 'terminal-command');
  const handler = commands[command.toLowerCase()];
  const result = handler ? handler(args) : `command not found: ${command}`;
  if (result !== null && result !== undefined) print(result);
}

function focusableNodes() { return [...dialog.querySelectorAll('button,input,[href]')].filter((node) => !node.disabled); }

function setupNavigation() {
  if (!('IntersectionObserver' in window)) return;
  const links = [...document.querySelectorAll('.nav-links a')];
  const map = new Map(links.map((link) => [link.getAttribute('href')?.slice(1), link]));
  const observer = new IntersectionObserver((entries) => {
    const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!active) return;
    links.forEach((link) => { link.classList.remove('active'); link.removeAttribute('aria-current'); });
    const link = map.get(active.target.id);
    if (link) { link.classList.add('active'); link.setAttribute('aria-current', 'page'); }
  }, { rootMargin: '-28% 0px -60% 0px', threshold: [0, 0.1, 0.5] });
  ['work', 'about', 'labs', 'contact'].forEach((id) => observer.observe(document.getElementById(id)));
}

$('#open-terminal').addEventListener('click', (event) => openTerminal(event.currentTarget));
$('#close-terminal').addEventListener('click', closeTerminal);
dialog.addEventListener('click', (event) => { if (event.target === dialog) closeTerminal(); });
dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeTerminal(); });
dialog.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const nodes = focusableNodes(); const first = nodes[0]; const last = nodes.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
$('#terminal-form').addEventListener('submit', (event) => { event.preventDefault(); const value = input.value.trim(); if (!value) return; execute(value); history.push(value); historyIndex = history.length; input.value = ''; });
input.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp') { event.preventDefault(); if (historyIndex > 0) input.value = history[--historyIndex]; }
  if (event.key === 'ArrowDown') { event.preventDefault(); if (historyIndex < history.length - 1) input.value = history[++historyIndex]; else { historyIndex = history.length; input.value = ''; } }
  if (event.key === 'Tab') { event.preventDefault(); const value = input.value.trim().toLowerCase(); const matches = Object.keys(commands).filter((name) => name.startsWith(value)); if (matches.length === 1) input.value = `${matches[0]} `; else if (matches.length) print(matches.join('  ')); }
  if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); output.replaceChildren(); }
});
document.addEventListener('keydown', (event) => { const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName); if ((event.key === '~' || event.key === '`') && !editable && !dialog.open) { event.preventDefault(); openTerminal(document.activeElement); } });

renderPortfolio();
setupNavigation();
