import test from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGES } from '../apps/labs/shared/challenge-registry.js';
import { _test, issueGuestToken, runInteractiveLab, verifyInteractiveFlag } from '../apps/labs/api/_lib/interactive-labs.js';
import { collectParams, createInteractiveHandler } from '../apps/labs/api/_lib/create-interactive-handler.js';
import { RATE_LIMIT, allow, resetRateLimit } from '../apps/labs/api/_lib/rate-limit.js';
import { knownChallenge, verifyFlag } from '../apps/labs/api/_lib/lab-scenarios.js';
import { base64UrlDecode, base64UrlEncode, buildRawRequest, parseRawRequest, withFixedBuild } from '../apps/labs/shared/repeater.js';
import { INTERACTIVE } from '../apps/labs/shared/interactive-config.js';

const FLAG = /flag\{[^}\s]+\}/;
const body = (id, params) => runInteractiveLab(id, params).body;
const unsignedAdminToken = () => `${_test.b64urlEncode({ alg: 'none', typ: 'JWT' })}.${_test.b64urlEncode({ sub: 'guest42', role: 'admin' })}.`;
function fakeRes() {
  return { statusCode: 0, headers: {}, body: undefined, ended: false, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { this.ended = true; return this; } };
}

test('all eight labs are interactive, have config, and are known to the verifier', () => {
  const interactive = CHALLENGES.filter((c) => c.interactive).map((c) => c.id).sort();
  assert.deepEqual(interactive, ['auth', 'csrf', 'jwt', 'path', 'secrets', 'sqli', 'ssrf', 'xss']);
  interactive.forEach((id) => {
    assert.ok(INTERACTIVE[id].hints.length >= 3);
    assert.equal(INTERACTIVE[id].patches.filter((p) => p.correct).length, 1);
    assert.equal(knownChallenge(id), true);
  });
});

test('sqli: normal search hides the internal row, a quote leaks the query, OR reveals the flag', () => {
  const normal = body('sqli', { q: 'key' });
  assert.equal(normal.rowCount, 1);
  assert.doesNotMatch(JSON.stringify(normal), FLAG);
  const broken = runInteractiveLab('sqli', { q: "key'" });
  assert.equal(broken.status, 500);
  assert.match(broken.body.error, /syntax error/);
  const injected = body('sqli', { q: "x' OR '1'='1" });
  assert.equal(injected.rowCount, 4);
  const flag = JSON.stringify(injected).match(FLAG)[0];
  assert.equal(verifyFlag('sqli', flag), true);
  assert.equal(verifyFlag('sqli', 'flag{wrong}'), false);
});

test('sqli: the patched build treats injection text as a literal and returns nothing', () => {
  const fixed = body('sqli', { q: "x' OR '1'='1", fixed: '1' });
  assert.equal(fixed.rowCount, 0);
  assert.deepEqual(fixed.boundParameters, ["%x' OR '1'='1%"]);
  assert.doesNotMatch(JSON.stringify(fixed), FLAG);
});

test('jwt: no token issues a guest token that verifies as a guest', () => {
  const issued = body('jwt', {}).issuedToken;
  const result = body('jwt', { token: issued });
  assert.equal(result.verified, true);
  assert.equal(result.session.role, 'guest');
  assert.equal(result.adminPanel, undefined);
});

test('jwt: editing the role breaks the signature, alg none forges admin and leaks the flag', () => {
  const [h, , s] = issueGuestToken().split('.');
  const tampered = `${h}.${_test.b64urlEncode({ sub: 'guest42', role: 'admin', exp: _test.NOW + 100 })}.${s}`;
  const rejected = body('jwt', { token: tampered });
  assert.equal(rejected.verified, false);
  assert.equal(rejected.session.role, 'guest');
  const forged = body('jwt', { token: unsignedAdminToken() });
  assert.equal(forged.verified, true);
  assert.equal(forged.session.role, 'admin');
  assert.equal(verifyFlag('jwt', forged.adminPanel.internalNote.match(FLAG)[0]), true);
});

test('jwt: expired tokens and malformed tokens are refused; the patched build rejects alg none', () => {
  const expired = `${_test.b64urlEncode({ alg: 'none' })}.${_test.b64urlEncode({ role: 'admin', exp: 1 })}.`;
  assert.equal(body('jwt', { token: expired }).verified, false);
  assert.equal(runInteractiveLab('jwt', { token: 'abc' }).status, 400);
  assert.equal(runInteractiveLab('jwt', { token: 'a.b.c' }).status, 400);
  const fixed = body('jwt', { token: unsignedAdminToken(), fixed: '1' });
  assert.equal(fixed.verified, false);
  assert.match(fixed.reason, /allowlist/);
  assert.equal(fixed.adminPanel, undefined);
  const fixedGuest = body('jwt', { token: body('jwt', { fixed: '1' }).issuedToken, fixed: '1' });
  assert.equal(fixedGuest.verified, true);
});

test('xss: level 1 fires on script, level 2 strips script but event handlers still fire', () => {
  assert.equal(body('xss', { q: '<b>hello</b>', level: '1' }).wouldExecute, false);
  assert.equal(body('xss', { q: '<script>alert(1)</script>', level: '1' }).wouldExecute, true);
  assert.equal(body('xss', { q: '<script>alert(1)</script>', level: '2' }).wouldExecute, false);
  const handler = body('xss', { q: '<img src=x onerror=alert(1)>', level: '2' });
  assert.equal(handler.wouldExecute, true);
  assert.equal(verifyFlag('xss', handler.simulatedAlert.message.match(FLAG)[0]), true);
});

