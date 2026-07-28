const FLAGS = Object.freeze({
  sqli: 'flag{lab_query_boundaries}', xss: 'flag{lab_safe_reflection}', csrf: 'flag{lab_request_integrity}', jwt: 'flag{lab_token_validation}', auth: 'flag{lab_auth_decisions}', path: 'flag{lab_virtual_paths}', ssrf: 'flag{lab_egress_controls}', secrets: 'flag{lab_least_disclosure}'
});

const definitions = {
  sqli: { hint: 'Compare query text with parameterized query structure.', learning: ['Untrusted text must not change query structure.'], remediation: ['Use prepared statements and typed parameters.'], match: (v) => /('|--|\bor\b)/i.test(v), artifact: (v, solved) => ({ submitted: v, unsafeTrace: `SELECT public_label FROM demo_records WHERE record_id = '${v}'`, parameterizedTrace: 'SELECT public_label FROM demo_records WHERE record_id = ?', simulation: solved ? 'Fixture shows predicate changed by input.' : 'Fixture remains a normal lookup.' }) },
  xss: { hint: 'Look for where a value would enter an HTML context.', learning: ['Encoding belongs at output context boundaries.'], remediation: ['Use textContent and context-aware encoders.'], match: (v) => /[<>]|on\w+=|javascript:/i.test(v), artifact: (v, solved) => ({ submitted: v, escapedPreview: v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), simulation: solved ? 'Unsafe-sink pattern recognized; no code ran.' : 'Value is rendered as text in this simulator.' }) },
  csrf: { hint: 'State changes need a method, origin verification, and anti-forgery signal.', learning: ['CSRF defenses validate intent, not only cookies.'], remediation: ['Require tokens and validate Origin for sensitive actions.'], match: (v) => /cross.?site|without token|missing token/i.test(v), artifact: (v, solved) => ({ scenario: v, method: 'POST', originVerified: false, tokenPresent: false, decision: solved ? 'Blocked: simulated request lacks proof of intent.' : 'Add a request-integrity observation.' }) },
  jwt: { hint: 'Decode is not verification. Algorithm choice must be allowlisted.', learning: ['Tokens are not trusted until signature and claims pass validation.'], remediation: ['Allowlist algorithms and verify issuer, audience, expiry.'], match: (v) => /alg.?=?.?none|none algorithm/i.test(v), artifact: (v, solved) => ({ metadata: v, decodedOnly: true, decision: solved ? 'Rejected: algorithm is not allowlisted.' : 'No verification decision made.' }) },
  auth: { hint: 'A secure authentication system has no shared bootstrap access path.', learning: ['Default access routes undermine identity assurance.'], remediation: ['Require unique setup and rate-limit failed attempts.'], match: (v) => /default|bootstrap|shared access/i.test(v), artifact: (v, solved) => ({ observation: v, account: 'demo-user', decision: solved ? 'Configuration rejected: unsafe default access pattern.' : 'No configuration issue identified.' }) },
  path: { hint: 'A virtual resource should be allowlisted, not interpreted as host path.', learning: ['Opaque IDs avoid path traversal classes.'], remediation: ['Use virtual IDs and containment checks.'], match: (v) => /\.\.|etc|passwd|virtual:\/\/private/i.test(v), artifact: (v, solved) => ({ requested: v, namespace: 'virtual://docs/', decision: solved ? 'Denied: request leaves approved virtual namespace.' : 'Only virtual://docs/ resources are eligible.' }) },
  ssrf: { hint: 'Outbound clients need destination allowlists and network egress controls.', learning: ['URL parsing and network policy must agree.'], remediation: ['Allowlist service IDs and deny private/link-local destinations.'], match: (v) => /lab:\/\/internal|metadata|localhost|127\.0\.0\.1/i.test(v), artifact: (v, solved) => ({ destination: v, outboundRequestMade: false, decision: solved ? 'Denied: destination is not public lab catalog.' : 'Use a synthetic lab:// destination.' }) },
  secrets: { hint: 'Debug output often reveals more than an application needs to share.', learning: ['Production responses should minimize disclosed metadata.'], remediation: ['Disable diagnostics and return generic errors.'], match: (v) => /debug|diagnostic|stack|version/i.test(v), artifact: (v, solved) => ({ view: v, exposedValue: 'DEMO_VALUE_NOT_A_SECRET', decision: solved ? 'Diagnostic exposure recognized.' : 'Inspect what a client response should omit.' }) }
};

export function runScenario(challengeId, input = '') {
  const definition = definitions[challengeId];
  if (!definition) return null;
  const value = String(input).slice(0, 240);
  const solved = definition.match(value);
  return { challengeId, status: solved ? 'evidence-found' : 'active', artifact: definition.artifact(value, solved), hint: definition.hint, learning: definition.learning, remediation: definition.remediation, flag: solved ? FLAGS[challengeId] : undefined };
}

export function verifyFlag(challengeId, flag) { return FLAGS[challengeId] === flag; }
export function knownChallenge(challengeId) { return Object.hasOwn(definitions, challengeId); }
