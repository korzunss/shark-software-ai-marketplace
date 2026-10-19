#!/usr/bin/env node
// sdd-config.mjs - reads .sdd/config.json at the project root and fills every
// missing key with its default. Used by sdd.sh (--shell) and by the other .mjs
// helpers (loadConfig). Never writes anything.
// CLI: node sdd-config.mjs --root <dir> [--shell | --json]
//   --shell  prints key=value lines for the directory keys (sdd.sh reads them)
//   --json   prints the merged config as JSON
// Exit 0 when the file is missing (defaults) or valid, 2 on bad arguments or a bad file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULTS = Object.freeze({
  specsDir: 'specs',
  plansDir: 'docs/plans',
  ideasDir: 'docs/ideas',
  retrosDir: 'docs/retros',
  docsDir: 'docs',
  packages: ['.'],
  commands: { typecheck: null, lint: null, test: null, integration: null },
  testTiers: { unit: '*.test.*', integration: '*.it.test.*' },
  protectedPaths: [],
  excludeFromSearch: [],
  insights: { log: 'INSIGHTS.md', rules: 'insights/gotchas.md' },
});

export const DIR_KEYS = ['specsDir', 'plansDir', 'ideasDir', 'retrosDir', 'docsDir'];

// a repo-relative directory: plain segments only, no glob or shell characters
const SEGMENT_RE = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
export function normDir(v) {
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (s === '' || s.startsWith('/')) return null;
  const parts = s.split('/');
  if (parts.some((p) => !SEGMENT_RE.test(p) || p === '.' || p === '..')) return null;
  return parts.join('/');
}

// -> { config, error } ; error is a string when the file exists but is unusable
export function loadConfig(root) {
  const file = path.join(root, '.sdd', 'config.json');
  const config = JSON.parse(JSON.stringify(DEFAULTS));
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return { config, error: null, present: false };
  }
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { config, error: '.sdd/config.json is not valid JSON', present: true };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { config, error: '.sdd/config.json must hold a JSON object', present: true };
  }
  for (const k of DIR_KEYS) {
    if (obj[k] === undefined || obj[k] === null) continue;
    const d = normDir(obj[k]);
    if (d === null) return { config, error: `.sdd/config.json: ${k} must be a relative directory (letters, digits, . _ - and /)`, present: true };
    config[k] = d;
  }
  for (const k of ['packages', 'protectedPaths', 'excludeFromSearch']) {
    if (Array.isArray(obj[k])) config[k] = obj[k].filter((x) => typeof x === 'string');
  }
  for (const k of ['commands', 'testTiers', 'insights']) {
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      for (const [kk, vv] of Object.entries(obj[k])) {
        if (typeof vv === 'string' || vv === null) config[k][kk] = vv;
      }
    }
  }
  return { config, error: null, present: true };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const USAGE = 'usage: sdd-config.mjs --root <dir> [--shell | --json]';
  const args = process.argv.slice(2);
  let root = null;
  let mode = 'shell';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) root = args[++i];
    else if (args[i] === '--shell') mode = 'shell';
    else if (args[i] === '--json') mode = 'json';
    else {
      console.error(USAGE);
      process.exit(2);
    }
  }
  if (!root) {
    console.error(USAGE);
    process.exit(2);
  }
  const { config, error, present } = loadConfig(root);
  if (error) {
    console.error('sdd-config: ' + error);
    process.exit(2);
  }
  if (mode === 'json') {
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log(`source=${present ? '.sdd/config.json' : 'defaults'}`);
    for (const k of DIR_KEYS) console.log(`${k}=${config[k]}`);
  }
}
