// Returns the visitor's approximate (city-level) location from Vercel's IP geolocation headers.
// Nothing is stored or logged. No IP address is returned.

function header(headers, name) {
  const value = headers?.[name];
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : '';
}
function decodeCity(raw) {
  try { return decodeURIComponent(raw); } catch { return ''; }
}

export function parseGeoHeaders(headers) {
  const lat = Number.parseFloat(header(headers, 'x-vercel-ip-latitude'));
  const lon = Number.parseFloat(header(headers, 'x-vercel-ip-longitude'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const clean = (text, max) => text.replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, max);
  return {
    lat: Math.round(lat * 10) / 10,
    lon: Math.round(lon * 10) / 10,
    city: clean(decodeCity(header(headers, 'x-vercel-ip-city')), 40),
    country: clean(header(headers, 'x-vercel-ip-country'), 2).toUpperCase(),
    source: 'ip'
  };
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Use GET.' });
  }
  const geo = parseGeoHeaders(req.headers);
  if (!geo) return res.status(204).end();
  return res.status(200).json(geo);
}
