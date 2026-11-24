#!/usr/bin/env node
// Zero-dependency local server for both apps: no Vercel CLI, account or login needed.
//   node scripts/local-server.js            portfolio on :3000 and labs on :3001
//   node scripts/local-server.js labs       labs only (:3001)
//   node scripts/local-server.js labs --port 4000 --host 127.0.0.1
//
// It serves static files, runs the real handlers in apps/<app>/api/*.js with a Vercel-style
// req/res (req.query, req.body, res.status().json()), and applies the headers from each
// vercel.json, so a CSP problem shows up locally the same way it would in production.
// It binds to loopback by default and is meant for local use, not as a production host.

import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APPS = Object.freeze({ portfolio: 3000, labs: 3001 });
export const MAX_BODY = 100 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff'
};
const BLOCKED_STATIC = new Set(['vercel.json', 'package.json', 'package-lock.json']);

export function parseArgs(argv) {
  const out = { app: 'both', port: undefined, host: '127.0.0.1' };
  const rest = [...argv];
  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--port') {
      const value = rest.shift();
      if (!/^\d+$/.test(value ?? '') || Number(value) < 1 || Number(value) > 65535) throw new Error(`Invalid --port: ${value ?? '(missing)'}`);
      out.port = Number(value);
    } else if (arg === '--host') {
      out.host = rest.shift() || '';
      if (!out.host) throw new Error('Missing value for --host');
    } else if (arg === 'both' || Object.hasOwn(APPS, arg)) out.app = arg;
    else throw new Error(`Unknown argument: ${arg}\nUsage: local-server.js [portfolio|labs|both] [--port N] [--host H]`);
  }
  if (out.port !== undefined && out.app === 'both') throw new Error('--port needs a single app: choose portfolio or labs.');
  return out;
}

