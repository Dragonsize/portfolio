// "nsh": a small fake shell over a read-only virtual home directory built from portfolio data.
// Pure logic (createShell) is DOM-free and tested; initTerminal() wires it to the drawer UI.
// All output is rendered with textContent, never innerHTML.
import { HOSTS } from './net-globe.js';

const USER = 'visitor', HOST = 'naven';
const line = (...parts) => parts.map((p) => (Array.isArray(p) ? { t: p[0], c: p[1] } : { t: String(p), c: '' }));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const file = (content) => ({ type: 'file', content });
const dir = (children) => ({ type: 'dir', children });

export function buildFs(P) {
  const projects = {};
  [{ ...P.labs, live: true }, ...P.projects].forEach((p) => {
    projects[`${slug(p.title)}.md`] = file([
      `# ${p.title}${p.live ? '  [LIVE]' : ''}`, '', p.summary, '',
      `tags: ${p.tags.map((t) => `#${slug(t)}`).join(' ')}`,
      `link: ${p.href || P.github}`
    ].join('\n'));
  });
  return dir({
    'about.txt': file([P.identity.name, P.identity.role, '', P.identity.summary].join('\n')),
    'experience.log': file(P.experience.map((x) => `[${x.period}] ${x.role} @ ${x.org}\n       ${x.detail}`).join('\n')),
    'competitions.log': file(P.competitions.map((c) => `${c.year}  ${c.result.padEnd(16)} ${c.name}`).join('\n')),
    'education.txt': file([
      `${P.education.school}`, `${P.education.detail} (${P.education.period})`, '', 'certifications:',
      ...P.certifications.map((c) => `  - ${c.name}: ${c.detail} (${c.year})`)
    ].join('\n')),
    'skills.txt': file(P.skills.map((s) => `${s.title}:\n  ${s.items.join(', ')}`).join('\n\n')),
    'contact.txt': file(P.contacts.map((c) => `${c.label.padEnd(9)} ${c.value}`).join('\n') + '\n\ntip: open github | open linkedin | open email'),
    projects: dir(projects),
    '.bashrc': file("# ~/.bashrc\nalias ll='ls -la'\nalias la='ls -a'\nexport PS1='\\u@\\h:\\w$ '\n# there is something hidden in this directory..."),
    '.flag': file('flag{curiosity_is_a_security_skill}\n\nNice find. Say hi: open email')
  });
}

export function splitArgs(input) {
  const out = [];
  input.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, (_, a, b, c) => { out.push(a ?? b ?? c); return ''; });
  return out;
}

