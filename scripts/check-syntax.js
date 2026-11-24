#!/usr/bin/env node
// Syntax-checks every .js file under apps/, scripts/ and tests/ with `node --check`,
// so new files are covered automatically and a deleted file cannot break the check.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.vercel', '.git']);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

const files = ['apps', 'scripts', 'tests'].flatMap((name) => walk(path.join(REPO, name)));
const failures = files.filter((file) => {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status === 0) return false;
  console.error(`\nSyntax error in ${path.relative(REPO, file)}\n${result.stderr.trim()}`);
  return true;
});

console.log(`Checked ${files.length} files: ${failures.length ? `${failures.length} failed` : 'all OK'}.`);
process.exit(failures.length ? 1 : 0);
