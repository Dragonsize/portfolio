import { error, methodNotAllowed, options, success } from './lab-response.js';
import { runScenario } from './lab-scenarios.js';

export function createLabHandler(challengeId) {
  return function handler(req, res) {
    const methods = ['GET', 'POST', 'OPTIONS'];
    if (options(req, res, methods)) return;
    if (!methods.includes(req.method)) return methodNotAllowed(res, methods);
    const input = req.method === 'POST' ? req.body?.input : req.query?.input;
    if (input !== undefined && typeof input !== 'string') return error(res, 400, 'INVALID_INPUT', 'Input must be text.');
    const result = runScenario(challengeId, input || '');
    return success(res, result);
  };
}
