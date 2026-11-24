// Request-driven simulations for csrf, auth, path, ssrf and secrets.
// Same rules as interactive-labs.js: nothing executes, no real files, no real network, no real
// accounts. Every answer is computed from fixtures, so a request always gets the same response.
// Each lab has a vulnerable build (default) and a patched build (fixed=1) for the fix phase.

export const EXTRA_FLAGS = Object.freeze({
  csrf: 'flag{origin_checks_stop_forged_requests}',
  auth: 'flag{default_credentials_are_a_backdoor}',
  path: 'flag{normalize_then_contain}',
  ssrf: 'flag{egress_allowlists_beat_blocklists}',
  secrets: 'flag{least_disclosure_wins}'
});

const isFixed = (params) => params.fixed === '1' || params.fixed === 1 || params.fixed === true;
const reply = (status, body) => ({ ok: status < 400, status, body });

/* ---------- CSRF: a bank that trusts the session alone ---------- */
const CSRF_TOKEN = 'lab-csrf-7f3a91';
const SAME_SITE = 'https://bank.lab';

function csrfLab(params) {
  const fixed = isFixed(params);
  const build = fixed ? 'patched' : 'vulnerable';
  const method = String(params.__method || 'GET').toUpperCase();
  if (params.to === undefined && params.amount === undefined) {
    return reply(200, { build, message: 'Signed in as "you". The session cookie is attached to every request automatically. The token below is for your own forms.', session: { user: 'you', balance: 1000 }, csrfToken: CSRF_TOKEN });
  }
  const to = String(params.to ?? '').slice(0, 40);
  const amount = Number(params.amount);
  if (!to || to === 'you' || !Number.isFinite(amount) || amount <= 0 || amount > 1000) {
    return reply(400, { build, error: 'Invalid transfer. Send "to" (not yourself) and an "amount" from 1 to 1000.' });
  }
  const origin = params.origin ? String(params.origin).slice(0, 80) : '';
  const crossSite = origin !== '' && origin !== SAME_SITE;
  if (fixed) {
    if (method !== 'POST') return reply(405, { build, error: 'State-changing requests must use POST.' });
    if (crossSite) return reply(403, { build, error: 'Origin is not allowed to submit this form.', origin });
    if (params.token !== CSRF_TOKEN) return reply(403, { build, error: 'Missing or invalid anti-forgery token.' });
  }
  const body = { build, transferred: true, from: 'you', to, amount, balanceAfter: 1000 - amount, method, origin: origin || '(none sent)', crossSite };
  if (!fixed && crossSite) body.auditLog = ['transfer accepted for session "you"', `ALERT cross-site request was accepted with no proof of intent. incident: ${EXTRA_FLAGS.csrf}`];
  return reply(200, body);
}

/* ---------- Auth: a login with default credentials and chatty errors ---------- */
const USERS = Object.freeze({ admin: 'admin123', alice: 'Wint3r!2024', bob: 'correct-horse-battery' });

function authLab(params) {
  const fixed = isFixed(params);
  const build = fixed ? 'patched' : 'vulnerable';
  const user = String(params.user ?? '').slice(0, 40);
  const password = String(params.password ?? '').slice(0, 80);
  const attempt = Number.parseInt(params.attempt, 10) || 0;
  if (!user && !password) return reply(200, { build, message: 'Send "user" and "password" to sign in to VaultLab.' });
  if (fixed) {
    if (attempt >= 5) return reply(429, { build, error: 'Too many failed attempts. This account is locked for 15 minutes.' });
    // The bootstrap admin password must be changed at setup, so the default no longer works.
    const valid = user === 'alice' && password === USERS.alice;
    if (!valid) return reply(401, { build, error: 'Invalid credentials.' });
    return reply(200, { build, authenticated: true, user, role: 'user' });
  }
  if (!Object.hasOwn(USERS, user)) return reply(401, { build, error: `No such user: ${user}` });
  if (USERS[user] !== password) return reply(401, { build, error: `Wrong password for ${user}`, lockout: 'none' });
  const body = { build, authenticated: true, user, role: user === 'admin' ? 'admin' : 'user', session: `sess-${user}-demo` };
  if (user === 'admin') body.adminPanel = { notice: 'Signed in with the factory default password.', note: `Break-glass recovery code: ${EXTRA_FLAGS.auth}` };
  return reply(200, body);
}

