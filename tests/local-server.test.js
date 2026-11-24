import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Readable } from 'node:stream';
import { MAX_BODY, createAppServer, parseArgs, readBody } from '../scripts/local-server.js';

const servers = [];
const ports = {};
before(async () => {
  for (const name of ['labs', 'portfolio']) {
    const server = createAppServer({ name });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    ports[name] = server.address().port;
  }
});
after(() => servers.forEach((server) => server.close()));

// Raw request so paths such as /%2e%2e/ are sent exactly as written (fetch would normalise them).
function raw(app, method, requestPath, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: ports[app], method, path: requestPath, headers }, (response) => {
      const chunks = [];
      response.on('data', (c) => chunks.push(c));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', reject);
    request.end(body);
  });
}
const json = (response) => JSON.parse(response.text);
const post = (app, requestPath, payload) => raw(app, 'POST', requestPath, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

test('arguments: defaults, single app, port and error cases', () => {
  assert.deepEqual(parseArgs([]), { app: 'both', port: undefined, host: '127.0.0.1' });
  assert.deepEqual(parseArgs(['labs', '--port', '4000']), { app: 'labs', port: 4000, host: '127.0.0.1' });
  assert.throws(() => parseArgs(['--port', '4000']), /single app/);
  assert.throws(() => parseArgs(['labs', '--port', '99999']), /Invalid --port/);
  assert.throws(() => parseArgs(['labs', '--port']), /Invalid --port/);
  assert.throws(() => parseArgs(['nope']), /Unknown argument/);
  assert.throws(() => parseArgs(['--host']), /Missing value/);
});

test('request bodies over the limit are rejected', async () => {
  assert.equal(await readBody(Readable.from([Buffer.from('{"a":1}')])), '{"a":1}');
  await assert.rejects(readBody(Readable.from([Buffer.alloc(MAX_BODY + 1)])), { code: 'TOO_LARGE' });
});

test('labs: home page is served with the production security headers', async () => {
  const response = await raw('labs', 'GET', '/');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /text\/html/);
  assert.match(response.headers['content-security-policy'], /default-src 'self'/);
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.match(response.text, /Security learning labs/);
  const asset = await raw('labs', 'GET', '/lab-interactive.css');
  assert.match(asset.headers['content-type'], /text\/css/);
  const head = await raw('labs', 'HEAD', '/');
  assert.equal(head.status, 200);
  assert.equal(head.text, '');
});

test('labs: files that are not public cannot be fetched', async () => {
  for (const blocked of ['/vercel.json', '/package.json', '/.gitignore', '/api/sqli-challenge.js', '/api/_lib/lab-response.js', '/..%2fpackage.json', '/%2e%2e/%2e%2e/package.json', '/..\\..\\package.json', '/shared/../../../package.json']) {
    const response = await raw('labs', 'GET', blocked);
    assert.ok([404, 400].includes(response.status), `${blocked} gave ${response.status}`);
    assert.doesNotMatch(response.text, /"scripts"|"version": 2/);
  }
  assert.equal((await raw('labs', 'GET', '/%00')).status, 400);
  assert.equal((await raw('labs', 'DELETE', '/')).status, 405);
});

test('labs: the real API handlers run over HTTP, including the full SQLi flow', async () => {
  const normal = await raw('labs', 'GET', '/api/sqli-challenge?q=key');
  assert.equal(normal.status, 200);
  assert.match(normal.headers['cache-control'], /no-store/);
  assert.equal(json(normal).rowCount, 1);

  const injected = await raw('labs', 'GET', `/api/sqli-challenge?q=${encodeURIComponent("x' OR '1'='1")}`);
  const flag = injected.text.match(/flag\{[^}\s]+\}/)[0];

  const wrong = await post('labs', '/api/lab-submit', { challengeId: 'sqli', flag: 'flag{nope}' });
  assert.equal(wrong.status, 400);
  assert.equal(json(wrong).error.code, 'INCORRECT_FLAG');
  const right = await post('labs', '/api/lab-submit', { challengeId: 'sqli', flag });
  assert.equal(right.status, 200);
  assert.equal(json(right).solved, true);
});

test('labs: JWT token is read from the Authorization header and cookie like a proxy would send it', async () => {
  const issued = json(await raw('labs', 'GET', '/api/jwt-challenge')).issuedToken;
  const viaHeader = json(await raw('labs', 'GET', '/api/jwt-challenge', { headers: { Authorization: `Bearer ${issued}` } }));
  assert.equal(viaHeader.session.role, 'guest');
  const viaCookie = json(await raw('labs', 'GET', '/api/jwt-challenge', { headers: { Cookie: `session=${encodeURIComponent(issued)}` } }));
  assert.equal(viaCookie.verified, true);
});

test('labs: bad requests get clean errors, not stack traces', async () => {
  const badJson = await raw('labs', 'POST', '/api/lab-submit', { headers: { 'Content-Type': 'application/json' }, body: '{not json' });
  assert.equal(badJson.status, 400);
  assert.doesNotMatch(badJson.text, /at .*\.js/);
  assert.equal((await raw('labs', 'GET', '/api/nope')).status, 404);
  assert.equal((await raw('labs', 'GET', '/api/..%2fapp')).status, 404);
  assert.equal((await raw('labs', 'DELETE', '/api/sqli-challenge')).status, 405);
  const noBody = await raw('labs', 'POST', '/api/lab-submit', { headers: { 'Content-Type': 'application/json' } });
  assert.equal(noBody.status, 400);
});

test('portfolio: pages, headers, 404 page and clean URLs', async () => {
  const home = await raw('portfolio', 'GET', '/');
  assert.equal(home.status, 200);
  assert.match(home.text, /Naven Tran/);
  assert.equal(home.headers['x-content-type-options'], 'nosniff');
  assert.match((await raw('portfolio', 'GET', '/robots.txt')).headers['content-type'], /text\/plain/);
  const missing = await raw('portfolio', 'GET', '/does-not-exist');
  assert.equal(missing.status, 404);
  assert.match(missing.text, /host unreachable/);
  assert.equal((await raw('portfolio', 'GET', '/404')).status, 200);
  assert.equal((await raw('portfolio', 'GET', '/api/geo.js')).status, 404);
});

test('portfolio: /api/geo uses the location headers when present and 204 otherwise', async () => {
  assert.equal((await raw('portfolio', 'GET', '/api/geo')).status, 204);
  const located = await raw('portfolio', 'GET', '/api/geo', { headers: { 'x-vercel-ip-latitude': '10.8231', 'x-vercel-ip-longitude': '106.6297', 'x-vercel-ip-city': 'Ho%20Chi%20Minh%20City', 'x-vercel-ip-country': 'VN' } });
  assert.equal(located.status, 200);
  assert.deepEqual(json(located), { lat: 10.8, lon: 106.6, city: 'Ho Chi Minh City', country: 'VN', source: 'ip' });
  assert.equal((await post('portfolio', '/api/geo', {})).status, 405);
});
