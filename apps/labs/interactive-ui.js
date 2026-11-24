// UI for the request-driven labs (sqli, jwt, xss). Every value from the network or the user is
// written with textContent; nothing here ever assigns innerHTML or evaluates input.
import { INTERACTIVE, BURP_STEPS } from './shared/interactive-config.js';
import { base64UrlDecode, base64UrlEncode, buildRawRequest, formatRawResponse, parseRawRequest, withFixedBuild } from './shared/repeater.js';

const FLAG_PATTERN = /flag\{[^}\s]+\}/;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function field(labelText, control) {
  const wrap = el('label', 'field');
  wrap.append(el('span', 'field-label', labelText), control);
  return wrap;
}
function button(text, className = 'button', type = 'button') {
  const b = el('button', className, text);
  b.type = type;
  return b;
}
function section(title, ...children) {
  const s = el('section', 'ilab-section');
  if (title) s.append(el('h3', '', title));
  s.append(...children);
  return s;
}

export function renderInteractiveLab(challenge, { submitFlag, alreadySolved = false }) {
  const config = INTERACTIVE[challenge.id];
  const root = el('div', 'lab-panel ilab');
  let lastRaw = '';
  let exploitRaw = '';
  let busy = false;

  /* ---------- request engine shared by the app pane and the Repeater ---------- */
  const raw = el('textarea', 'raw-request');
  raw.rows = 9; raw.spellcheck = false; raw.setAttribute('aria-label', 'Raw HTTP request');
  const rawResponse = el('pre', 'output raw-response', 'Send a request to see the response here.');
  const sendButton = button('Send', 'button');

  async function perform(rawText) {
    const parsed = parseRawRequest(rawText, challenge.endpoint);
    if (parsed.error) { rawResponse.textContent = `Request not sent: ${parsed.error}`; return null; }
    return transmit(parsed, rawText);
  }
  async function transmit(parsed, rawText, { record = true } = {}) {
    if (busy) return null;
    busy = true; sendButton.disabled = true;
    try {
      const init = { method: parsed.method, headers: parsed.headers, credentials: 'omit' };
      if (parsed.body) init.body = parsed.body;
      const response = await fetch(parsed.url, init);
      const body = await response.text();
      const result = { status: response.status, statusText: response.statusText, contentType: response.headers.get('content-type') || '', body };
      let json = null;
      try { json = JSON.parse(body); } catch { /* not JSON */ }
      if (record) {
        lastRaw = rawText;
        if (FLAG_PATTERN.test(body)) exploitRaw = rawText;
        rawResponse.textContent = formatRawResponse(result)
          + (parsed.ignored.length ? `\n\n(ignored headers this panel cannot send: ${parsed.ignored.join(', ')})` : '');
      }
      return { result, json };
    } catch {
      rawResponse.textContent = 'Network error: could not reach the lab endpoint.';
      return null;
    } finally { busy = false; sendButton.disabled = false; }
  }
  const appRequest = async (requestParts) => {
    const text = buildRawRequest({ path: challenge.endpoint, ...requestParts });
    raw.value = text;
    return perform(text);
  };

  /* ---------- intro ---------- */
  root.append(el('p', 'story', config.story), el('p', 'goal', `Goal: ${config.goal}`));

  /* ---------- lab-specific app pane ---------- */
  const appOut = el('div', 'app-out');
  const app = el('div', 'app-pane');
  if (challenge.id === 'sqli') buildSqli(app, appOut, appRequest);
  if (challenge.id === 'xss') buildXss(app, appOut, appRequest);
  if (challenge.id === 'jwt') buildJwt(app, appOut, appRequest);
  if (challenge.id === 'csrf') buildCsrf(app, appOut, appRequest);
  if (challenge.id === 'auth') buildAuth(app, appOut, appRequest);
  if (challenge.id === 'path') buildPath(app, appOut, appRequest);
  if (challenge.id === 'ssrf') buildSsrf(app, appOut, appRequest);
  if (challenge.id === 'secrets') buildSecrets(app, appOut, appRequest);
  root.append(section('Target application', app, appOut));

  /* ---------- Repeater ---------- */
  sendButton.addEventListener('click', () => perform(raw.value));
  const resetButton = button('Reload last request', 'button quiet');
  resetButton.addEventListener('click', () => { if (lastRaw) raw.value = lastRaw; });
  const repeater = el('div', 'repeater');
  const reqCol = el('div', 'rr-col');
  reqCol.append(el('p', 'field-label', 'Request (editable)'), raw, el('div', 'form-row', ''));
  reqCol.lastChild.append(sendButton, resetButton);
  const resCol = el('div', 'rr-col');
  resCol.append(el('p', 'field-label', 'Response'), rawResponse);
  repeater.append(reqCol, resCol);
  root.append(section('Repeater', el('p', 'muted-note', 'Edit anything in the request and resend it. Only this lab\'s own endpoint is reachable.'), repeater));

  /* ---------- hints ---------- */
  const hintList = el('ol', 'hint-list');
  const hintButton = button(`Show a hint (0/${config.hints.length})`, 'button quiet');
  let shown = 0;
  hintButton.addEventListener('click', () => {
    hintList.append(el('li', '', config.hints[shown])); shown += 1;
    hintButton.textContent = `Show a hint (${shown}/${config.hints.length})`;
    if (shown >= config.hints.length) hintButton.disabled = true;
  });
  root.append(section('Stuck?', hintList, hintButton));

  /* ---------- Burp ---------- */
  const burp = el('details', 'burp');
  burp.append(el('summary', '', 'Using Burp Suite? (optional)'));
  const steps = el('ol');
  BURP_STEPS.forEach((step) => steps.append(el('li', '', step)));
  burp.append(steps);
  root.append(burp);

  /* ---------- flag + fix phase ---------- */
  const fixHost = el('div', 'fix-host');
  const flagInput = el('input', 'lab-input'); flagInput.placeholder = 'flag{...}'; flagInput.autocomplete = 'off'; flagInput.setAttribute('aria-label', 'Flag');
  const flagButton = button('Validate flag', 'button', 'submit');
  const flagMessage = el('p', 'flag-message');
  const flagForm = el('form', 'lab-form');
  const flagRow = el('div', 'form-row'); flagRow.append(flagInput, flagButton);
  flagForm.append(flagRow, flagMessage);
  flagForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    flagButton.disabled = true;
    try {
      const outcome = await submitFlag(flagInput.value.trim());
      flagMessage.textContent = outcome.message;
      if (outcome.ok) { revealFix(); flagForm.classList.add('done'); }
    } finally { flagButton.disabled = false; }
  });
  root.append(section('Found the flag?', flagForm), fixHost);

  function revealFix() {
    if (fixHost.childElementCount) return;
    fixHost.append(buildFixPhase(config, {
      replay: async () => {
        const source = exploitRaw || lastRaw;
        if (!source) return { message: 'Send your exploit request first, then replay it against the patched build.' };
        const parsed = parseRawRequest(source, challenge.endpoint);
        if (parsed.error) return { message: parsed.error };
        const outcome = await transmit(withFixedBuild(parsed), source, { record: false });
        if (!outcome) return { message: 'Network error. Try again.' };
        const stillLeaks = FLAG_PATTERN.test(outcome.result.body);
        return { message: stillLeaks ? 'Still leaking. The patched build should not return the flag.' : 'Blocked. The same request no longer works on the patched build.', body: formatRawResponse(outcome.result), blocked: !stillLeaks };
      }
    }));
    fixHost.append(section('Keep learning', linkList(config.links)));
  }
  if (alreadySolved) { flagMessage.textContent = 'Already completed on this browser.'; revealFix(); }

  return root;
}