/* ---------- Path traversal: a document viewer ---------- */
const FILES = Object.freeze({
  'docs/guide.txt': 'DocsLab guide\n1. Pick a document from the list.\n2. Read it.\n',
  'docs/faq.txt': 'Q: Who can see these files?\nA: Everything under docs/ is public.\n',
  'docs/release-notes.txt': 'v2.4: faster search.\nv2.3: new viewer. Staff notes moved to private/ (not linked anywhere).\n',
  'private/staff-notes.txt': `Staff only.\nRecovery phrase: ${EXTRA_FLAGS.path}\n`,
  'config/app.env': 'DEMO_MODE=1\n'
});

function normalizePath(value) {
  const parts = [];
  for (const segment of value.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') parts.pop(); else parts.push(segment);
  }
  return parts.join('/');
}

function pathLab(params) {
  const fixed = isFixed(params);
  const build = fixed ? 'patched' : 'vulnerable';
  const level = String(params.level) === '2' ? 2 : 1;
  const requested = String(params.file ?? '').slice(0, 200);
  if (!requested) return reply(200, { build, root: 'docs/', files: ['guide.txt', 'faq.txt', 'release-notes.txt'], usage: 'Request one with ?file=guide.txt' });
  if (requested.includes('\0')) return reply(400, { build, error: 'Null bytes are not allowed in file names.' });
  // Level 2 adds a naive filter: it removes "../" once, so a nested form survives.
  const name = level === 2 && !fixed ? requested.replace(/\.\.\//g, '') : requested;
  const resolved = normalizePath(`docs/${name}`);
  if (fixed && !resolved.startsWith('docs/')) return reply(403, { build, error: 'Resolved path leaves the docs directory.', resolved });
  if (!Object.hasOwn(FILES, resolved)) return reply(404, { build, error: 'No such file.', resolved });
  return reply(200, { build, level, requested, resolved, content: FILES[resolved] });
}

/* ---------- SSRF: a link previewer inside a fake network ---------- */
const BLOCKLIST = /localhost|127\.0\.0\.1|169\.254\.169\.254|internal\.lab/i;
const isInternalHost = (host) => host === 'localhost' || host === 'internal.lab' || host === '[::1]' || /^127\./.test(host);

function ssrfRoute(host, pathname) {
  const base = { outboundRequestMade: false };
  if (host === 'catalog.lab') return reply(200, { ...base, upstream: 'catalog.lab', preview: { title: 'Public catalog', items: ['USB data blocker', 'Hardware security key', 'Faraday sleeve'] } });
  if (isInternalHost(host)) return reply(200, { ...base, upstream: 'internal-admin', preview: { title: 'Internal admin console', note: 'Cloud instance metadata is served on this network at http://169.254.169.254/latest/meta-data/' } });
  if (host === '169.254.169.254') {
    if (pathname === '/latest/meta-data/' || pathname === '/latest/meta-data') return reply(200, { ...base, upstream: 'metadata-service', preview: { listing: ['iam/'] } });
    if (pathname === '/latest/meta-data/iam/') return reply(200, { ...base, upstream: 'metadata-service', preview: { listing: ['security-credentials/lab-role'] } });
    if (pathname === '/latest/meta-data/iam/security-credentials/lab-role') {
      return reply(200, { ...base, upstream: 'metadata-service', preview: { Code: 'Success', AccessKeyId: 'AKIADEMOLABROLE000', SecretAccessKey: `demo/${EXTRA_FLAGS.ssrf}`, Expiration: 'never (lab fixture)' } });
    }
    return reply(404, { ...base, upstream: 'metadata-service', error: 'No such metadata path.' });
  }
  return reply(502, { ...base, error: 'Could not resolve that host inside the lab network.', host });
}

function ssrfLab(params) {
  const fixed = isFixed(params);
  const build = fixed ? 'patched' : 'vulnerable';
  const level = String(params.level) === '2' ? 2 : 1;
  const raw = String(params.url ?? '').trim().slice(0, 300);
  if (!raw) return reply(200, { build, message: 'Paste a link to preview it.', example: 'http://catalog.lab/products', outboundRequestMade: false });
  let url;
  try { url = new URL(raw); } catch { return reply(400, { build, error: 'That is not a valid URL.', outboundRequestMade: false }); }
  if (!['http:', 'https:'].includes(url.protocol)) return reply(400, { build, error: `The preview fetcher does not support ${url.protocol} links.`, outboundRequestMade: false });
  // Level 2 checks the text the user typed, before the URL parser rewrites the host.
  if (!fixed && level === 2 && BLOCKLIST.test(raw)) return reply(403, { build, level, error: 'Blocked by filter: internal address.', filter: 'string blocklist', outboundRequestMade: false });
  const host = url.hostname; // the parser has already normalised numeric forms like 2130706433 or 127.1
  if (fixed && host !== 'catalog.lab') return reply(403, { build, error: 'Destination is not on the egress allowlist.', allowed: ['catalog.lab'], host, outboundRequestMade: false });
  const result = ssrfRoute(host, url.pathname);
  return reply(result.status, { build, level, resolvedHost: host, ...result.body });
}

/* ---------- Secrets: a site that tells visitors too much ---------- */
const DB_URL = 'postgres://shipapp:Sh1p-demo-pw@db.internal/orders';
const LEAKY_HEADERS = Object.freeze({ Server: 'nginx/1.18.0 (Ubuntu)', 'X-Powered-By': 'Express 4.17.1' });

function secretsLab(params) {
  const fixed = isFixed(params);
  const build = fixed ? 'patched' : 'vulnerable';
  const headers = fixed ? {} : LEAKY_HEADERS;
  const rawPath = String(params.path ?? '').slice(0, 120);
  if (!rawPath) return reply(200, { build, message: 'Ask ShipLab for a page with ?path=/', try: ['/', '/status', '/robots.txt'] });
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const page = (status, body) => reply(200, { build, request: { path }, status, headers, body });

  if (path === '/') return page(200, 'ShipLab storefront. Orders ship worldwide.');
  if (path === '/status') return page(200, fixed ? { status: 'ok' } : { status: 'ok', version: '3.2.1-debug', node: 'v14.17.0', uptimeSeconds: 482113 });
  if (path === '/robots.txt') return page(200, fixed ? 'User-agent: *\nAllow: /' : 'User-agent: *\nDisallow: /debug\nDisallow: /backup/');
  if (path === '/debug') {
    if (fixed) return page(404, 'Not found.');
    return page(200, { env: 'staging', database: DB_URL, files: ['.env', 'backup/site.tar'], note: 'Remove before launch.' });
  }
  if (path === '/.env') {
    if (fixed) return page(404, 'Not found.');
    return page(200, `NODE_ENV=staging\nDB_URL=${DB_URL}\nSESSION_SECRET=demo-not-secret\nADMIN_RECOVERY=${EXTRA_FLAGS.secrets}\n`);
  }
  const order = /^\/orders\/([^/]*)$/.exec(path);
  if (order) {
    if (/^\d+$/.test(order[1])) return page(200, { id: Number(order[1]), status: 'shipped' });
    if (fixed) return page(400, { error: 'Invalid order id.' });
    return page(500, { error: `TypeError: cannot read properties of null (reading 'status') for id "${order[1]}"`, stack: ['at lookupOrder (/srv/shipapp/src/orders.js:42:11)', 'at handler (/srv/shipapp/src/routes.js:17:5)', `at connect (${DB_URL})`] });
  }
  return page(404, 'Not found.');
}

export const EXTRA_LABS = Object.freeze({ csrf: csrfLab, auth: authLab, path: pathLab, ssrf: ssrfLab, secrets: secretsLab });
