import test from 'node:test';
import assert from 'node:assert/strict';
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
