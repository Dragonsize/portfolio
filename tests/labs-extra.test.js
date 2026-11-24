import test from 'node:test';
import assert from 'node:assert/strict';
import { runInteractiveLab, verifyInteractiveFlag } from '../apps/labs/api/_lib/interactive-labs.js';
import { createInteractiveHandler } from '../apps/labs/api/_lib/create-interactive-handler.js';
import { resetRateLimit } from '../apps/labs/api/_lib/rate-limit.js';

const FLAG = /flag\{[^}\s]+\}/;
const run = (id, params) => runInteractiveLab(id, params);
const flagIn = (result) => JSON.stringify(result.body).match(FLAG)?.[0];
const fakeRes = () => ({ statusCode: 0, headers: {}, body: undefined, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } });

test('csrf: a cross-site forged transfer works on the vulnerable build and leaks the flag', () => {
  const session = run('csrf', {}).body;
  assert.match(session.csrfToken, /^lab-csrf-/);
  const legit = run('csrf', { to: 'friend', amount: '25', origin: 'https://bank.lab', token: session.csrfToken, __method: 'POST' });
  assert.equal(legit.status, 200);
  assert.equal(legit.body.crossSite, false);
  assert.equal(flagIn(legit), undefined);
  const forged = run('csrf', { to: 'mallory', amount: '500', origin: 'https://evil.example', __method: 'POST' });
  assert.equal(forged.status, 200);
  assert.equal(forged.body.crossSite, true);
  assert.equal(verifyInteractiveFlag('csrf', flagIn(forged)), true);
  assert.equal(run('csrf', { to: 'mallory', amount: '5', origin: 'https://evil.example', __method: 'GET' }).status, 200);
});

test('csrf: the patched build needs POST, a same-site origin and the token', () => {
  const token = run('csrf', { fixed: '1' }).body.csrfToken;
  const forged = { to: 'mallory', amount: '500', origin: 'https://evil.example', __method: 'POST', fixed: '1' };
  assert.equal(run('csrf', forged).status, 403);
  assert.equal(run('csrf', { ...forged, origin: 'https://bank.lab' }).status, 403);
  assert.equal(run('csrf', { ...forged, origin: 'https://bank.lab', token, __method: 'GET' }).status, 405);
  const ok = run('csrf', { ...forged, origin: 'https://bank.lab', token });
  assert.equal(ok.status, 200);
  assert.equal(flagIn(ok), undefined);
  assert.equal(run('csrf', { to: 'x', amount: '5000' }).status, 400);
  assert.equal(run('csrf', { to: 'you', amount: '5' }).status, 400);
});

test('auth: errors reveal accounts, the factory default admin password opens the panel', () => {
  assert.equal(run('auth', { user: 'zed', password: 'x' }).body.error, 'No such user: zed');
  assert.equal(run('auth', { user: 'alice', password: 'x' }).body.error, 'Wrong password for alice');
  const admin = run('auth', { user: 'admin', password: 'admin123' });
  assert.equal(admin.status, 200);
  assert.equal(admin.body.role, 'admin');
  assert.equal(verifyInteractiveFlag('auth', flagIn(admin)), true);
  assert.equal(flagIn(run('auth', { user: 'bob', password: 'correct-horse-battery' })), undefined);
});

test('auth: the patched build has no default, one generic error and a lockout', () => {
  const a = run('auth', { user: 'zed', password: 'x', fixed: '1' });
  const b = run('auth', { user: 'alice', password: 'x', fixed: '1' });
  assert.equal(a.status, 401);
  assert.deepEqual(a.body, b.body);
  const adminDefault = run('auth', { user: 'admin', password: 'admin123', fixed: '1' });
  assert.equal(adminDefault.status, 401);
  assert.equal(flagIn(adminDefault), undefined);
  assert.equal(run('auth', { user: 'alice', password: 'Wint3r!2024', fixed: '1' }).body.role, 'user');
  assert.equal(run('auth', { user: 'alice', password: 'Wint3r!2024', attempt: '5', fixed: '1' }).status, 429);
});

