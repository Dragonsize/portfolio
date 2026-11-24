// Approximate visitor position: Vercel IP headers via /api/geo, falling back to a timezone guess.
// Runs in the browser only; the result is never sent anywhere.

const ZONES = {
  'Asia/Ho_Chi_Minh': [10.8, 106.7, 'Ho Chi Minh City'], 'Asia/Saigon': [10.8, 106.7, 'Ho Chi Minh City'],
  'Asia/Bangkok': [13.8, 100.5, 'Bangkok'], 'Asia/Singapore': [1.35, 103.8, 'Singapore'], 'Asia/Jakarta': [-6.2, 106.8, 'Jakarta'],
  'Asia/Manila': [14.6, 121, 'Manila'], 'Asia/Hong_Kong': [22.3, 114.2, 'Hong Kong'], 'Asia/Shanghai': [31.2, 121.5, 'Shanghai'],
  'Asia/Taipei': [25, 121.5, 'Taipei'], 'Asia/Seoul': [37.6, 127, 'Seoul'], 'Asia/Tokyo': [35.7, 139.7, 'Tokyo'],
  'Asia/Kolkata': [22.6, 88.4, 'Kolkata'], 'Asia/Calcutta': [22.6, 88.4, 'Kolkata'], 'Asia/Dubai': [25.2, 55.3, 'Dubai'],
  'Europe/London': [51.5, -0.1, 'London'], 'Europe/Paris': [48.9, 2.35, 'Paris'], 'Europe/Berlin': [52.5, 13.4, 'Berlin'],
  'Europe/Madrid': [40.4, -3.7, 'Madrid'], 'Europe/Rome': [41.9, 12.5, 'Rome'], 'Europe/Amsterdam': [52.4, 4.9, 'Amsterdam'],
  'Europe/Moscow': [55.8, 37.6, 'Moscow'], 'Europe/Istanbul': [41, 29, 'Istanbul'],
  'America/New_York': [40.7, -74, 'New York'], 'America/Chicago': [41.9, -87.6, 'Chicago'], 'America/Denver': [39.7, -105, 'Denver'],
  'America/Los_Angeles': [34.1, -118.2, 'Los Angeles'], 'America/Toronto': [43.7, -79.4, 'Toronto'], 'America/Sao_Paulo': [-23.5, -46.6, 'Sao Paulo'],
  'America/Mexico_City': [19.4, -99.1, 'Mexico City'], 'Australia/Sydney': [-33.9, 151.2, 'Sydney'], 'Australia/Melbourne': [-37.8, 145, 'Melbourne'],
  'Pacific/Auckland': [-36.8, 174.8, 'Auckland'], 'Africa/Cairo': [30, 31.2, 'Cairo'], 'Africa/Lagos': [6.5, 3.4, 'Lagos'],
  'Africa/Johannesburg': [-26.2, 28, 'Johannesburg']
};
const REGION_LAT = { Europe: 50, America: 35, Asia: 28, Australia: -30, Africa: 5, Pacific: -15, Atlantic: 35, Indian: -10, Antarctica: -75 };

// offsetMinutes follows Date#getTimezoneOffset (UTC+7 => -420).
export function guessFromTimezone(timeZone, offsetMinutes) {
  const known = ZONES[timeZone];
  if (known) return { lat: known[0], lon: known[1], city: known[2], country: '', source: 'timezone' };
  const region = String(timeZone || '').split('/')[0];
  const lon = Math.max(-180, Math.min(180, (-offsetMinutes / 60) * 15)) + 0; // + 0 turns -0 into 0
  const city = String(timeZone || '').split('/').pop().replace(/_/g, ' ');
  return { lat: REGION_LAT[region] ?? 20, lon, city: city || 'Unknown', country: '', source: 'timezone' };
}

export async function locateVisitor({ timeoutMs = 2500 } = {}) {
  const fallback = () => guessFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date().getTimezoneOffset());
  if (!['http:', 'https:'].includes(location.protocol)) return fallback();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('/api/geo', { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')) return fallback();
    const data = await response.json();
    if (!Number.isFinite(data?.lat) || !Number.isFinite(data?.lon)) return fallback();
    return { lat: data.lat, lon: data.lon, city: String(data.city || ''), country: String(data.country || ''), source: 'ip' };
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
