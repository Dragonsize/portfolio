// Pure helpers for the in-page "Repeater" panel (a tiny Burp-style request editor).
// The parser only accepts requests for ONE allowed same-origin path, so the panel cannot be used
// to reach any other URL, host, or service.

export const MAX_RAW_LENGTH = 6000;
const ALLOWED_METHODS = new Set(['GET', 'POST']);
// Headers the browser lets us set that matter for the labs. Everything else is listed as ignored.
const SENDABLE_HEADERS = new Set(['authorization', 'content-type', 'accept']);

export function buildRawRequest({ method = 'GET', path, query = '', headers = {}, body = '' }) {
  const target = query ? `${path}?${query}` : path;
  const headerLines = Object.entries(headers).map(([name, value]) => `${name}: ${value}`);
  const head = [`${method} ${target} HTTP/1.1`, 'Host: lab.local', ...headerLines].join('\n');
  return body ? `${head}\n\n${body}` : head;
}

export function parseRawRequest(text, allowedPath) {
  const source = String(text ?? '');
  if (!source.trim()) return { error: 'Request is empty.' };
  if (source.length > MAX_RAW_LENGTH) return { error: `Request is longer than ${MAX_RAW_LENGTH} characters.` };
  const normalized = source.replace(/\r\n?/g, '\n');
  const split = normalized.indexOf('\n\n');
  const head = split === -1 ? normalized : normalized.slice(0, split);
  const body = split === -1 ? '' : normalized.slice(split + 2);
  const [requestLine, ...headerLines] = head.split('\n');

  const match = /^([A-Za-z]+)\s+(\S+)(?:\s+HTTP\/[\d.]+)?\s*$/.exec(requestLine.trim());
  if (!match) return { error: 'First line must look like: GET /path?query HTTP/1.1' };
  const method = match[1].toUpperCase();
  if (!ALLOWED_METHODS.has(method)) return { error: `Method ${method} is not available in this lab (use GET or POST).` };
  const target = match[2];
  if (!target.startsWith('/') || target.startsWith('//')) return { error: 'Request target must be a path on this lab, such as ' + allowedPath };
  const questionMark = target.indexOf('?');
  const path = questionMark === -1 ? target : target.slice(0, questionMark);
  const query = questionMark === -1 ? '' : target.slice(questionMark + 1);
  if (path !== allowedPath) return { error: `Only ${allowedPath} is reachable from this panel.` };

  const headers = {}, ignored = [];
  for (const line of headerLines) {
    if (!line.trim()) continue;
    const colon = line.indexOf(':');
    if (colon < 1) return { error: `Malformed header line: ${line.slice(0, 40)}` };
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!/^[A-Za-z0-9-]+$/.test(name) || /[\r\n]/.test(value)) return { error: `Invalid header: ${name.slice(0, 40)}` };
    if (SENDABLE_HEADERS.has(name.toLowerCase())) headers[name] = value; else ignored.push(name);
  }
  if (method === 'POST' && body && !Object.keys(headers).some((n) => n.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
  return { method, path, query, url: query ? `${path}?${query}` : path, headers, body: method === 'POST' ? body : '', ignored };
}

// Adds fixed=1 to the query so the same request can be replayed against the patched build.
export function withFixedBuild(parsed) {
  const params = new URLSearchParams(parsed.query);
  params.set('fixed', '1');
  const query = params.toString();
  return { ...parsed, query, url: `${parsed.path}?${query}` };
}

export function formatRawResponse({ status, statusText = '', contentType = '', body = '' }) {
  let pretty = body;
  if (/json/i.test(contentType)) { try { pretty = JSON.stringify(JSON.parse(body), null, 2); } catch { /* keep raw */ } }
  return `HTTP/1.1 ${status} ${statusText}`.trimEnd() + `\nContent-Type: ${contentType || 'unknown'}\n\n${pretty}`;
}

export function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('Not base64url');
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}
