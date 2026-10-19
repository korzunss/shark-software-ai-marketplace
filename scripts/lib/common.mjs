// Shared helpers for the marketplace scripts. Dependency-free (Node.js >= 18).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MANIFEST = '.claude-plugin/marketplace.json';
export const PLUGINS_DIR = 'plugins';
export const TEMPLATES_DIR = 'templates';
export const MAIN_BRANCH = 'main';

export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
export const BUMPS = ['major', 'minor', 'patch'];

export class UsageError extends Error {}

export function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function gitOk(...args) {
  try {
    git(...args);
    return true;
  } catch {
    return false;
  }
}

export function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJsonFile(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function compareSemver(a, b) {
  const pa = a.match(SEMVER);
  const pb = b.match(SEMVER);
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d !== 0) return d;
  }
  if (pa[4] === pb[4]) return 0;
  if (!pa[4]) return 1; // 1.0.0 > 1.0.0-beta
  if (!pb[4]) return -1;
  return pa[4] < pb[4] ? -1 : 1;
}

// `bump` is "major" | "minor" | "patch" or an explicit SemVer that must be greater than `version`.
export function nextVersion(version, bump) {
  if (SEMVER.test(bump)) {
    if (compareSemver(bump, version) <= 0) throw new UsageError(`new version ${bump} must be greater than ${version}`);
    return bump;
  }
  const m = version.match(SEMVER);
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const prerelease = Boolean(m[4]);
  switch (bump) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    // 1.2.3-beta.1 → 1.2.3: releasing the pre-release counts as the patch bump.
    case 'patch': return prerelease ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`;
    default: throw new UsageError(`bump must be one of ${BUMPS.join(', ')} or an explicit x.y.z version, got "${bump}"`);
  }
}

export const tagName = (plugin, version) => `${plugin}--v${version}`;

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Plugins ─────────────────────────────────────────────────────────────────

export function loadMarketplace() {
  return readJsonFile(path.join(ROOT, MANIFEST));
}

export function pluginPaths(name) {
  const dir = path.join(ROOT, PLUGINS_DIR, name);
  return {
    dir,
    relDir: `${PLUGINS_DIR}/${name}`,
    manifest: path.join(dir, '.claude-plugin', 'plugin.json'),
    changelog: path.join(dir, 'CHANGELOG.md'),
  };
}

// Resolves a plugin that is listed in the catalog and has a plugin.json.
export function requirePlugin(name) {
  if (!name) throw new UsageError('plugin name is required');
  const entry = loadMarketplace().plugins.find((p) => p.name === name);
  if (!entry) throw new UsageError(`plugin "${name}" is not listed in ${MANIFEST}`);
  const paths = pluginPaths(name);
  if (!fs.existsSync(paths.manifest)) throw new UsageError(`${paths.relDir}/.claude-plugin/plugin.json not found`);
  return { entry, ...paths, manifestData: readJsonFile(paths.manifest) };
}

// ── CHANGELOG (Keep a Changelog) ────────────────────────────────────────────

const SECTION = /^## \[([^\]]+)\][^\n]*$/gm;

// Splits a changelog into { head, sections: [{ name, header, body }] }.
export function parseChangelog(text) {
  const matches = [...text.matchAll(SECTION)];
  if (matches.length === 0) return { head: text, sections: [] };
  const head = text.slice(0, matches[0].index);
  const sections = matches.map((m, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    return { name: m[1], header: m[0], body: text.slice(m.index + m[0].length, end) };
  });
  return { head, sections };
}

export function renderChangelog({ head, sections }) {
  const parts = sections.map((s) => `${s.header}\n\n${s.body.trim()}`.trimEnd());
  return `${head.trimEnd()}\n\n${parts.join('\n\n')}\n`;
}

// Body of a version section, without its header. Undefined if the section is missing.
export function changelogSection(text, name) {
  return parseChangelog(text).sections.find((s) => s.name === name)?.body.trim();
}

// ── README catalog ──────────────────────────────────────────────────────────

// Updates the "Version" cell of the catalog row whose first cell is `name`.
// Returns false when the row is not found.
export function updateReadmeVersion(name, version) {
  const file = path.join(ROOT, 'README.md');
  if (!fs.existsSync(file)) return false;
  const text = fs.readFileSync(file, 'utf8');
  const row = new RegExp(`^(\\|\\s*\`${escapeRegExp(name)}\`\\s*\\|\\s*)([^|]+?)(\\s*\\|)`, 'm');
  if (!row.test(text)) return false;
  fs.writeFileSync(file, text.replace(row, `$1${version}$3`));
  return true;
}

export function readmeVersion(name) {
  const file = path.join(ROOT, 'README.md');
  if (!fs.existsSync(file)) return undefined;
  const m = fs.readFileSync(file, 'utf8').match(new RegExp(`^\\|\\s*\`${escapeRegExp(name)}\`\\s*\\|\\s*([^|]+?)\\s*\\|`, 'm'));
  return m?.[1];
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── CLI ─────────────────────────────────────────────────────────────────────

// Minimal argv parser: positionals plus `--flag` / `--key value`.
export function parseArgs(argv, { flags = [], options = [] } = {}) {
  const positionals = [];
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (flags.includes(key)) values[key] = true;
    else if (options.includes(key)) {
      if (i + 1 >= argv.length) throw new UsageError(`--${key} needs a value`);
      values[key] = argv[++i];
    } else throw new UsageError(`unknown option --${key}`);
  }
  return { positionals, values };
}

export function runCli(main, usage) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`✘ ${e.message}\n\n${usage}`);
      process.exit(2);
    }
    console.error(`✘ ${e.stderr?.toString().trim() || e.message}`);
    process.exit(1);
  }
}