function linkList(links) {
  const list = el('ul', 'link-list');
  links.forEach(([label, href]) => {
    const item = el('li');
    const a = el('a', '', label); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    item.append(a); list.append(item);
  });
  return list;
}

/* ---------- fix phase (shared) ---------- */
function buildFixPhase(config, { replay }) {
  const host = section('Now fix it', el('p', 'muted-note', 'Pick the patch that really closes the hole, then replay your exploit against the patched build.'));
  const group = el('div', 'patch-group');
  const verdict = el('p', 'flag-message');
  const replayBox = el('div', 'replay-box');
  config.patches.forEach((patch) => {
    const label = el('label', 'patch-option');
    const radio = el('input'); radio.type = 'radio'; radio.name = 'patch'; radio.value = patch.id;
    const body = el('div');
    body.append(el('strong', '', patch.label), el('pre', 'code', patch.code));
    label.append(radio, body);
    group.append(label);
  });
  const apply = button('Apply patch');
  apply.addEventListener('click', () => {
    const chosen = group.querySelector('input:checked');
    replayBox.replaceChildren();
    if (!chosen) { verdict.textContent = 'Choose a patch first.'; return; }
    const patch = config.patches.find((p) => p.id === chosen.value);
    verdict.textContent = `${patch.correct ? 'Correct. ' : 'Not quite. '}${patch.why}`;
    if (!patch.correct) return;
    const replayButton = button('Replay my exploit on the patched build', 'button');
    const replayOut = el('pre', 'output');
    replayButton.addEventListener('click', async () => {
      replayButton.disabled = true;
      try {
        const outcome = await replay();
        replayOut.textContent = `${outcome.message}${outcome.body ? `\n\n${outcome.body}` : ''}`;
        replayOut.classList.toggle('blocked', Boolean(outcome.blocked));
      } finally { replayButton.disabled = false; }
    });
    replayBox.append(replayButton, replayOut);
  });
  host.append(group, apply, verdict, replayBox);
  return host;
}