// Resolve a ping/nmap target the way a real resolver would: IPs, localhost, the globe hosts, or real-looking domains.
const TLDS = new Set(['com', 'net', 'org', 'io', 'dev', 'app', 'ai', 'co', 'me', 'edu', 'gov', 'vn', 'uk', 'us', 'de', 'jp', 'xyz', 'tech', 'sh']);
export function resolveHost(name = '') {
  const target = name.toLowerCase();
  if (['localhost', 'naven', HOST].includes(target)) return { ip: '127.0.0.1', local: true };
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(target);
  if (ipv4) return ipv4.slice(1).every((o) => Number(o) <= 255) ? { ip: target, local: target.startsWith('127.') } : null;
  const known = HOSTS.find((h) => h.svc === target);
  if (known) return { ip: known.ip, local: false };
  const labels = target.split('.');
  const validDomain = labels.length >= 2 && TLDS.has(labels.at(-1)) && labels.every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l));
  if (!validDomain) return null;
  let hash = 0;
  for (const ch of target) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { ip: `${104 + (hash % 80)}.${(hash >> 8) & 255}.${(hash >> 16) & 255}.${1 + ((hash >> 24) % 254)}`, local: false };
}

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function createShell(P, hooks = {}) {
  const root = buildFs(P);
  const startedAt = hooks.now?.() ?? Date.now();
  let cwd = [];
  const history = [];

  const cwdLabel = (parts = cwd) => (parts.length ? `~/${parts.join('/')}` : '~');
  const prompt = () => ({ user: `${USER}@${HOST}`, path: cwdLabel() });
  const resolve = (path = '') => {
    let parts = path.startsWith('/') || path.startsWith('~') ? [] : [...cwd];
    for (const seg of path.replace(/^~\/?/, '').split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop(); else parts.push(seg);
    }
    let node = root;
    for (const seg of parts) { node = node.type === 'dir' ? node.children[seg] : undefined; if (!node) return { parts, node: null }; }
    return { parts, node };
  };
  const entries = (node, all) => Object.keys(node.children).filter((n) => all || !n.startsWith('.')).sort();
  const size = (node) => (node.type === 'dir' ? 4096 : new TextEncoder().encode(node.content).length);
  const human = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)}K` : `${n}`);
  const uptime = () => {
    const s = Math.floor(((hooks.now?.() ?? Date.now()) - startedAt) / 1000);
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
  };
  const text = (content, cls = '') => content.split('\n').map((t) => line([t, cls]));

  const commands = {
    help: { desc: 'list commands', run: () => [
      line(['nsh 1.0 · built-in commands', 'muted']), line(''),
      ...Object.entries(commands).filter(([, c]) => !c.hidden).map(([name, c]) => line([name.padEnd(10), 'ok'], c.desc)),
      line(''), line(['tab completes · ↑/↓ history · ctrl+l clears · ctrl+c cancels', 'muted'])
    ] },
    ls: { desc: 'list directory contents (-a, -l)', run: (args) => {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const target = args.find((a) => !a.startsWith('-')) ?? '';
      const { node } = resolve(target);
      if (!node) return [line([`ls: cannot access '${target}': No such file or directory`, 'err'])];
      if (node.type === 'file') return [line(target)];
      const names = entries(node, flags.includes('a'));
      if (flags.includes('l')) {
        return [line(['total ' + names.length, 'muted']), ...names.map((n) => {
          const child = node.children[n], isDir = child.type === 'dir';
          return line([`${isDir ? 'd' : '-'}r${isDir ? '-x' : '--'}r${isDir ? '-x' : '--'}r${isDir ? '-x' : '--'}  ${USER}  ${human(size(child)).padStart(5)}  Apr 26 10:24  `, 'muted'], [isDir ? `${n}/` : n, isDir ? 'dir' : n.startsWith('.') ? 'muted' : '']);
        })];
      }
      return names.length ? [names.map((n) => (node.children[n].type === 'dir' ? [`${n}/`, 'dir'] : [n, n.startsWith('.') ? 'muted' : ''])).flatMap((p, i) => (i ? [['  ', ''], p] : [p])).map(([t, c]) => ({ t, c }))] : [];
    } },
    cd: { desc: 'change directory', run: ([target = '~']) => {
      const { parts, node } = resolve(target);
      if (!node) return [line([`cd: no such file or directory: ${target}`, 'err'])];
      if (node.type !== 'dir') return [line([`cd: not a directory: ${target}`, 'err'])];
      cwd = parts; return [];
    } },
    pwd: { desc: 'print working directory', run: () => [line(`/home/${USER}${cwd.length ? '/' + cwd.join('/') : ''}`)] },
    cat: { desc: 'print a file', run: (args) => {
      if (!args.length) return [line(['usage: cat <file>', 'err'])];
      return args.flatMap((a) => {
        const { node } = resolve(a);
        if (!node) return [line([`cat: ${a}: No such file or directory`, 'err'])];
        if (node.type === 'dir') return [line([`cat: ${a}: Is a directory`, 'err'])];
        return text(node.content, a.endsWith('.flag') ? 'hi' : '');
      });
    } },
    tree: { desc: 'show the directory tree', run: () => {
      const out = [line(['~', 'dir'])];
      const walk = (node, prefix) => entries(node, false).forEach((n, i, arr) => {
        const last = i === arr.length - 1, child = node.children[n];
        out.push(line([`${prefix}${last ? '└── ' : '├── '}`, 'muted'], [child.type === 'dir' ? `${n}/` : n, child.type === 'dir' ? 'dir' : '']));
        if (child.type === 'dir') walk(child, prefix + (last ? '    ' : '│   '));
      });
      walk(root, '');
      return out;
    } },
    echo: { desc: 'print text', run: (args) => [line(args.join(' '))] },
    whoami: { desc: 'print current user', run: () => [line(USER), line(['(the owner is Naven Tran: cat about.txt)', 'muted'])] },
    whereami: { desc: 'where the globe thinks you are', run: () => {
      const g = hooks.getVisitor?.();
      if (!g) return [line(['locating…', 'muted'])];
      return [line([[g.city, g.country].filter(Boolean).join(', ') || 'somewhere on the globe', 'hi'], `  (${g.lat.toFixed(1)}, ${g.lon.toFixed(1)})`)];
    } },
    neofetch: { desc: 'system info', run: () => {
      const art = ['    .---.    ', '   /     \\   ', '   | ( ) |   ', '  _|_____|_  ', ' |  .---.  | ', ' |  | N |  | ', ' |  \'---\'  | ', " '---------' "];
      const info = [
        [[`${USER}@${HOST}`, 'ok']], [['-------------', 'muted']],
        [['OS', 'ok'], ': NavenOS 2.0 (web)'], [['Host', 'ok'], `: ${hooks.host?.() ?? 'localhost'}`], [['Kernel', 'ok'], ': 6.8.0-sec'],
        [['Uptime', 'ok'], `: ${uptime()}`], [['Shell', 'ok'], ': nsh 1.0'], [['Theme', 'ok'], `: ${hooks.theme?.() ?? 'dark'}`],
        [['Role', 'ok'], `: ${P.experience[0] ? `${P.experience[0].role}, ${P.experience[0].org}` : P.identity.role}`],
        [['Focus', 'ok'], ': bug bounty · CTF · python tooling']
      ];
      return Array.from({ length: Math.max(art.length, info.length) }, (_, i) => line([art[i] ?? ' '.repeat(13), 'dir'], '  ', ...(info[i] ?? [])));
    } },
    date: { desc: 'print the date', run: () => [line(new Date(hooks.now?.() ?? Date.now()).toString())] },
    uptime: { desc: 'time since you opened the page', run: () => [line(`up ${uptime()},  1 user,  load average: 0.13, 0.08, 0.02`)] },
    uname: { desc: 'system name (-a)', run: (args) => [line(args.includes('-a') ? `Linux ${HOST} 6.8.0-sec #1 SMP PREEMPT x86_64 GNU/Linux` : 'Linux')] },
    history: { desc: 'command history', run: () => history.map((h, i) => line([`${String(i + 1).padStart(4)}  `, 'muted'], h)) },
    nmap: { desc: 'scan the hero network', run: (args) => {
      const target = args.find((a) => !a.startsWith('-')) || '10.0.0.0/16';
      if (target !== '10.0.0.0/16' && !resolveHost(target)) {
        return [line('Starting Nmap 7.94 ( https://nmap.org )'), line([`Failed to resolve "${target}".`, 'err']), line(['WARNING: No targets were specified, so 0 hosts scanned.', 'err']), line('Nmap done: 0 IP addresses (0 hosts up) scanned in 0.04 seconds')];
      }
      hooks.scan?.();
      return {
        stagger: 70,
        lines: [
          line(`Starting Nmap 7.94 ( https://nmap.org ) against ${target}`),
          ...HOSTS.flatMap((h) => [
            line(['Nmap scan report for ', ''], [h.ip, 'hi']),
            line(['PORT      STATE  SERVICE', 'muted']),
            line(`${h.port.padEnd(10)}`, ['open   ', h.flag ? 'err' : 'ok'], h.svc, h.flag ? ['   <- review', 'err'] : '')
          ]),
          line(['Nmap done: ', ''], [`${HOSTS.length} IP addresses (${HOSTS.length} hosts up)`, 'ok'], ' scanned in 1.92 seconds')
        ]
      };
    } },
    ping: { desc: 'ping a host (-c count, ctrl+c to stop)', run: (args) => {
      const cIndex = args.indexOf('-c');
      const count = cIndex >= 0 ? Number.parseInt(args[cIndex + 1], 10) : Infinity;
      const host = args.find((a, i) => !a.startsWith('-') && (cIndex < 0 || i !== cIndex + 1));
      if (!host) return [line(['ping: usage error: Destination address required', 'err'])];
      if (cIndex >= 0 && !(count > 0)) return [line([`ping: invalid argument: '${args[cIndex + 1] ?? ''}'`, 'err'])];
      const resolved = resolveHost(host);
      if (!resolved) return [line([`ping: ${host}: Name or service not known`, 'err'])];
      const { ip, local } = resolved;
      const random = hooks.random ?? Math.random;
      const base = local ? 0.04 : 8 + random() * 30;
      const times = [];
      const isNaven = ['naven', HOST].includes(host.toLowerCase());
      return {
        lines: [line(`PING ${host} (${ip}) 56(84) bytes of data.`)],
        stream: {
          interval: 1000,
          next: (i) => {
            if (i >= count) return null;
            const t = local ? base + random() * 0.05 : base + (random() - 0.5) * base * 0.3;
            times.push(t);
            return line(`64 bytes from ${ip}: icmp_seq=${i + 1} ttl=${local ? 64 : 54} time=${t.toFixed(local ? 3 : 1)} ms`);
          },
          summary: () => {
            const n = times.length;
            const min = Math.min(...times), max = Math.max(...times), avg = times.reduce((a, b) => a + b, 0) / (n || 1);
            const mdev = Math.sqrt(times.reduce((a, b) => a + (b - avg) ** 2, 0) / (n || 1));
            const out = [line(''), line(`--- ${host} ping statistics ---`), line(`${n} packets transmitted, ${n} received, 0% packet loss, time ${Math.max(n - 1, 0) * 1000}ms`)];
            if (n) out.push(line(`rtt min/avg/max/mdev = ${[min, avg, max, mdev].map((v) => v.toFixed(3)).join('/')} ms`));
            if (isNaven && n) out.push(line(['naven is up. reach him: open email', 'hi']));
            return out;
          }
        }
      };
    } },
    open: { desc: 'open a link: github, linkedin, email, labs', run: ([name]) => {
      const links = { labs: P.labs.href, github: P.github };
      P.contacts.forEach((c) => { links[c.label.toLowerCase()] = c.href; });
      if (!name || !links[name]) return [line([`usage: open <${Object.keys(links).join('|')}>`, 'err'])];
      hooks.open?.(links[name]);
      return [line(['opening ', 'muted'], [links[name], 'hi'])];
    } },
    theme: { desc: 'toggle light/dark', run: () => { hooks.toggleTheme?.(); return [line(`theme: ${hooks.theme?.() ?? 'dark'}`)]; } },
    clear: { desc: 'clear the screen', run: () => ({ clear: true, lines: [] }) },
    exit: { desc: 'close the terminal', run: () => ({ exit: true, lines: [line(['logout', 'muted'])] }) },
    sudo: { hidden: true, run: () => [line(['[sudo] password for visitor: ', '']), line([`${USER} is not in the sudoers file. This incident will be reported.`, 'err'])] },
    rm: { hidden: true, run: () => [line(['rm: cannot remove: Read-only file system', 'err'])] },
    man: { hidden: true, run: ([cmd]) => (commands[cmd] && !commands[cmd].hidden ? [line([cmd, 'ok'], ` - ${commands[cmd].desc}`)] : [line([`No manual entry for ${cmd ?? ''}`.trim(), 'err'])]) },
    vim: { hidden: true, run: () => [line(['vim: read-only system. (and you would never get out anyway)', 'muted'])] }
  };
  const aliases = { ll: ['ls', '-la'], la: ['ls', '-a'], dir: ['ls'], cls: ['clear'], logout: ['exit'], quit: ['exit'], nano: ['vim'] };

  const run = (input) => {
    const raw = input.trim();
    if (!raw) return { lines: [] };
    history.push(raw);
    let [cmd, ...args] = splitArgs(raw);
    if (aliases[cmd]) [cmd, ...args] = [...aliases[cmd], ...args];
    const entry = Object.hasOwn(commands, cmd) ? commands[cmd] : null;
    if (!entry) {
      const close = Object.keys(commands).filter((c) => !commands[c].hidden).map((c) => [distance(cmd, c), c]).sort((a, b) => a[0] - b[0])[0];
      return { lines: [line([`nsh: command not found: ${cmd}`, 'err']), ...(close && close[0] <= 2 ? [line(['did you mean ', 'muted'], [close[1], 'ok'], ['?', 'muted'])] : [])] };
    }
    const result = entry.run(args);
    return Array.isArray(result) ? { lines: result } : result;
  };

  const complete = (input) => {
    const parts = input.split(/\s+/);
    const current = parts.pop() ?? '';
    let options;
    if (!parts.length) options = [...Object.keys(commands).filter((c) => !commands[c].hidden), ...Object.keys(aliases)].filter((c) => c.startsWith(current));
    else {
      const slash = current.lastIndexOf('/');
      const base = slash >= 0 ? current.slice(0, slash + 1) : '';
      const { node } = resolve(base || '.');
      const prefix = current.slice(slash + 1);
      options = node?.type === 'dir' ? entries(node, prefix.startsWith('.')).filter((n) => n.startsWith(prefix)).map((n) => base + n + (node.children[n].type === 'dir' ? '/' : '')) : [];
      if (parts[0] === 'cd') options = options.filter((o) => o.endsWith('/'));
    }
    if (!options.length) return { value: input, options: [] };
    let common = options[0];
    options.forEach((o) => { while (!o.startsWith(common)) common = common.slice(0, -1); });
    const done = options.length === 1 && !common.endsWith('/') ? `${common} ` : common;
    return { value: [...parts, done].join(' '), options: options.length > 1 ? options : [] };
  };

  return { run, complete, prompt, history };
}