test('xss: reflection is always escaped text and the patched build never fires', () => {
  const result = body('xss', { q: '<img src=x onerror=alert(1)>', level: '1' });
  assert.doesNotMatch(result.escapedReflection, /<img/);
  assert.match(result.escapedReflection, /&lt;img/);
  const fixed = body('xss', { q: '<img src=x onerror=alert(1)>', level: '2', fixed: '1' });
  assert.equal(fixed.wouldExecute, false);
  assert.equal(fixed.simulatedAlert, undefined);
});

test('flags are only in leaked data, never a top-level field', () => {
  ['sqli', 'jwt', 'xss'].forEach((id) => {
    const response = body(id, { q: 'hello' });
    assert.equal(response.flag, undefined);
  });
  assert.equal(verifyInteractiveFlag('nope', 'x'), false);
  assert.equal(runInteractiveLab('nope').status, 404);
});

test('handler reads query, JSON body, bearer header and session cookie; enforces methods', () => {
  const token = unsignedAdminToken();
  assert.equal(collectParams({ query: { q: 'a' }, body: { level: 2 }, headers: {} }).level, '2');
  assert.equal(collectParams({ headers: { authorization: `Bearer ${token}` } }).token, token);
  assert.equal(collectParams({ headers: { cookie: `theme=x; session=${encodeURIComponent(token)}` } }).token, token);
  assert.equal(collectParams({ query: { q: 'x'.repeat(5000) } }).q.length, 2000);
  assert.equal(collectParams({ query: { q: { nested: 1 } } }).q, undefined);
  resetRateLimit();
  const handler = createInteractiveHandler('jwt');
  const res = fakeRes();
  handler({ method: 'GET', query: {}, headers: { authorization: `Bearer ${token}` }, socket: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.session.role, 'admin');
  const deleted = fakeRes();
  handler({ method: 'DELETE', headers: {}, socket: {} }, deleted);
  assert.equal(deleted.statusCode, 405);
  const preflight = fakeRes();
  handler({ method: 'OPTIONS', headers: {}, socket: {} }, preflight);
  assert.equal(preflight.statusCode, 204);
});

test('rate limit blocks floods per client and recovers after the window', () => {
  resetRateLimit();
  const t0 = 1_000_000;
  for (let i = 0; i < RATE_LIMIT.MAX_REQUESTS; i += 1) assert.equal(allow('c1', t0 + i).ok, true);
  const blocked = allow('c1', t0 + 100);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1);
  assert.equal(allow('c2', t0 + 100).ok, true);
  assert.equal(allow('c1', t0 + RATE_LIMIT.WINDOW_MS + 1000).ok, true);
  resetRateLimit();
  const handler = createInteractiveHandler('sqli');
  let last;
  for (let i = 0; i <= RATE_LIMIT.MAX_REQUESTS; i += 1) { last = fakeRes(); handler({ method: 'GET', query: { q: 'a' }, headers: { 'x-forwarded-for': '9.9.9.9' }, socket: {} }, last); }
  assert.equal(last.statusCode, 429);
  assert.ok(last.headers['Retry-After']);
  resetRateLimit();
});

test('repeater parses only the lab endpoint and only safe methods and headers', () => {
  const ok = parseRawRequest(buildRawRequest({ path: '/api/sqli-challenge', query: 'q=key', headers: { Authorization: 'Bearer x', Cookie: 'a=b' } }), '/api/sqli-challenge');
  assert.equal(ok.method, 'GET');
  assert.equal(ok.url, '/api/sqli-challenge?q=key');
  assert.deepEqual(ok.headers, { Authorization: 'Bearer x' });
  assert.deepEqual(ok.ignored.sort(), ['Cookie', 'Host']);
  assert.match(parseRawRequest('GET /api/other HTTP/1.1', '/api/sqli-challenge').error, /Only \/api\/sqli-challenge/);
  assert.match(parseRawRequest('GET //evil.test/x HTTP/1.1', '/api/sqli-challenge').error, /path on this lab/);
  assert.match(parseRawRequest('GET https://evil.test/ HTTP/1.1', '/api/sqli-challenge').error, /path on this lab/);
  assert.match(parseRawRequest('DELETE /api/sqli-challenge HTTP/1.1', '/api/sqli-challenge').error, /not available/);
  assert.match(parseRawRequest('', '/x').error, /empty/);
  assert.match(parseRawRequest('nonsense', '/x').error, /First line/);
  assert.match(parseRawRequest('GET /api/a HTTP/1.1\nbad header line', '/api/a').error, /Malformed header/);
  assert.match(parseRawRequest('x'.repeat(7000), '/x').error, /longer than/);
});

test('repeater POST gets a JSON content type, GET drops the body, fixed build is appended', () => {
  const post = parseRawRequest('POST /api/xss-challenge HTTP/1.1\n\n{"q":"hi"}', '/api/xss-challenge');
  assert.equal(post.headers['Content-Type'], 'application/json');
  assert.equal(post.body, '{"q":"hi"}');
  const get = parseRawRequest('GET /api/xss-challenge?q=a HTTP/1.1\n\nignored', '/api/xss-challenge');
  assert.equal(get.body, '');
  assert.equal(withFixedBuild(get).url, '/api/xss-challenge?q=a&fixed=1');
});

test('base64url helpers round-trip unicode and reject invalid input', () => {
  const text = '{"name":"Naven Trần","role":"admin"}';
  assert.equal(base64UrlDecode(base64UrlEncode(text)), text);
  assert.doesNotMatch(base64UrlEncode('??>>'), /[+/=]/);
  assert.throws(() => base64UrlDecode('not valid!'));
});