test('path: level 1 traversal and the level 2 nested bypass both reach the private notes', () => {
  assert.deepEqual(run('path', {}).body.files, ['guide.txt', 'faq.txt', 'release-notes.txt']);
  assert.equal(run('path', { file: 'guide.txt' }).body.resolved, 'docs/guide.txt');
  assert.equal(run('path', { file: 'missing.txt' }).status, 404);
  const level1 = run('path', { file: '../private/staff-notes.txt', level: '1' });
  assert.equal(verifyInteractiveFlag('path', flagIn(level1)), true);
  assert.equal(run('path', { file: '../private/staff-notes.txt', level: '2' }).status, 404);
  const bypass = run('path', { file: '....//private/staff-notes.txt', level: '2' });
  assert.equal(bypass.body.resolved, 'private/staff-notes.txt');
  assert.equal(verifyInteractiveFlag('path', flagIn(bypass)), true);
  assert.equal(run('path', { file: 'guide.txt\0.png' }).status, 400);
});

test('path: the patched build contains every variant inside docs/', () => {
  for (const [file, level] of [['../private/staff-notes.txt', '1'], ['../private/staff-notes.txt', '2'], ['..\\private\\staff-notes.txt', '1'], ['docs/../../private/staff-notes.txt', '1']]) {
    const result = run('path', { file, level, fixed: '1' });
    assert.equal(result.status, 403, `${file} was not blocked`);
    assert.equal(flagIn(result), undefined);
  }
  // The level 2 nested trick is only a harmless odd file name once the filter is gone: contained and not found.
  const nested = run('path', { file: '....//private/staff-notes.txt', level: '2', fixed: '1' });
  assert.equal(nested.status, 404);
  assert.match(nested.body.resolved, /^docs\//);
  assert.equal(flagIn(nested), undefined);
  assert.equal(run('path', { file: 'faq.txt', fixed: '1' }).status, 200);
});

test('ssrf: level 2 blocks the obvious names, but numeric hosts reach the metadata service', () => {
  assert.equal(run('ssrf', { url: 'http://catalog.lab/products' }).status, 200);
  assert.equal(run('ssrf', { url: 'http://localhost/', level: '1' }).body.upstream, 'internal-admin');
  assert.equal(run('ssrf', { url: 'http://localhost/', level: '2' }).status, 403);
  assert.equal(run('ssrf', { url: 'http://169.254.169.254/latest/meta-data/', level: '2' }).status, 403);
  assert.equal(run('ssrf', { url: 'http://2130706433/', level: '2' }).body.upstream, 'internal-admin');
  assert.equal(run('ssrf', { url: 'http://127.1/', level: '2' }).body.resolvedHost, '127.0.0.1');
  assert.equal(run('ssrf', { url: 'http://[::1]/', level: '2' }).body.upstream, 'internal-admin');
  const listing = run('ssrf', { url: 'http://2852039166/latest/meta-data/', level: '2' });
  assert.deepEqual(listing.body.preview.listing, ['iam/']);
  const creds = run('ssrf', { url: 'http://0xa9fea9fe/latest/meta-data/iam/security-credentials/lab-role', level: '2' });
  assert.equal(creds.body.resolvedHost, '169.254.169.254');
  assert.equal(verifyInteractiveFlag('ssrf', flagIn(creds)), true);
});

test('ssrf: no request is ever made, bad input is rejected, the patched build uses an allowlist', () => {
  for (const url of ['http://catalog.lab/', 'http://localhost/', 'http://2852039166/latest/meta-data/', 'file:///etc/passwd', 'nope']) {
    assert.notEqual(run('ssrf', { url }).body.outboundRequestMade, true);
  }
  assert.equal(run('ssrf', { url: 'file:///etc/passwd' }).status, 400);
  assert.equal(run('ssrf', { url: 'not a url' }).status, 400);
  assert.equal(run('ssrf', { url: 'http://unknown.example/' }).status, 502);
  for (const url of ['http://localhost/', 'http://2130706433/', 'http://2852039166/latest/meta-data/iam/security-credentials/lab-role', 'http://[::1]/']) {
    const result = run('ssrf', { url, level: '2', fixed: '1' });
    assert.equal(result.status, 403, `${url} was not blocked`);
    assert.equal(flagIn(result), undefined);
  }
  assert.equal(run('ssrf', { url: 'http://catalog.lab/products', fixed: '1' }).status, 200);
});

test('secrets: clues in headers and robots.txt lead to the leaked .env file', () => {
  const home = run('secrets', { path: '/' }).body;
  assert.equal(home.headers['X-Powered-By'], 'Express 4.17.1');
  assert.match(run('secrets', { path: '/robots.txt' }).body.body, /Disallow: \/debug/);
  const debug = run('secrets', { path: '/debug' }).body.body;
  assert.ok(debug.files.includes('.env'));
  assert.match(debug.database, /postgres:\/\//);
  const env = run('secrets', { path: '/.env' });
  assert.equal(verifyInteractiveFlag('secrets', flagIn(env)), true);
  const crash = run('secrets', { path: '/orders/abc' }).body;
  assert.equal(crash.status, 500);
  assert.match(JSON.stringify(crash.body.stack), /orders\.js/);
  assert.equal(run('secrets', { path: '/orders/12' }).body.status, 200);
  assert.equal(run('secrets', { path: 'status' }).body.request.path, '/status');
});

test('secrets: the patched build hides debug files, versions and stack traces', () => {
  for (const path of ['/.env', '/debug']) {
    const result = run('secrets', { path, fixed: '1' }).body;
    assert.equal(result.status, 404);
    assert.equal(flagIn({ body: result }), undefined);
  }
  assert.deepEqual(run('secrets', { path: '/', fixed: '1' }).body.headers, {});
  assert.deepEqual(run('secrets', { path: '/status', fixed: '1' }).body.body, { status: 'ok' });
  assert.doesNotMatch(run('secrets', { path: '/robots.txt', fixed: '1' }).body.body, /Disallow: \/debug/);
  const crash = run('secrets', { path: '/orders/abc', fixed: '1' }).body;
  assert.equal(crash.status, 400);
  assert.doesNotMatch(JSON.stringify(crash), /orders\.js|postgres/);
});

test('handler: the real Origin header and request method reach the CSRF lab, and cannot be spoofed', () => {
  resetRateLimit();
  const handler = createInteractiveHandler('csrf');
  const forged = fakeRes();
  handler({ method: 'POST', query: {}, body: { to: 'mallory', amount: '5' }, headers: { origin: 'https://evil.example' }, socket: {} }, forged);
  assert.equal(forged.statusCode, 200);
  assert.equal(forged.body.crossSite, true);
  assert.match(JSON.stringify(forged.body), FLAG);
  const spoofed = fakeRes();
  handler({ method: 'GET', query: { to: 'a', amount: '5', fixed: '1', __method: 'POST', origin: 'https://bank.lab' }, headers: {}, socket: {} }, spoofed);
  assert.equal(spoofed.statusCode, 405);
  resetRateLimit();
});

test('every lab endpoint file is wired to the interactive handler', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const [file, id] of [['csrf-challenge', 'csrf'], ['auth-challenge', 'auth'], ['path-traversal', 'path'], ['ssrf-challenge', 'ssrf'], ['secrets-challenge', 'secrets'], ['sqli-challenge', 'sqli'], ['jwt-challenge', 'jwt'], ['xss-challenge', 'xss']]) {
    const source = await readFile(new URL(`../apps/labs/api/${file}.js`, import.meta.url), 'utf8');
    assert.match(source, new RegExp(`createInteractiveHandler\\('${id}'\\)`), `${file} is not wired to ${id}`);
  }
});
