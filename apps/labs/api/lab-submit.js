import { error, methodNotAllowed, options, success } from './_lib/lab-response.js';
import { knownChallenge, verifyFlag } from './_lib/lab-scenarios.js';

export default function handler(req, res) {
  const methods = ['POST', 'OPTIONS'];
  if (options(req, res, methods)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, methods);
  const { challengeId, flag } = req.body || {};
  if (typeof challengeId !== 'string' || typeof flag !== 'string') return error(res, 400, 'INVALID_INPUT', 'Challenge ID and flag are required text values.');
  if (!knownChallenge(challengeId)) return error(res, 404, 'UNKNOWN_CHALLENGE', 'Challenge does not exist.');
  if (!verifyFlag(challengeId, flag)) return error(res, 400, 'INCORRECT_FLAG', 'Flag did not match this simulator evidence.');
  return success(res, { challengeId, solved: true });
}
