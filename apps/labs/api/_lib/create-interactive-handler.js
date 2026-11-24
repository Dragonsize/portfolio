import { error, methodNotAllowed, options, success, setCommonHeaders } from './lab-response.js';
import { runInteractiveLab } from './interactive-labs.js';
import { allow, clientKey } from './rate-limit.js';

const MAX_FIELD = 2000;

function cookieValue(header, name) {
  if (typeof header !== 'string') return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return undefined;
}

// Collect request fields from query, JSON body, headers and cookies so that intercepting proxies
// (Burp, etc.) can tamper with any of them. Every value is coerced to a bounded string.
export function collectParams(req) {
  const merged = { ...(req.query || {}), ...(req.body && typeof req.body === 'object' ? req.body : {}) };
  const out = {};
  for (const [key, value] of Object.entries(merged)) {
    if (['string', 'number'].includes(typeof value)) out[key] = String(value).slice(0, MAX_FIELD);
  }
  // A real Origin header (for example sent by Burp) counts like the "origin" field the built-in editor uses.
  if (out.origin === undefined && typeof req.headers?.origin === 'string') out.origin = req.headers.origin.slice(0, 80);
  // Set by the server after merging, so a client cannot claim a different request method.
  out.__method = String(req.method || 'GET');
  const auth = req.headers?.authorization;
  if (out.token === undefined && typeof auth === 'string' && /^bearer\s+/i.test(auth)) out.token = auth.replace(/^bearer\s+/i, '').slice(0, MAX_FIELD);
  if (out.token === undefined) {
    const cookie = cookieValue(req.headers?.cookie, 'session');
    if (cookie) out.token = decodeURIComponent(cookie).slice(0, MAX_FIELD);
  }
  return out;
}

export function createInteractiveHandler(labId) {
  return function handler(req, res) {
    const methods = ['GET', 'POST', 'OPTIONS'];
    if (options(req, res, methods)) return;
    if (!methods.includes(req.method)) return methodNotAllowed(res, methods);
    const limit = allow(`${labId}:${clientKey(req)}`);
    if (!limit.ok) {
      res.setHeader('Retry-After', String(limit.retryAfter));
      return error(res, 429, 'RATE_LIMITED', 'Too many requests. These labs need no scanners; slow down and inspect each response.');
    }
    const result = runInteractiveLab(labId, collectParams(req));
    if (!result.ok) { setCommonHeaders(res); return res.status(result.status).json(result.body); }
    return success(res, result.body);
  };
}
