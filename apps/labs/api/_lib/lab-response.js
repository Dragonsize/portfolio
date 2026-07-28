export function setCommonHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
}

export function options(req, res, methods) {
  if (req.method !== 'OPTIONS') return false;
  setCommonHeaders(res);
  res.setHeader('Allow', methods.join(', '));
  res.status(204).end();
  return true;
}

export function methodNotAllowed(res, methods) {
  setCommonHeaders(res);
  res.setHeader('Allow', methods.join(', '));
  return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: `Use ${methods.join(' or ')}.` } });
}

export function error(res, status, code, message) {
  setCommonHeaders(res);
  return res.status(status).json({ error: { code, message } });
}

export function success(res, body) {
  setCommonHeaders(res);
  return res.status(200).json(body);
}