/* ---------- SQL injection app ---------- */
function buildSqli(app, out, request) {
  const form = el('form', 'app-form');
  const input = el('input', 'lab-input'); input.placeholder = 'Search products, e.g. key'; input.autocomplete = 'off'; input.setAttribute('aria-label', 'Search products');
  const go = button('Search', 'button', 'submit');
  const row = el('div', 'form-row'); row.append(input, go); form.append(row);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const outcome = await request({ query: `q=${encodeURIComponent(input.value)}` });
    if (outcome?.json) renderSqli(out, outcome.json, input.value);
  });
  app.append(form);
}
function renderSqli(out, data, userInput) {
  out.replaceChildren();
  const inspector = el('pre', 'query-inspector');
  inspector.append(el('span', 'qi-label', 'query â–¸ '));
  const query = String(data.query ?? '');
  const at = userInput ? query.indexOf(userInput) : -1;
  if (at >= 0) { inspector.append(document.createTextNode(query.slice(0, at)), el('mark', '', userInput), document.createTextNode(query.slice(at + userInput.length))); }
  else inspector.append(document.createTextNode(query));
  out.append(inspector);
  if (data.error) { out.append(el('p', 'app-error', data.error)); return; }
  if (!Array.isArray(data.rows) || !data.rows.length) { out.append(el('p', 'muted-note', 'No products found.')); return; }
  const table = el('table', 'data-table');
  const head = el('tr'); ['id', 'name', 'price'].forEach((h) => head.append(el('th', '', h))); table.append(head);
  data.rows.forEach((r) => { const tr = el('tr'); [r.id, r.name, r.price].forEach((v) => tr.append(el('td', '', String(v)))); table.append(tr); });
  out.append(table);
}

/* ---------- XSS app ---------- */
function buildXss(app, out, request) {
  const form = el('form', 'app-form');
  const input = el('input', 'lab-input'); input.placeholder = 'Search notes'; input.autocomplete = 'off'; input.setAttribute('aria-label', 'Search notes');
  const level = el('select', 'lab-input'); level.setAttribute('aria-label', 'Defence level');
  [['1', 'Level 1: no filter'], ['2', 'Level 2: strips <script>']].forEach(([value, label]) => { const o = el('option', '', label); o.value = value; level.append(o); });
  const go = button('Search', 'button', 'submit');
  const row = el('div', 'form-row'); row.append(input, level, go); form.append(row);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const outcome = await request({ query: `q=${encodeURIComponent(input.value)}&level=${level.value}` });
    if (outcome?.json) renderXss(out, outcome.json);
  });
  app.append(form);
}
function renderXss(out, data) {
  out.replaceChildren();
  const page = el('div', 'results-page');
  page.append(el('p', 'results-title', 'Results page (simulated browser)'), el('p', 'results-body', String(data.escapedReflection ?? '')));
  out.append(page);
  const facts = el('ul', 'facts');
  [['filter', data.filterApplied], ['lands in', data.reflectedContext], ['sink', data.sink], ['build', data.build]].forEach(([k, v]) => facts.append(el('li', '', `${k}: ${v}`)));
  out.append(facts);
  if (data.simulatedAlert?.fired) out.append(el('p', 'alert-box', `ALERT â–¸ ${data.simulatedAlert.message}`));
  else if (data.wouldExecute === false) out.append(el('p', 'muted-note', 'Nothing executed.'));
}

