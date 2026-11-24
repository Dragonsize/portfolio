import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { parseGeoHeaders } from '../apps/portfolio/api/geo.js';
import { guessFromTimezone } from '../apps/portfolio/visitor-geo.js';
import { nearestHosts, spherePoint } from '../apps/portfolio/net-globe.js';

function fakeRes() {
  return { statusCode: 0, headers: {}, body: undefined, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
}

test('geo headers are parsed, rounded and sanitised', () => {
  const geo = parseGeoHeaders({ 'x-vercel-ip-latitude': '10.8231', 'x-vercel-ip-longitude': '106.6297', 'x-vercel-ip-city': 'Ho%20Chi%20Minh%20City%3Cscript%3E', 'x-vercel-ip-country': 'vn' });
  assert.deepEqual(geo, { lat: 10.8, lon: 106.6, city: 'Ho Chi Minh Cityscript', country: 'VN', source: 'ip' });
});

test('missing or out-of-range coordinates return null', () => {
  assert.equal(parseGeoHeaders({}), null);
  assert.equal(parseGeoHeaders({ 'x-vercel-ip-latitude': '95', 'x-vercel-ip-longitude': '10' }), null);
  assert.equal(parseGeoHeaders({ 'x-vercel-ip-latitude': 'abc', 'x-vercel-ip-longitude': '10' }), null);
});

test('handler returns JSON, 204 without headers, and rejects non-GET', () => {
  const ok = handler({ method: 'GET', headers: { 'x-vercel-ip-latitude': '1', 'x-vercel-ip-longitude': '2' } }, fakeRes());
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers['Cache-Control'], 'private, no-store');
  assert.equal(ok.body.lat, 1);
  assert.equal(handler({ method: 'GET', headers: {} }, fakeRes()).statusCode, 204);
  assert.equal(handler({ method: 'POST', headers: {} }, fakeRes()).statusCode, 405);
});

test('timezone fallback uses known zones, then UTC offset', () => {
  assert.equal(guessFromTimezone('Asia/Ho_Chi_Minh', -420).city, 'Ho Chi Minh City');
  const guess = guessFromTimezone('Europe/Lisbon', 0);
  assert.equal(guess.lat, 50);
  assert.equal(guess.lon, 0);
  assert.equal(guess.city, 'Lisbon');
  assert.equal(guessFromTimezone('Asia/Unknown_Place', -420).lon, 105);
});

test('nearest hosts are ordered by angular distance', () => {
  const pts = [spherePoint(0, 90), spherePoint(0, 5), spherePoint(0, -40)];
  assert.deepEqual(nearestHosts(spherePoint(0, 0), pts, 2), [1, 2]);
});
