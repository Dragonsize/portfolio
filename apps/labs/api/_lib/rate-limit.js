// Best-effort in-memory limiter. Serverless instances do not share memory, so this only blunts
// accidental scanner floods against one warm instance; it is not a security control.
// Only a hashed-free, truncated client key is held in memory and nothing is logged.
const WINDOW_MS = 10_000;
const MAX_REQUESTS = 40;
const MAX_KEYS = 2000;
const hits = new Map();

export function clientKey(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
  return (first || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

export function allow(key, now = Date.now()) {
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) { hits.set(key, recent); return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) }; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value);
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimit() { hits.clear(); }
export const RATE_LIMIT = Object.freeze({ WINDOW_MS, MAX_REQUESTS });
