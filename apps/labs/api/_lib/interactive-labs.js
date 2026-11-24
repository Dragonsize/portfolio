// Deterministic request-driven simulations for the rebuilt labs (sqli, jwt, xss).
// Nothing executes: no real database, no DOM rendering, no real token crypto. Every response is
// computed from fixtures, so the same request always gives the same answer. Flags live inside
// "leaked" data the user must find; they are never returned as a dedicated field.
//
// Each lab has two builds. The default build is vulnerable by design. Sending fixed=1 simulates the
// patched build so learners can replay their exploit and watch the fix work.

const FLAGS = Object.freeze({
  sqli: 'flag{uni0n_select_reveals_all}',
  jwt: 'flag{alg_none_is_never_trusted}',
  xss: 'flag{context_defeats_the_filter}'
});

const isFixed = (params) => params.fixed === '1' || params.fixed === 1 || params.fixed === true;
const parseJson = (s) => { try { return JSON.parse(s); } catch { return null; } };

// ---- SQLi: a fake product search over an in-memory table ------------------
const PRODUCTS = Object.freeze([
  { id: 1, name: 'USB data blocker', price: 12, visibility: 'public' },
  { id: 2, name: 'Hardware security key', price: 45, visibility: 'public' },
  { id: 3, name: 'Faraday sleeve', price: 20, visibility: 'public' },
  { id: 99, name: `ADMIN NOTE: staging creds + ${FLAGS.sqli}`, price: 0, visibility: 'internal' }
]);
const publicRows = (term) => PRODUCTS.filter((p) => p.visibility === 'public' && p.name.toLowerCase().includes(term.toLowerCase()));
const rowView = ({ id, name, price }) => ({ id, name, price });

function sqliLab(params) {
  const q = String(params.q ?? '');
  if (isFixed(params)) {
    const rows = publicRows(q);
    return { ok: true, status: 200, body: { build: 'patched', query: "SELECT id, name, price FROM products WHERE name LIKE ? AND visibility = 'public'", boundParameters: [`%${q}%`], rowCount: rows.length, rows: rows.map(rowView) } };
  }
  const query = `SELECT id, name, price FROM products WHERE name LIKE '%${q}%' AND visibility = 'public'`;
  // The input changes the query's logic when it closes the string and adds OR or UNION.
  const injected = /'\s*(or|union)\b/i.test(q);
  if (injected) {
    return { ok: true, status: 200, body: { build: 'vulnerable', query, rowCount: PRODUCTS.length, rows: PRODUCTS.map(rowView) } };
  }
  if (q.includes("'")) {
    return { ok: false, status: 500, body: { build: 'vulnerable', error: `SQLSTATE[42000]: syntax error near ${JSON.stringify(q.slice(0, 24))}`, query } };
  }
  const rows = publicRows(q);
  return { ok: true, status: 200, body: { build: 'vulnerable', query, rowCount: rows.length, rows: rows.map(rowView) } };
}

