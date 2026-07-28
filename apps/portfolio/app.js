const PORTFOLIO = {
  labsUrl: 'https://labs.example.com',
  projects: [
    { id: 'research-tool', title: 'Research tool', summary: 'Replace with verified scope, outcome, and implementation details.', tags: ['Security', 'Tooling'], url: '' },
    { id: 'case-study', title: 'Case study', summary: 'Replace with an approved write-up, repository, or public demonstration.', tags: ['Research', 'Writing'], url: '' },
    { id: 'lab-design', title: 'Lab design', summary: 'Replace with a verified example of educational scenario design or platform work.', tags: ['Education', 'Web'], url: '' }
  ],
  skills: ['Web application security', 'Secure design review', 'Security tooling', 'Technical writing', 'Educational lab design'],
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
let opener = null;
let history = [];
let historyIndex = 0;

function textNode(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function renderPortfolio() {
  const projectGrid = $('#project-grid');
  PORTFOLIO.projects.forEach((project) => {
    const card = textNode('article', 'project', '');
    const tags = textNode('div', 'tags', '');
    project.tags.forEach((tag) => tags.append(textNode('span', 'tag', tag)));
    card.append(textNode('h3', '', project.title), textNode('p', '', project.summary), tags);
    if (project.url) {
      const link = textNode('a', '', 'View project ↗');
      link.href = project.url; link.target = '_blank'; link.rel = 'noopener'; card.append(link);
    } else card.append(textNode('span', 'muted', 'Add verified URL before publishing.'));
    projectGrid.append(card);
  });
  const skills = $('#skills-list');
  PORTFOLIO.skills.forEach((skill) => skills.append(textNode('li', '', skill)));
  const contacts = $('#contact-links');
  PORTFOLIO.contacts.forEach((contact) => {
    const link = textNode('a', '', contact.label); link.href = contact.href;
    if (contact.href.startsWith('http')) { link.target = '_blank'; link.rel = 'noopener'; }
    contacts.append(link);
  });
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
  target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return true;
}

const commands = {
  help: () => 'Commands: about, skills, projects, project <id>, contact, labs, open <section>, status, clear, date, echo <text>, exit',
  about: () => { scrollToSection('about'); return 'Opened about section.'; },
  skills: () => PORTFOLIO.skills.join('\n'),
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

class ParticleSystem {
  constructor(canvas) { this.canvas = canvas; this.context = canvas.getContext('2d'); this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; this.particles = []; if (!this.reduced) { this.resize(); this.create(); addEventListener('resize', () => { this.resize(); this.create(); }); document.addEventListener('visibilitychange', () => { if (!document.hidden) this.draw(); }); this.draw(); } }
  resize() { this.ratio = Math.min(devicePixelRatio || 1, 2); this.canvas.width = innerWidth * this.ratio; this.canvas.height = innerHeight * this.ratio; this.context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); }
  create() { const count = Math.min(innerWidth < 700 ? 24 : 54, Math.floor(innerWidth / 22)); this.particles = Array.from({ length: count }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, xSpeed: (Math.random() - .5) * .25, ySpeed: (Math.random() - .5) * .25 })); }
  draw() { if (document.hidden) return; this.context.clearRect(0, 0, innerWidth, innerHeight); this.particles.forEach((particle) => { particle.x = (particle.x + particle.xSpeed + innerWidth) % innerWidth; particle.y = (particle.y + particle.ySpeed + innerHeight) % innerHeight; this.context.fillStyle = '#c7f65b66'; this.context.fillRect(particle.x, particle.y, 1.5, 1.5); }); requestAnimationFrame(() => this.draw()); }
}

renderPortfolio(); new ParticleSystem($('#particle-canvas'));