/* ---------- JWT app ---------- */
function buildJwt(app, out, request) {
  const getButton = button('1. Get a session token', 'button');
  const header = el('textarea', 'raw-request small'); header.rows = 3; header.spellcheck = false; header.setAttribute('aria-label', 'Token header JSON');
  const payload = el('textarea', 'raw-request small'); payload.rows = 4; payload.spellcheck = false; payload.setAttribute('aria-label', 'Token payload JSON');
  const signature = el('input', 'lab-input'); signature.placeholder = '(empty = unsigned)'; signature.autocomplete = 'off'; signature.setAttribute('aria-label', 'Token signature');
  const tokenView = el('pre', 'output token-view', 'No token yet.');
  const status = el('p', 'muted-note');
  const grid = el('div', 'token-grid');
  grid.append(field('Header', header), field('Payload', payload), field('Signature', signature));
  const encodeButton = button('2. Re-encode', 'button quiet');
  const sendButton = button('3. Send as Bearer token', 'button');
  const actions = el('div', 'form-row'); actions.append(encodeButton, sendButton);
  app.append(getButton, grid, actions, status, tokenView);

  let token = '';
  const load = (value) => {
    token = value; tokenView.textContent = value;
    const [h = '', p = '', s = ''] = value.split('.');
    try { header.value = JSON.stringify(JSON.parse(base64UrlDecode(h)), null, 2); payload.value = JSON.stringify(JSON.parse(base64UrlDecode(p)), null, 2); signature.value = s; status.textContent = 'Token decoded. Edit it, re-encode, then send.'; }
    catch { status.textContent = 'Could not decode that token.'; }
  };
  getButton.addEventListener('click', async () => {
    const outcome = await request({});
    if (outcome?.json?.issuedToken) load(outcome.json.issuedToken);
  });
  encodeButton.addEventListener('click', () => {
    try {
      token = `${base64UrlEncode(JSON.stringify(JSON.parse(header.value)))}.${base64UrlEncode(JSON.stringify(JSON.parse(payload.value)))}.${signature.value.trim()}`;
      tokenView.textContent = token; status.textContent = 'Re-encoded. The signature segment is whatever you typed.';
    } catch { status.textContent = 'Header and payload must be valid JSON.'; }
  });
  sendButton.addEventListener('click', async () => {
    if (!token) { status.textContent = 'Get a token first.'; return; }
    const outcome = await request({ headers: { Authorization: `Bearer ${token}` } });
    if (outcome?.json) renderJwt(out, outcome.json);
  });
}
function renderJwt(out, data) {
  out.replaceChildren();
  if (data.error) { out.append(el('p', 'app-error', data.error)); return; }
  const facts = el('ul', 'facts');
  [['verified', String(data.verified)], ['reason', data.reason], ['session user', data.session?.user], ['session role', data.session?.role], ['build', data.build]].forEach(([k, v]) => { if (v !== undefined) facts.append(el('li', '', `${k}: ${v}`)); });
  out.append(facts);
  if (data.adminPanel) out.append(el('p', 'alert-box', `${data.adminPanel.message} ${data.adminPanel.internalNote}`));
}

/* ---------- shared helpers for the form-based labs ---------- */
function formApp(app, { fields, submit }, onSubmit) {
  const form = el('form', 'app-form');
  const grid = el('div', 'fields');
  const inputs = {};
  fields.forEach((spec) => {
    let control;
    if (spec.options) {
      control = el('select', 'lab-input');
      spec.options.forEach(([value, label]) => { const option = el('option', '', label); option.value = value; control.append(option); });
    } else {
      control = el('input', 'lab-input');
      control.autocomplete = 'off';
      if (spec.placeholder) control.placeholder = spec.placeholder;
    }
    if (spec.value !== undefined) control.value = spec.value;
    control.name = spec.name;
    control.setAttribute('aria-label', spec.label);
    inputs[spec.name] = control;
    grid.append(field(spec.label, control));
  });
  form.append(grid, button(submit, 'button', 'submit'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await onSubmit(Object.fromEntries(Object.entries(inputs).map(([name, control]) => [name, control.value])), inputs);
  });
  app.append(form);
  return { inputs };
}

// Shows any lab response: the error, simple facts, and nested data as readable blocks.
function renderResult(out, data) {
  out.replaceChildren();
  if (!data || typeof data !== 'object') return;
  if (data.error) out.append(el('p', 'app-error', String(data.error)));
  const facts = el('ul', 'facts');
  const blocks = [];
  Object.entries(data).forEach(([key, value]) => {
    if (key === 'error') return;
    if ((value !== null && typeof value === 'object') || key === 'content') blocks.push([key, value]);
    else facts.append(el('li', '', `${key}: ${value}`));
  });
  if (facts.childElementCount) out.append(facts);
  blocks.forEach(([key, value]) => {
    const pre = el('pre', 'output result-block');
    pre.textContent = `${key}\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`;
    out.append(pre);
  });
}
const nonEmpty = (values) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''));
const formBody = (values) => new URLSearchParams(nonEmpty(values)).toString();