/* ---------------- UI ---------------- */
export function initTerminal({ data, hooks, drawer, output, input, form, promptLabel, trigger, closeButton }) {
  const shell = createShell(data, hooks);
  let histIndex = 0, booted = false, streaming = null;

  const render = (segments, className = '') => {
    const p = document.createElement('div'); // divs copy as single newlines; <p> adds blank lines
    if (className) p.className = className;
    segments.forEach(({ t, c }) => { const s = document.createElement('span'); s.textContent = t; if (c) s.className = `t-${c}`; p.append(s); });
    output.append(p);
    output.scrollTop = output.scrollHeight;
  };
  const promptSegments = () => { const { user, path } = shell.prompt(); return [{ t: user, c: 'user' }, { t: ':', c: '' }, { t: path, c: 'path' }, { t: '$ ', c: '' }]; };
  const updatePrompt = () => { const { user, path } = shell.prompt(); promptLabel.textContent = `${user}:${path}$`; };
  const echo = (value, suffix = '') => render([...promptSegments(), { t: value, c: '' }, ...(suffix ? [{ t: suffix, c: 'muted' }] : [])]);

  const boot = () => {
    booted = true;
    const last = new Date(Date.now() - 1000 * 60 * 47);
    render([{ t: `Last login: ${last.toDateString()} ${last.toTimeString().slice(0, 8)} on ttys001`, c: 'muted' }]);
    render([{ t: 'Welcome to ', c: '' }, { t: 'nsh 1.0', c: 'ok' }, { t: ' on naven.', c: '' }]);
    render([{ t: "Type 'help' for commands. Try 'neofetch', 'ls -la' or 'cat about.txt'.", c: 'muted' }]);
    render([{ t: '', c: '' }]);
  };
  // streaming = { timer, onCancel } while a command is still producing output
  const finishStream = () => { streaming = null; input.disabled = false; input.focus(); };
  const cancelStream = () => {
    if (!streaming) return;
    clearTimeout(streaming.timer);
    const onCancel = streaming.onCancel;
    render([{ t: '^C', c: 'muted' }]);
    onCancel?.();
    finishStream();
  };
  const show = (result) => {
    if (result.clear) output.replaceChildren();
    const lines = result.lines || [];
    if (result.stream) {
      lines.forEach((l) => render(l));
      input.disabled = true;
      let i = 0;
      const { interval, next, summary } = result.stream;
      const tick = () => {
        const out = next(i);
        if (!out) { summary().forEach((l) => render(l)); finishStream(); return; }
        render(out); i += 1;
        streaming.timer = setTimeout(tick, interval);
      };
      streaming = { timer: 0, onCancel: () => summary().forEach((l) => render(l)) };
      streaming.timer = setTimeout(tick, 250);
    } else if (result.stagger) {
      input.disabled = true;
      let i = 0;
      streaming = { timer: 0, onCancel: null };
      const tick = () => { if (i >= lines.length) { finishStream(); return; } render(lines[i++]); streaming.timer = setTimeout(tick, result.stagger); };
      tick();
    } else lines.forEach((l) => render(l));
    updatePrompt();
    if (result.exit) setTimeout(close, 250);
  };

  const open = () => {
    drawer.classList.add('is-open'); drawer.inert = false; drawer.setAttribute('aria-hidden', 'false'); trigger.setAttribute('aria-expanded', 'true');
    if (!booted) boot();
    updatePrompt(); input.focus();
  };
  const close = () => {
    if (streaming) { clearTimeout(streaming.timer); finishStream(); }
    drawer.classList.remove('is-open'); drawer.inert = true; drawer.setAttribute('aria-hidden', 'true'); trigger.setAttribute('aria-expanded', 'false'); trigger.focus();
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (streaming) return;
    const value = input.value;
    input.value = '';
    echo(value);
    histIndex = shell.history.length + (value.trim() ? 1 : 0);
    show(shell.run(value));
  });
  input.addEventListener('keydown', (event) => {
    const h = shell.history;
    if (event.key === 'ArrowUp') { event.preventDefault(); histIndex = Math.max(histIndex - 1, 0); input.value = h[histIndex] ?? ''; }
    else if (event.key === 'ArrowDown') { event.preventDefault(); histIndex = Math.min(histIndex + 1, h.length); input.value = h[histIndex] ?? ''; }
    else if (event.key === 'Tab') {
      event.preventDefault();
      const { value, options } = shell.complete(input.value);
      if (options.length) { echo(input.value); render(options.map((o, i) => ({ t: (i ? '  ' : '') + o, c: o.endsWith('/') ? 'dir' : '' }))); }
      input.value = value;
    } else if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); output.replaceChildren(); }
    else if (event.ctrlKey && event.key.toLowerCase() === 'c') {
      if (input.selectionStart !== input.selectionEnd) return; // allow normal copy
      event.preventDefault(); echo(input.value, '^C'); input.value = '';
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === 'c' && streaming && !getSelection()?.toString()) { event.preventDefault(); cancelStream(); }
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) close();
    if (event.key === '`' && !event.target.closest('input, textarea')) { event.preventDefault(); drawer.classList.contains('is-open') ? close() : open(); }
  });
  output.addEventListener('mouseup', () => { if (!getSelection()?.toString()) input.focus(); });
  trigger.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  return { open, close, run: (cmd) => { open(); echo(cmd); show(shell.run(cmd)); } };
}