function readConfig(root) {
  try { return JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')); } catch { return {}; }
}
function compileRules(config) {
  return (config.headers || []).flatMap((rule) => {
    try { return [{ re: new RegExp(`^${rule.source}$`), headers: rule.headers || [] }]; } catch { return []; }
  });
}

export async function readBody(stream, limit = MAX_BODY) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit) { const error = new Error('Request body too large'); error.code = 'TOO_LARGE'; throw error; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseBody(text, contentType = '') {
  if (!text) return undefined;
  if (/application\/json/i.test(contentType)) return JSON.parse(text);
  if (/application\/x-www-form-urlencoded/i.test(contentType)) return Object.fromEntries(new URLSearchParams(text));
  return text;
}

function queryObject(searchParams) {
  const out = {};
  for (const [key, value] of searchParams) {
    if (Object.hasOwn(out, key)) out[key] = [].concat(out[key], value); else out[key] = value;
  }
  return out;
}

function sendText(res, status, text, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...extra });
  res.end(text);
}
function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function createAppServer({ name, root = path.join(REPO, 'apps', name), quiet = true } = {}) {
  const config = readConfig(root);
  const rules = compileRules(config);
  const apiDir = path.join(root, 'api');
  const log = quiet ? () => {} : (line) => console.log(line);

  async function runApi(req, res, url, apiName) {
    if (!/^[A-Za-z0-9-]+$/.test(apiName)) return sendJson(res, 404, { error: 'Not found' });
    const file = path.join(apiDir, `${apiName}.js`);
    if (!existsSync(file)) return sendJson(res, 404, { error: 'Not found' });
    let handler;
    try { handler = (await import(pathToFileURL(file).href)).default; } catch (error) { console.error(`[${name}] failed to load /api/${apiName}: ${error.message}`); return sendJson(res, 500, { error: 'Function failed to load' }); }
    if (typeof handler !== 'function') return sendJson(res, 500, { error: 'Function has no default export' });
    try {
      req.query = queryObject(url.searchParams);
      if (!['GET', 'HEAD'].includes(req.method)) {
        try { req.body = parseBody(await readBody(req), req.headers['content-type']); }
        catch (error) {
          if (error.code === 'TOO_LARGE') return sendJson(res, 413, { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large.' } });
          return sendJson(res, 400, { error: { code: 'INVALID_BODY', message: 'Request body could not be parsed.' } });
        }
      }
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (body) => { if (!res.hasHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); return res; };
      res.send = (body) => { res.end(typeof body === 'object' && !Buffer.isBuffer(body) ? JSON.stringify(body) : body); return res; };
      await handler(req, res);
      if (!res.writableEnded) res.end();
    } catch (error) {
      console.error(`[${name}] /api/${apiName} threw: ${error.message}`);
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal error' }); else res.end();
    }
  }

  async function firstFile(candidates) {
    for (const candidate of candidates) {
      try { if ((await stat(candidate)).isFile()) return candidate; } catch { /* try next */ }
    }
    return null;
  }

  async function serveFile(req, res, file, status = 200) {
    const data = await readFile(file);
    res.writeHead(status, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  }

  async function runStatic(req, res, pathname) {
    if (!['GET', 'HEAD'].includes(req.method)) return sendText(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    const rel = pathname.replace(/^\/+/, '');
    const segments = rel.split(/[\\/]/).filter(Boolean);
    const blocked = segments.some((s) => s.startsWith('.')) || segments[0] === 'api' || segments[0] === 'node_modules' || BLOCKED_STATIC.has(rel);
    let file = null;
    if (!blocked) {
      const target = path.resolve(root, rel);
      if (target === root || target.startsWith(root + path.sep)) {
        const candidates = [path.join(target, 'index.html')];
        if (rel && !rel.endsWith('/')) candidates.unshift(target);
        if (config.cleanUrls && rel && !path.extname(rel)) candidates.push(`${target}.html`);
        file = await firstFile(candidates);
      }
    }
    if (file) return serveFile(req, res, file);
    const notFound = await firstFile([path.join(root, '404.html')]);
    if (notFound) return serveFile(req, res, notFound, 404);
    return sendText(res, 404, 'Not found');
  }

  return http.createServer(async (req, res) => {
    const started = Date.now();
    let url, pathname;
    try { url = new URL(req.url, 'http://localhost'); pathname = decodeURIComponent(url.pathname); } catch { return sendText(res, 400, 'Bad request'); }
    if (pathname.includes('\0')) return sendText(res, 400, 'Bad request');
    rules.forEach((rule) => { if (rule.re.test(url.pathname)) rule.headers.forEach(({ key, value }) => res.setHeader(key, value)); });
    res.on('finish', () => log(`${name.padEnd(9)} ${req.method.padEnd(4)} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`));
    try {
      if (pathname.startsWith('/api/')) await runApi(req, res, url, pathname.slice(5));
      else await runStatic(req, res, pathname);
    } catch (error) {
      console.error(`[${name}] ${error.message}`);
      if (!res.headersSent) sendText(res, 500, 'Internal error'); else res.end();
    }
  });
}

/* ---------------- CLI ---------------- */
async function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exit(2); }
  const names = options.app === 'both' ? Object.keys(APPS) : [options.app];
  if (!['127.0.0.1', 'localhost', '::1'].includes(options.host)) console.warn(`Warning: --host ${options.host} exposes these apps to your network. The labs are safe simulations, but this is a dev server.`);
  const servers = [];
  for (const name of names) {
    const port = options.port ?? APPS[name];
    const server = createAppServer({ name, quiet: false });
    await new Promise((resolve) => {
      server.once('error', (error) => {
        console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use (${name}). Try: node scripts/local-server.js ${name} --port ${port + 10}` : `Could not start ${name}: ${error.message}`);
        process.exit(1);
      });
      server.listen(port, options.host, () => { console.log(`${name.padEnd(9)} http://${options.host === '::1' ? '[::1]' : options.host}:${port}`); resolve(); });
    });
    servers.push(server);
  }
  console.log('Ctrl+C to stop.');
  process.on('SIGINT', () => { servers.forEach((s) => s.close()); process.exit(0); });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
