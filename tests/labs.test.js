import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHALLENGES, challengeById } from '../apps/labs/shared/challenge-registry.js';
import { knownChallenge, runScenario, verifyFlag } from '../apps/labs/api/_lib/lab-scenarios.js';

const solveInputs = {
  sqli: "42' OR '1'='1", xss: '<demo>', csrf: 'cross-site POST without token', jwt: 'alg=none', auth: 'default access enabled', path: '../virtual://private', ssrf: 'lab://internal/catalog', secrets: 'diagnostic output enabled'
};

test('registry has eight unique valid challenge routes', () => {
  assert.equal(CHALLENGES.length, 8);
  assert.equal(challengeById.size, 8);
  CHALLENGES.forEach((challenge) => {
    assert.match(challenge.endpoint, /^\/api\//);
    assert.ok(challenge.title && challenge.objectives.length && challenge.remediation.length);
  });
});

test('each simulator yields controlled evidence and a verifier-only flag', () => {
  for (const challenge of CHALLENGES) {
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

test('XSS simulator returns escaped fixture text, not executable HTML', () => {
  const result = runScenario('xss', '<script>demo</script>');
  assert.equal(result.artifact.escapedPreview.includes('<script>'), false);
  assert.match(result.artifact.escapedPreview, /&lt;script&gt;/);
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
  assert.match(html, /<html lang="en" data-theme="light">/);
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
