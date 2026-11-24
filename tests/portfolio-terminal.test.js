import test from 'node:test';
import assert from 'node:assert/strict';
import { PORTFOLIO } from '../apps/portfolio/data.js';
import { createShell, resolveHost, splitArgs } from '../apps/portfolio/terminal.js';

const textOf = (result) => result.lines.map((segs) => segs.map((s) => s.t).join('')).join('\n');

test('ls hides dotfiles unless -a, and marks directories', () => {
  const sh = createShell(PORTFOLIO);
  const plain = textOf(sh.run('ls'));
  assert.match(plain, /projects\//);
  assert.match(plain, /about\.txt/);
  assert.doesNotMatch(plain, /\.flag/);
  assert.match(textOf(sh.run('ls -a')), /\.flag/);
  assert.match(textOf(sh.run('ll')), /dr-xr-xr-x/);
});

test('cd changes the prompt path and handles errors', () => {
  const sh = createShell(PORTFOLIO);
  sh.run('cd projects');
  assert.equal(sh.prompt().path, '~/projects');
  assert.match(textOf(sh.run('pwd')), /\/home\/visitor\/projects$/);
  sh.run('cd ..');
  assert.equal(sh.prompt().path, '~');
  assert.match(textOf(sh.run('cd nope')), /no such file or directory/);
  assert.match(textOf(sh.run('cd about.txt')), /not a directory/);
});

test('cat prints files from portfolio data and rejects directories', () => {
  const sh = createShell(PORTFOLIO);
  assert.match(textOf(sh.run('cat about.txt')), /Naven Tran/);
  assert.match(textOf(sh.run('cat experience.log')), /Vice President @ IT-Zone Tech Club/);
  assert.match(textOf(sh.run('cat ~/projects/network-audit-scanner.md')), /# Network Audit Scanner/);
  assert.match(textOf(sh.run('cat projects')), /Is a directory/);
});

test('unknown commands suggest the closest match', () => {
  const out = textOf(createShell(PORTFOLIO).run('neofech'));
  assert.match(out, /command not found: neofech/);
  assert.match(out, /did you mean neofetch\?/);
});

test('tab completion completes commands and paths', () => {
  const sh = createShell(PORTFOLIO);
  assert.equal(sh.complete('neo').value, 'neofetch ');
  assert.equal(sh.complete('cat ab').value, 'cat about.txt ');
  assert.equal(sh.complete('cd pro').value, 'cd projects/');
  const multi = sh.complete('c');
  assert.ok(multi.options.includes('cat') && multi.options.includes('cd'));
});

test('history, aliases, special results and hooks', () => {
  let scanned = 0, opened = '';
  const sh = createShell(PORTFOLIO, { scan: () => { scanned += 1; }, open: (h) => { opened = h; } });
  sh.run('echo "hello world"');
  assert.equal(textOf(sh.run('history')).trim().split('\n').length, 2);
  assert.equal(sh.run('clear').clear, true);
  assert.equal(sh.run('exit').exit, true);
  assert.ok(sh.run('nmap').stagger > 0);
  assert.equal(scanned, 1);
  sh.run('open github');
  assert.equal(opened, PORTFOLIO.github);
  assert.match(textOf(sh.run('sudo rm -rf /')), /not in the sudoers file/);
});

test('argument splitting keeps quoted strings together', () => {
  assert.deepEqual(splitArgs(`echo "a b" 'c d' e`), ['echo', 'a b', 'c d', 'e']);
});

test('ping rejects files and junk like a real resolver', () => {
  const sh = createShell(PORTFOLIO);
  assert.match(textOf(sh.run('ping about.txt')), /^ping: about\.txt: Name or service not known$/);
  assert.match(textOf(sh.run('ping 999.1.1.1')), /Name or service not known/);
  assert.match(textOf(sh.run('ping')), /Destination address required/);
  assert.match(textOf(sh.run('ping -c 0 naven')), /invalid argument/);
  assert.match(textOf(sh.run('nmap about.txt')), /Failed to resolve "about\.txt"/);
});

test('ping streams until count, then prints real-style statistics', () => {
  const sh = createShell(PORTFOLIO, { random: () => 0.5 });
  const result = sh.run('ping -c 3 github.com');
  assert.match(textOf(result), /^PING github\.com \(\d+\.\d+\.\d+\.\d+\) 56\(84\) bytes of data\.$/);
  const replies = [0, 1, 2, 3].map((i) => result.stream.next(i));
  assert.equal(replies[3], null);
  assert.match(replies[0].map((s) => s.t).join(''), /icmp_seq=1 ttl=54 time=23\.0 ms/);
  const stats = result.stream.summary().map((s) => s.map((x) => x.t).join('')).join('\n');
  assert.match(stats, /3 packets transmitted, 3 received, 0% packet loss, time 2000ms/);
  assert.match(stats, /rtt min\/avg\/max\/mdev = /);
});

test('resolver accepts IPs, localhost, globe services and domains', () => {
  assert.equal(resolveHost('127.0.0.1').local, true);
  assert.equal(resolveHost('naven').ip, '127.0.0.1');
  assert.equal(resolveHost('ssh').ip, '10.0.1.12');
  assert.ok(resolveHost('example.com'));
  assert.equal(resolveHost('example.com').ip, resolveHost('example.com').ip);
  assert.equal(resolveHost('skills.txt'), null);
});
