import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHALLENGES, challengeById } from '../apps/labs/shared/challenge-registry.js';
import { knownChallenge, runScenario, verifyFlag } from '../apps/labs/api/_lib/lab-scenarios.js';

const solveInputs = {
  csrf: 'cross-site POST without token', auth: 'default access enabled', path: '../virtual://private', ssrf: 'lab://internal/catalog', secrets: 'diagnostic output enabled'
};

test('registry has eight unique valid challenge routes', () => {
  assert.equal(CHALLENGES.length, 8);
  assert.equal(challengeById.size, 8);
  CHALLENGES.forEach((challenge) => {
    assert.match(challenge.endpoint, /^\/api\//);
    assert.ok(challenge.title && challenge.objectives.length && challenge.remediation.length);
  });
});

test('each keyword simulator yields controlled evidence and a verifier-only flag', () => {
  for (const challenge of CHALLENGES.filter((item) => !item.interactive)) {
    const initial = runScenario(challenge.id, 'ordinary observation');
    assert.equal(initial.challengeId, challenge.id);
    assert.equal(initial.flag, undefined);
    const solved = runScenario(challenge.id, solveInputs[challenge.id]);
    assert.equal(solved.status, 'evidence-found');
    assert.match(solved.flag, /^flag\{lab_[a-z_]+\}$/);
    assert.equal(verifyFlag(challenge.id, solved.flag), true);
    assert.equal(verifyFlag(challenge.id, 'flag{wrong}'), false);
  }
});

test('only registered scenarios are recognized', () => {
  assert.equal(knownChallenge('unknown'), false);
  assert.equal(runScenario('unknown', 'anything'), null);
});

test('SSRF simulator confirms no outbound request occurred', () => {
  const result = runScenario('ssrf', 'lab://internal/catalog');
  assert.equal(result.artifact.outboundRequestMade, false);
});

test('Labs shell exposes Portfolio navigation, favicon, and theme modes', async () => {
  const [html, css, app] = await Promise.all([
    readFile(new URL('../apps/labs/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../apps/labs/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../apps/labs/app.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /<html lang="en" data-theme="dark">/);
  assert.match(html, /<script src="theme-init\.js"><\/script>/);
  assert.match(css, /:root\[data-theme=light\]/);
  assert.match(app, /prefers-color-scheme: light/);
  assert.match(html, /href="naven-mark-transparent\.png" type="image\/png"/);
  assert.match(html, /href="https:\/\/naventran\.vercel\.app\/"/);
  assert.match(html, /<a href="\/" aria-current="page">LABS<\/a>/);
  assert.match(html, /id="theme-toggle" class="theme-toggle" type="button"/);
  assert.match(css, /:root\[data-theme=light\]\{color-scheme:light;/);
  assert.match(app, /localStorage\.getItem\('labs-theme'\)/);
  assert.match(app, /localStorage\.setItem\('labs-theme', theme\)/);
  assert.match(html, /<div class="ambient-visual" aria-hidden="true"><canvas id="lab-signal-field"><\/canvas><\/div>/);
  assert.match(css, /\.ambient-visual\{position:fixed;[^}]*pointer-events:none/);
  assert.match(css, /main\{position:relative;z-index:1\}/);
  assert.match(css, /#lab-signal-field\{display:none\}/);
  assert.match(app, /initLabAmbient\(\)/);
  assert.match(app, /new Event\('labs-themechange'\)/);
});

test('pages never use inline scripts, which the production CSP (script-src self) would block', async () => {
  for (const page of ['../apps/labs/index.html', '../apps/portfolio/index.html', '../apps/portfolio/404.html']) {
    const html = await readFile(new URL(page, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i, `${page} has an inline <script>`);
    assert.doesNotMatch(html, /\son[a-z]+="/i, `${page} has an inline event handler`);
  }
});

test('theme bootstrap applies saved or system theme and the js class', async () => {
  const source = await readFile(new URL('../apps/labs/theme-init.js', import.meta.url), 'utf8');
  const run = (stored, prefersLight) => {
    const classes = new Set();
    const root = { dataset: {}, classList: { add: (name) => classes.add(name) } };
    const context = { document: { documentElement: root }, localStorage: { getItem: () => stored }, window: { matchMedia: () => ({ matches: prefersLight }) } };
    new Function('document', 'localStorage', 'window', source)(context.document, context.localStorage, context.window);
    return { theme: root.dataset.theme, js: classes.has('js') };
  };
  assert.deepEqual(run('light', false), { theme: 'light', js: true });
  assert.deepEqual(run('dark', true), { theme: 'dark', js: true });
  assert.equal(run(null, true).theme, 'light');
  assert.equal(run(null, false).theme, 'dark');
  assert.equal(run('garbage', false).theme, 'dark');
});