/* ---------- CSRF app ---------- */
function buildCsrf(app, out, request) {
  const load = button('1. Load my session', 'button quiet');
  const info = el('p', 'muted-note', 'Browsers do not let a web page set the Origin header, so this form sends it as a field. Burp can send a real Origin header.');
  app.append(load, info);
  const { inputs } = formApp(app, {
    submit: '2. Send transfer',
    fields: [
      { name: 'to', label: 'Pay to', value: 'friend' },
      { name: 'amount', label: 'Amount (1-1000)', value: '25' },
      { name: 'origin', label: 'Origin the request comes from', value: 'https://bank.lab' },
      { name: 'token', label: 'Anti-forgery token', placeholder: '(empty)' },
      { name: 'method', label: 'Method', options: [['POST', 'POST'], ['GET', 'GET']] }
    ]
  }, async (values) => {
    const { method, ...rest } = values;
    const outcome = await request(method === 'GET'
      ? { method: 'GET', query: formBody(rest) }
      : { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formBody(rest) });
    if (outcome?.json) renderResult(out, outcome.json);
  });
  load.addEventListener('click', async () => {
    const outcome = await request({ method: 'GET' });
    if (!outcome?.json) return;
    if (outcome.json.csrfToken) inputs.token.value = outcome.json.csrfToken;
    renderResult(out, outcome.json);
  });
}

/* ---------- Auth app ---------- */
function buildAuth(app, out, request) {
  let failures = 0;
  const counter = el('p', 'muted-note', 'Failed attempts so far: 0');
  formApp(app, {
    submit: 'Sign in',
    fields: [
      { name: 'user', label: 'Username', placeholder: 'alice' },
      { name: 'password', label: 'Password', placeholder: '••••••••' }
    ]
  }, async (values) => {
    const outcome = await request({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formBody({ ...values, attempt: String(failures) }) });
    if (!outcome?.json) return;
    if (!outcome.json.authenticated) { failures += 1; counter.textContent = `Failed attempts so far: ${failures}`; }
    renderResult(out, outcome.json);
  });
  app.append(counter);
}

/* ---------- Path traversal app ---------- */
function buildPath(app, out, request) {
  const list = button('List documents', 'button quiet');
  app.append(list);
  formApp(app, {
    submit: 'Open file',
    fields: [
      { name: 'file', label: 'File in docs/', value: 'guide.txt' },
      { name: 'level', label: 'Defence level', options: [['1', 'Level 1: no filter'], ['2', 'Level 2: removes "../" once']] }
    ]
  }, async (values) => {
    const outcome = await request({ method: 'GET', query: formBody(values) });
    if (outcome?.json) renderResult(out, outcome.json);
  });
  list.addEventListener('click', async () => {
    const outcome = await request({ method: 'GET' });
    if (outcome?.json) renderResult(out, outcome.json);
  });
}

/* ---------- SSRF app ---------- */
function buildSsrf(app, out, request) {
  formApp(app, {
    submit: 'Preview link',
    fields: [
      { name: 'url', label: 'Link to preview', value: 'http://catalog.lab/products' },
      { name: 'level', label: 'Defence level', options: [['1', 'Level 1: no filter'], ['2', 'Level 2: blocks localhost, 127.0.0.1 and more']] }
    ]
  }, async (values) => {
    const outcome = await request({ method: 'GET', query: formBody(values) });
    if (outcome?.json) renderResult(out, outcome.json);
  });
}

/* ---------- Secrets app ---------- */
function buildSecrets(app, out, request) {
  const quick = el('div', 'quick-links');
  const visit = async (path) => {
    const outcome = await request({ method: 'GET', query: formBody({ path }) });
    if (outcome?.json) renderResult(out, outcome.json);
  };
  ['/', '/status', '/robots.txt'].forEach((path) => {
    const link = button(path, 'button quiet');
    link.addEventListener('click', () => { inputs.path.value = path; visit(path); });
    quick.append(link);
  });
  app.append(quick);
  const { inputs } = formApp(app, { submit: 'Request page', fields: [{ name: 'path', label: 'Page to request', value: '/' }] }, async (values) => visit(values.path));
}