// ---- JWT: a demo session verifier ----------------------------------------
// Real HMAC is deliberately not used. A small deterministic stand-in produces the "signature" so the
// lab teaches the concept (what a verifier trusts) without shipping crypto that could be misread.
const b64urlEncode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (s) => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8');
};
const NOW = 1_770_000_000; // fixed clock keeps results deterministic
const SECRETS = Object.freeze({ vulnerable: 'lab-demo-secret', patched: 'patched-demo-secret' });
function demoSignature(headerPart, payloadPart, secret) {
  let h = 2166136261;
  for (const ch of `${headerPart}.${payloadPart}.${secret}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(16).padStart(8, '0');
}
export function issueGuestToken(build = 'vulnerable') {
  const header = b64urlEncode({ alg: 'HS256', typ: 'JWT' });
  const payload = b64urlEncode({ sub: 'guest42', role: 'guest', exp: NOW + 86_400 });
  return `${header}.${payload}.${demoSignature(header, payload, SECRETS[build])}`;
}

function jwtLab(params) {
  const fixed = isFixed(params);
  const build = fixed ? 'patched' : 'vulnerable';
  const token = String(params.token ?? '').trim();
  if (!token) return { ok: true, status: 200, body: { build, message: 'No token supplied. Here is a guest session token for your browser.', issuedToken: issueGuestToken(build) } };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, status: 400, body: { build, error: 'Malformed token: expected header.payload.signature' } };
  const header = parseJson(b64urlDecode(parts[0]) ?? '');
  const payload = parseJson(b64urlDecode(parts[1]) ?? '');
  if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') return { ok: false, status: 400, body: { build, error: 'Could not decode header or payload as JSON' } };

  const alg = String(header.alg ?? '').toLowerCase();
  let verified = false, reason;
  if (alg === 'hs256') {
    verified = parts[2] === demoSignature(parts[0], parts[1], SECRETS[build]);
    reason = verified ? 'HS256 signature valid' : 'HS256 signature does not match the payload';
  } else if (alg === 'none' && !fixed) {
    verified = true; // the bug: the verifier honours the algorithm named inside the token
    reason = 'alg "none" accepted: signature check skipped';
  } else {
    reason = fixed ? `algorithm "${header.alg}" is not on the allowlist (HS256 only)` : `algorithm "${header.alg}" not supported`;
  }
  if (verified && typeof payload.exp === 'number' && payload.exp < NOW) { verified = false; reason = 'token expired'; }

  const role = verified ? String(payload.role ?? 'guest') : 'guest';
  const body = { build, decoded: { header, payload }, verified, reason, session: { user: String(payload.sub ?? 'anonymous'), role } };
  if (verified && role === 'admin') body.adminPanel = { message: 'Welcome, admin.', internalNote: `Incident runbook key: ${FLAGS.jwt}` };
  return { ok: true, status: 200, body };
}

// ---- XSS: a reflected search with an optional naive filter -----------------
// We only classify where the input lands and whether a script-capable construct survives; nothing
// is rendered as markup. The "reflection" is always escaped text.
function xssLab(params) {
  const raw = String(params.q ?? '');
  const level = String(params.level) === '2' ? 2 : 1;
  const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  if (isFixed(params)) {
    return { ok: true, status: 200, body: { build: 'patched', level, filterApplied: 'output encoding for the HTML context', reflectedContext: 'text', sink: 'element.textContent (safe)', escapedReflection: `No results for "${escape(raw)}"`, wouldExecute: false } };
  }
  const filtered = level === 2 ? raw.replace(/<\s*\/?\s*script[^>]*>/gi, '') : raw;
  const hasHandler = /\bon[a-z]+\s*=/i.test(filtered);
  const hasTag = /<\s*[a-z][^>]*>/i.test(filtered);
  const context = /["']/.test(raw) ? 'attribute' : hasTag ? 'html-element' : 'text';
  // Script-capable: an event-handler attribute at any level, or a script/img/svg element at level 1.
  const wouldExecute = hasHandler || (level === 1 && /<\s*(script|img|svg)\b/i.test(filtered));
  const body = {
    build: 'vulnerable',
    level,
    filterApplied: level === 2 ? 'removes <script> tags' : 'none',
    reflectedContext: context,
    sink: context === 'text' ? 'element.textContent (safe)' : 'element.innerHTML (unsafe)',
    escapedReflection: `No results for "${escape(filtered)}"`,
    wouldExecute
  };
  if (wouldExecute) body.simulatedAlert = { fired: true, message: `payload ran in a simulated browser. clipboard: ${FLAGS.xss}` };
  return { ok: true, status: 200, body };
}

const LABS = Object.freeze({ sqli: sqliLab, jwt: jwtLab, xss: xssLab });

export function isInteractiveLab(id) { return Object.hasOwn(LABS, id); }

export function runInteractiveLab(id, params = {}) {
  if (!isInteractiveLab(id)) return { ok: false, status: 404, body: { error: 'Unknown lab' } };
  return LABS[id](params && typeof params === 'object' ? params : {});
}

export function verifyInteractiveFlag(id, flag) { return Object.hasOwn(FLAGS, id) && FLAGS[id] === flag; }

// exported for tests
export const _test = Object.freeze({ b64urlEncode, demoSignature, SECRETS, NOW });
