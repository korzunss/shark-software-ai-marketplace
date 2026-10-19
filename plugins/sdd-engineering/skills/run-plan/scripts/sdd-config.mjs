#!/usr/bin/env node
// sdd-config.mjs - reads .sdd/config.json at the project root and fills every
// missing key with its default. Used by sdd.sh (--shell) and by the other .mjs
// helpers (loadConfig). Writes only in --propose and --accept mode.
// CLI: node sdd-config.mjs --root <dir> [--shell | --json | --propose | --accept]
//   --shell    prints key=value lines for the directory keys (sdd.sh reads them)
//   --json     prints the merged config as JSON
//   --propose  builds a config from what the project defines and writes it to
//              .sdd/config.proposed.json (never .sdd/config.json), then prints a summary
//   --accept   validates .sdd/config.proposed.json and renames it to .sdd/config.json
// Exit 0 when the file is missing (defaults) or valid, 2 on bad arguments or a bad file;
// --propose and --accept exit 2 when .sdd/config.json already exists.
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
export function loadConfig(root, name = 'config.json') {
  const rel = `.sdd/${name}`;
  const file = path.join(root, '.sdd', name);
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
    return { config, error: `${rel} is not valid JSON`, present: true };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { config, error: `${rel} must hold a JSON object`, present: true };
  }
  for (const k of DIR_KEYS) {
    if (obj[k] === undefined || obj[k] === null) continue;
    const d = normDir(obj[k]);
    if (d === null) return { config, error: `${rel}: ${k} must be a relative directory (letters, digits, . _ - and /)`, present: true };
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

// ---- proposal ------------------------------------------------------------

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

// script names per command, in order of preference
const SCRIPT_NAMES = {
  typecheck: ['typecheck', 'type-check', 'types', 'tsc'],
  lint: ['lint'],
  test: ['test'],
  integration: ['test:integration', 'test:it', 'integration', 'it'],
};

function packageManager(root) {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) return 'bun';
  return 'npm';
}

function scriptCommand(pm, name) {
  if (name === 'test') return `${pm} test`;
  return pm === 'yarn' ? `yarn ${name}` : `${pm} run ${name}`;
}

function makeTargets(root) {
  let text;
  try {
    text = fs.readFileSync(path.join(root, 'Makefile'), 'utf8');
  } catch {
    return new Set();
  }
  const targets = new Set();
  for (const line of text.split('\n')) {
    const m = /^([A-Za-z0-9_.-]+)\s*:(?!=)/.exec(line);
    if (m) targets.add(m[1]);
  }
  return targets;
}

// workspace globs -> package directories; only literal paths and a trailing "/*" are expanded
function workspacePackages(root, pkg) {
  let globs = [];
  if (Array.isArray(pkg?.workspaces)) globs = pkg.workspaces;
  else if (Array.isArray(pkg?.workspaces?.packages)) globs = pkg.workspaces.packages;
  else {
    let text = '';
    try {
      text = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
    } catch {
      /* no pnpm workspace */
    }
    for (const m of text.matchAll(/^\s*-\s*['"]?([^'"#\s]+)['"]?/gm)) globs.push(m[1]);
  }
  const dirs = [];
  for (const g of globs.filter((x) => typeof x === 'string' && !x.startsWith('!'))) {
    const base = g.replace(/\/\*\*?$/, '');
    if (g !== base) {
      const parent = normDir(base);
      if (parent === null || !isDir(path.join(root, parent))) continue;
      for (const e of fs.readdirSync(path.join(root, parent)).sort()) {
        if (fs.existsSync(path.join(root, parent, e, 'package.json'))) dirs.push(`${parent}/${e}`);
      }
    } else {
      const d = normDir(g);
      if (d !== null && isDir(path.join(root, d))) dirs.push(d);
    }
  }
  return dirs.length ? dirs : ['.'];
}

// a config built only from what the project defines; commands it lacks stay null
export function proposeConfig(root) {
  const config = JSON.parse(JSON.stringify(DEFAULTS));
  const pkg = readJson(path.join(root, 'package.json'));
  const scripts = pkg && typeof pkg.scripts === 'object' && pkg.scripts ? pkg.scripts : {};
  const pm = packageManager(root);
  const targets = makeTargets(root);
  for (const [cmd, names] of Object.entries(SCRIPT_NAMES)) {
    const script = names.find((n) => typeof scripts[n] === 'string' && scripts[n].trim() !== '');
    if (script) config.commands[cmd] = scriptCommand(pm, script);
    else {
      const target = names.find((n) => targets.has(n));
      if (target) config.commands[cmd] = `make ${target}`;
    }
  }
  // an existing folder wins over the default name
  config.specsDir = ['specs', 'docs/specs', 'spec'].find((d) => isDir(path.join(root, d))) ?? DEFAULTS.specsDir;
  config.plansDir = ['docs/plans', 'plans'].find((d) => isDir(path.join(root, d))) ?? DEFAULTS.plansDir;
  config.packages = workspacePackages(root, pkg);
  return config;
}

export function summary(config, file) {
  const cmd = (v) => v ?? 'not configured';
  return [
    `sdd: config proposal written to ${file} (.sdd/config.json does not exist yet)`,
    `  specsDir:    ${config.specsDir}`,
    `  plansDir:    ${config.plansDir}`,
    `  packages:    ${config.packages.join(', ')}`,
    `  typecheck:   ${cmd(config.commands.typecheck)}`,
    `  lint:        ${cmd(config.commands.lint)}`,
    `  test:        ${cmd(config.commands.test)}`,
    `  integration: ${cmd(config.commands.integration)}`,
    'To accept it: answer yes (run-plan runs `sdd.sh config-accept`), or rename it yourself:',
    '  mv .sdd/config.proposed.json .sdd/config.json',
    'Edit the file first to change anything. Nothing else runs until .sdd/config.json exists.',
  ].join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const USAGE = 'usage: sdd-config.mjs --root <dir> [--shell | --json | --propose | --accept]';
  const args = process.argv.slice(2);
  let root = null;
  let mode = 'shell';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) root = args[++i];
    else if (['--shell', '--json', '--propose', '--accept'].includes(args[i])) mode = args[i].slice(2);
    else {
      console.error(USAGE);
      process.exit(2);
    }
  }
  if (!root) {
    console.error(USAGE);
    process.exit(2);
  }
  const target = path.join(root, '.sdd', 'config.json');
  const proposed = path.join(root, '.sdd', 'config.proposed.json');
  if (mode === 'propose' || mode === 'accept') {
    if (fs.existsSync(target)) {
      console.error('sdd-config: .sdd/config.json already exists; it is used as is');
      process.exit(2);
    }
    if (mode === 'propose') {
      const config = proposeConfig(root);
      fs.mkdirSync(path.dirname(proposed), { recursive: true });
      fs.writeFileSync(proposed, JSON.stringify(config, null, 2) + '\n');
      console.log(summary(config, '.sdd/config.proposed.json'));
    } else {
      if (!fs.existsSync(proposed)) {
        console.error('sdd-config: no .sdd/config.proposed.json to accept (run config-propose first)');
        process.exit(2);
      }
      const { error } = loadConfig(root, 'config.proposed.json');
      if (error) {
        console.error('sdd-config: ' + error);
        process.exit(2);
      }
      fs.renameSync(proposed, target);
      console.log('sdd: .sdd/config.proposed.json accepted as .sdd/config.json');
    }
    process.exit(0);
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
