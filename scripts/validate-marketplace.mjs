#!/usr/bin/env node
// Structural linter for the marketplace. Complements `claude plugin validate`:
// it checks what the official validator skips or only reports as a warning.
// Dependency-free on purpose: runs on a bare Node.js (>= 18).
//
// Usage:
//   node scripts/validate-marketplace.mjs                 # all checks except version bumps
//   node scripts/validate-marketplace.mjs --base origin/main
//                                                         # also require version bumps for changed plugins
//
// Rules are documented in docs/PLUGIN-GUIDELINES.md and docs/temp/MARKETPLACE-RESEARCH.md (section 6).

import fs from 'node:fs';
import path from 'node:path';
import {
  MANIFEST, PLUGINS_DIR, ROOT, SEMVER, TEMPLATES_DIR, compareSemver, git, readmeVersion,
} from './lib/common.mjs';

// From code.claude.com/docs/en/plugins/marketplace-reference. Checked by Claude Code
// only on `marketplace add`, not by `claude plugin validate`.
const RESERVED_MARKETPLACE_NAMES = new Set([
  'claude-code-marketplace', 'claude-code-plugins', 'claude-plugins-official',
  'anthropic-marketplace', 'anthropic-plugins', 'agent-skills', 'anthropic-agent-skills',
  'life-sciences', 'knowledge-work-plugins', 'claude-for-legal', 'claude-for-financial-services',
  'financial-services-plugins', 'first-party-plugins', 'claude-tag-plugins',
  'claude-community', 'claude-plugins-community', 'healthcare',
  'anthropic-plugin-directory', 'claude-plugin-directory',
  'inline', 'builtin', 'skills-dir', 'synced', 'claude-plugin-test',
  'npm', 'pip', 'uv', 'cargo', 'github', 'gh',
]);
const RESERVED_PLUGIN_NAMES = new Set(['claude', 'anthropic', 'claude-code', 'claude-mods']);
const RESERVED_PLUGIN_PREFIXES = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-'];

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const LFS_POINTER = 'version https://git-lfs.github.com/spec';
// User-specific absolute paths break on every other machine. Checked in JSON configs only.
const ABSOLUTE_PATH = /(^|[\s"'=:(])(\/Users\/|\/home\/|~\/|[A-Za-z]:\\\\)/;
const UNQUOTED_PLUGIN_ROOT = /(^|[^"'])\$\{CLAUDE_PLUGIN_ROOT\}/;
const SECRET_PATTERNS = [
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI-style API key', /\bsk-[A-Za-z0-9]{32,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
// Plugins are project-agnostic: names of the project they were extracted from must not leak
// into them. NOTICE.md is exempt, because it carries the upstream attribution.
const PROJECT_SPECIFIC_TERMS = [/\bdev-?digest\b/i, /@devdigest\//i, /\.devdigest\//i];
const ATTRIBUTION_FILE = 'NOTICE.md';
// A plugin's own scripts are found through ${CLAUDE_SKILL_DIR} / ${CLAUDE_PLUGIN_ROOT}, never via the
// project's .claude/ folder, which does not contain them after install.
const HARNESS_PATH = /(^|[\s`"'(])\.claude\/(skills|agents)\//;
// Manifest keys whose values are paths inside the plugin.
const PATH_KEYS = ['skills', 'commands', 'agents', 'hooks', 'mcpServers', 'lspServers', 'outputStyles', 'workflows'];
const JSON_CONFIGS = ['hooks/hooks.json', '.mcp.json', '.lsp.json', 'monitors/monitors.json', 'settings.json'];

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push({ where, msg });
const warn = (where, msg) => warnings.push({ where, msg });

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/') || '.';
const exists = (p) => fs.existsSync(p);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(rel(file), `invalid JSON: ${e.message}`);
    return undefined;
  }
}

function walk(dir) {
  const out = [];
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) out.push({ full, symlink: true });
    else if (entry.isDirectory()) out.push(...walk(full));
    else out.push({ full, symlink: false });
  }
  return out;
}

function subdirs(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => path.join(dir, e.name));
}

function parseFrontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return fields;
}

// Reads a YAML block list (`key:\n  - a\n  - b`) or an inline one (`key: [a, b]`) from the frontmatter.
function frontmatterList(file, key) {
  const text = fs.readFileSync(file, 'utf8');
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!fm) return [];
  const lines = fm.split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i < 0) return [];
  const inline = lines[i].slice(key.length + 1).trim();
  if (inline) return inline.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  const out = [];
  for (const line of lines.slice(i + 1)) {
    const m = line.match(/^\s+-\s+(.+)$/);
    if (!m) break;
    out.push(m[1].trim().replace(/^["']|["']$/g, ''));
  }
  return out;
}

// ── Names ────────────────────────────────────────────────────────────────────

function checkMarketplaceName(where, name) {
  if (typeof name !== 'string' || !KEBAB.test(name)) {
    err(where, `marketplace name "${name}" must be kebab-case`);
    return;
  }
  if (RESERVED_MARKETPLACE_NAMES.has(name) || name.startsWith('claudeai-')) {
    err(where, `marketplace name "${name}" is reserved by Claude Code`);
  } else if (name.includes('anthropic') || /^claude[-.]/.test(name)) {
    err(where, `marketplace name "${name}" looks like an official Anthropic name and may be rejected on "marketplace add"`);
  }
}

function checkPluginName(where, name) {
  if (typeof name !== 'string' || !KEBAB.test(name)) {
    err(where, `plugin name "${name}" must be kebab-case`);
    return;
  }
  if (RESERVED_PLUGIN_NAMES.has(name) || RESERVED_PLUGIN_PREFIXES.some((p) => name.startsWith(p))) {
    err(where, `plugin name "${name}" is reserved (no claude-/anthropic-/anthropics-/cc-plugin- prefixes)`);
  }
}

function checkRelativePath(where, value, { allowDot = false } = {}) {
  if (allowDot && value === '.') return true;
  if (value.includes('\\')) err(where, `path "${value}" must use forward slashes`);
  if (!value.startsWith('./')) err(where, `path "${value}" must start with "./"`);
  if (value.split('/').includes('..')) err(where, `path "${value}" must not contain ".." (files outside the plugin are not copied to the cache)`);
  return value.startsWith('./') && !value.split('/').includes('..');
}

// ── Marketplace catalog ─────────────────────────────────────────────────────

function checkMarketplace() {
  const file = path.join(ROOT, MANIFEST);
  if (!exists(file)) {
    err(MANIFEST, 'file is missing');
    return null;
  }
  const m = readJson(file);
  if (!m) return null;

  checkMarketplaceName(MANIFEST, m.name);
  if (typeof m.description !== 'string' || !m.description.trim()) err(MANIFEST, '"description" is required');
  if (!m.owner || typeof m.owner.name !== 'string') err(MANIFEST, '"owner.name" is required');
  if (!Array.isArray(m.plugins)) {
    err(MANIFEST, '"plugins" must be an array');
    return { ...m, plugins: [] };
  }
  if (m.plugins.length === 0) err(MANIFEST, '"plugins" is empty: `claude plugin validate --strict` fails on an empty catalog');

  const names = m.plugins.map((p) => p?.name);
  const seen = new Set();
  for (const n of names) {
    if (seen.has(n)) err(MANIFEST, `duplicate plugin name "${n}"`);
    seen.add(n);
  }
  const sorted = [...names].sort((a, b) => String(a).localeCompare(String(b)));
  if (sorted.join('\n') !== names.join('\n')) err(MANIFEST, `plugins must be sorted by name: ${sorted.join(', ')}`);

  return m;
}

// Returns the absolute directory of a relative-path plugin, or null for external sources.
function checkEntry(entry, index) {
  const where = `${MANIFEST} plugins[${index}]${entry?.name ? ` (${entry.name})` : ''}`;
  if (!entry || typeof entry !== 'object') {
    err(where, 'entry must be an object');
    return null;
  }
  checkPluginName(where, entry.name);
  if ('version' in entry) err(where, '"version" belongs only in plugin.json; setting it in both places makes plugin.json win silently');
  if (typeof entry.description !== 'string' || entry.description.length < 10 || entry.description.length > 2000) {
    err(where, '"description" must be 10–2000 characters');
  }
  if (entry.hooks !== undefined && (typeof entry.hooks !== 'object' || Array.isArray(entry.hooks))) {
    err(where, '"hooks" in a marketplace entry must be an inline object (file paths load but never run); use hooks/hooks.json');
  }

  const src = entry.source;
  if (typeof src === 'string') {
    if (!checkRelativePath(where, src)) return null;
    const dir = path.join(ROOT, src);
    if (!exists(dir)) {
      err(where, `source directory "${src}" does not exist`);
      return null;
    }
    if (path.basename(dir) !== entry.name) err(where, `directory name "${path.basename(dir)}" must equal entry name "${entry.name}"`);
    return dir;
  }

  if (!src || typeof src !== 'object') {
    err(where, '"source" is required');
    return null;
  }
  // External sources: pin to an immutable revision and use https only.
  if (['github', 'url', 'git-subdir'].includes(src.source) && !SHA40.test(src.sha ?? '')) {
    err(where, `external "${src.source}" source must be pinned with a 40-character "sha"`);
  }
  if (typeof src.url === 'string' && !src.url.startsWith('https://')) {
    const isShorthand = src.source === 'git-subdir' && /^[\w.-]+\/[\w.-]+$/.test(src.url);
    if (!isShorthand) err(where, `source url "${src.url}" must use https://`);
  }
  if (src.source === 'archive' && !SHA256.test(src.sha256 ?? '')) err(where, '"archive" source must set "sha256"');
  if (src.source === 'npm' || src.source === 'command') {
    warn(where, `"${src.source}" sources need an explicit security review (see docs/SECURITY.md)`);
  }
  return null;
}

// ── Plugin directories ──────────────────────────────────────────────────────

function checkPluginDir(dir, { entryName, isTemplate = false } = {}) {
  const where = rel(dir);
  const manifestPath = path.join(dir, '.claude-plugin', 'plugin.json');
  if (!exists(manifestPath)) {
    err(where, 'missing .claude-plugin/plugin.json');
    return null;
  }
  const pj = readJson(manifestPath);
  if (!pj) return null;
  const mWhere = rel(manifestPath);

  checkPluginName(mWhere, pj.name);
  if (pj.name !== path.basename(dir)) err(mWhere, `"name" "${pj.name}" must equal directory name "${path.basename(dir)}"`);
  if (entryName && pj.name !== entryName) err(mWhere, `"name" "${pj.name}" must equal marketplace entry name "${entryName}"`);
  if (typeof pj.version !== 'string' || !SEMVER.test(pj.version)) err(mWhere, '"version" is required and must be SemVer (x.y.z)');
  if (typeof pj.description !== 'string' || !pj.description.trim()) err(mWhere, '"description" is required');
  // A homepage into this repo must point at the plugin's own folder: catches a copied template link.
  const homepagePath = typeof pj.homepage === 'string' ? pj.homepage.match(/\/tree\/[^/]+\/(.+?)\/?$/)?.[1] : undefined;
  if (homepagePath !== undefined && homepagePath !== where) {
    err(mWhere, `"homepage" points to "${homepagePath}", expected the plugin folder "${where}"`);
  }

  for (const f of fs.readdirSync(path.join(dir, '.claude-plugin'))) {
    if (f !== 'plugin.json') err(`${where}/.claude-plugin/${f}`, 'only plugin.json belongs in .claude-plugin/; put components at the plugin root');
  }
  if (exists(path.join(dir, 'CLAUDE.md'))) warn(`${where}/CLAUDE.md`, 'CLAUDE.md at the plugin root is not loaded; move the instructions into a skill');

  for (const required of ['README.md', 'CHANGELOG.md']) {
    if (!exists(path.join(dir, required))) err(where, `${required} is required`);
  }
  const changelog = path.join(dir, 'CHANGELOG.md');
  if (exists(changelog) && pj.version && !fs.readFileSync(changelog, 'utf8').includes(`## [${pj.version}]`)) {
    err(rel(changelog), `no "## [${pj.version}]" section for the current version`);
  }

  for (const key of PATH_KEYS) {
    for (const value of manifestPaths(key, pj[key])) {
      if (key === 'mcpServers' && value.startsWith('https://')) continue;
      if (checkRelativePath(`${mWhere} "${key}"`, value, { allowDot: key === 'skills' }) && !exists(path.join(dir, value))) {
        err(`${mWhere} "${key}"`, `path "${value}" does not exist`);
      }
    }
  }
  if (!isTemplate && exists(path.join(dir, 'bin'))) {
    warn(`${where}/bin`, 'prefer scripts/ over bin/: organization sync via claude.ai rejects a top-level bin/');
  }

  checkJsonConfigs(dir);
  checkComponents(dir);
  checkFiles(dir);
  return pj;
}

function manifestPaths(key, value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
  if (key === 'commands' && value && typeof value === 'object') {
    return Object.values(value).map((v) => v?.source).filter((s) => typeof s === 'string');
  }
  return []; // inline objects (hooks, mcpServers, ...) carry no paths
}

function checkJsonConfigs(dir) {
  for (const name of JSON_CONFIGS) {
    const file = path.join(dir, name);
    if (!exists(file)) continue;
    const data = readJson(file);
    if (data === undefined) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (ABSOLUTE_PATH.test(text)) err(rel(file), 'contains a user-specific absolute path; use ${CLAUDE_PLUGIN_ROOT}, ${CLAUDE_PLUGIN_DATA} or ${CLAUDE_PROJECT_DIR}');
    if (name === 'hooks/hooks.json') checkHookCommands(rel(file), data);
  }
}

function checkHookCommands(where, node) {
  if (Array.isArray(node)) {
    node.forEach((n) => checkHookCommands(where, n));
    return;
  }
  if (!node || typeof node !== 'object') return;
  // Exec form (`args` present) is not split by a shell, so quoting does not matter there.
  if (typeof node.command === 'string' && !Array.isArray(node.args) && UNQUOTED_PLUGIN_ROOT.test(node.command)) {
    err(where, `hook command "${node.command}" must quote \${CLAUDE_PLUGIN_ROOT} (paths with spaces split otherwise)`);
  }
  Object.values(node).forEach((v) => checkHookCommands(where, v));
}

function checkComponents(dir) {
  for (const skillDir of subdirs(path.join(dir, 'skills'))) {
    const file = path.join(skillDir, 'SKILL.md');
    if (!exists(file)) {
      err(rel(skillDir), 'skill directory has no SKILL.md');
      continue;
    }
    const fm = parseFrontmatter(file);
    if (!fm) {
      err(rel(file), 'missing YAML frontmatter');
      continue;
    }
    if (!fm.name) err(rel(file), 'frontmatter "name" is required');
    else if (fm.name !== path.basename(skillDir)) err(rel(file), `frontmatter "name" "${fm.name}" must equal directory name "${path.basename(skillDir)}"`);
    if (!fm.description) err(rel(file), 'frontmatter "description" is required (it decides when the skill triggers)');
  }

  for (const [sub, required] of [['agents', ['name', 'description']], ['commands', ['description']]]) {
    const base = path.join(dir, sub);
    if (!exists(base)) continue;
    for (const { full } of walk(base)) {
      if (!full.endsWith('.md')) continue;
      const fm = parseFrontmatter(full);
      if (!fm) {
        err(rel(full), 'missing YAML frontmatter');
        continue;
      }
      for (const field of required) if (!fm[field]) err(rel(full), `frontmatter "${field}" is required`);
    }
  }
}

function checkFiles(dir) {
  for (const { full, symlink } of walk(dir)) {
    const where = rel(full);
    if (symlink) {
      let target;
      try {
        target = fs.realpathSync(full);
      } catch {
        err(where, 'broken symlink');
        continue;
      }
      if (!target.startsWith(ROOT + path.sep)) err(where, 'symlink points outside the marketplace (it is skipped when copied to the cache)');
      continue;
    }

    const buf = fs.readFileSync(full);
    if (buf.subarray(0, LFS_POINTER.length).toString() === LFS_POINTER) {
      err(where, 'Git LFS pointer: LFS content is not fetched on install; commit the real file');
      continue;
    }
    if (buf.includes(0)) continue; // binary
    const text = buf.toString('utf8');

    for (const [label, re] of SECRET_PATTERNS) {
      if (re.test(text)) err(where, `looks like it contains a secret (${label}); use userConfig with "sensitive": true or \${ENV_VAR}`);
    }
    if (text.includes('\r\n')) err(where, 'CRLF line endings; use LF (see .gitattributes)');

    const parts = where.split('/');
    if (path.basename(full) !== ATTRIBUTION_FILE) {
      const term = PROJECT_SPECIFIC_TERMS.find((re) => re.test(text));
      if (term) err(where, `mentions the source project (${term}); plugins must be project-agnostic, keep attribution in ${ATTRIBUTION_FILE}`);
    }
    if ((parts.includes('agents') || parts.includes('skills')) && /\.md$/.test(full) && HARNESS_PATH.test(text)) {
      warn(where, 'hard-coded .claude/skills/ or .claude/agents/ path; reference plugin files through ${CLAUDE_SKILL_DIR} or ${CLAUDE_PLUGIN_ROOT}');
    }

    const isScript = parts.includes('scripts') || parts.includes('bin') || /\.(sh|bash)$/.test(full);
    if (isScript) {
      if ((fs.statSync(full).mode & 0o111) === 0) err(where, 'script is not executable (chmod +x, and `git update-index --chmod=+x`)');
      if (!text.startsWith('#!')) warn(where, 'script has no shebang line');
    }
  }
}

// ── Dependencies between plugins ────────────────────────────────────────────

// Returns the dependency names of one plugin.json, reporting malformed entries.
function dependencyNames(where, pj, marketplaceName) {
  const deps = pj.dependencies;
  if (deps === undefined) return [];
  if (!Array.isArray(deps)) {
    err(where, '"dependencies" must be an array');
    return [];
  }
  const names = [];
  for (const d of deps) {
    const raw = typeof d === 'string' ? d : d?.name;
    if (typeof raw !== 'string' || !raw) {
      err(where, `dependency ${JSON.stringify(d)} must be a "name" string or an object with "name"`);
      continue;
    }
    const [name, market] = raw.split('@');
    if (market && market !== marketplaceName) continue; // cross-marketplace: not ours to check
    if (typeof d === 'object' && d.version !== undefined && (typeof d.version !== 'string' || !d.version.trim())) {
      err(where, `dependency "${name}": "version" must be a non-empty range string such as "^1.0.0"`);
    }
    names.push(name);
  }
  return names;
}

// plugins: [{ name, dir, pj }] for every catalog plugin with a local source.
function checkDependencies(plugins, marketplaceName) {
  const byName = new Map(plugins.map((p) => [p.name, p]));
  const direct = new Map();
  for (const p of plugins) {
    const where = rel(path.join(p.dir, '.claude-plugin', 'plugin.json'));
    const names = dependencyNames(where, p.pj, marketplaceName);
    for (const n of names) {
      if (n === p.name) err(where, 'a plugin must not depend on itself');
      else if (!byName.has(n)) err(where, `dependency "${n}" is not a plugin in this marketplace`);
    }
    direct.set(p.name, names.filter((n) => n !== p.name && byName.has(n)));
  }

  // Transitive closure; a cycle shows up as a plugin reaching itself.
  const closure = new Map();
  const reach = (name, seen = new Set()) => {
    for (const n of direct.get(name) ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      reach(n, seen);
    }
    return seen;
  };
  for (const p of plugins) {
    const all = reach(p.name);
    if (all.has(p.name)) err(rel(path.join(p.dir, '.claude-plugin', 'plugin.json')), 'dependency cycle');
    closure.set(p.name, all);
  }

  // Namespaced skill references (`plugin:skill`) in agents and skills must point at a plugin that is
  // this one or one it depends on, and at a skill that exists there. Otherwise the reference resolves
  // only when the user happens to have the other plugin installed.
  const skillExists = (plugin, skill) => exists(path.join(byName.get(plugin).dir, 'skills', skill, 'SKILL.md'));
  const pluginNames = [...byName.keys()];
  const refPattern = new RegExp(`(?<![\\w/.-])(${pluginNames.map(escapeRegExp).join('|')}):([a-z0-9][a-z0-9-]*)`, 'g');

  for (const p of plugins) {
    const allowed = new Set([p.name, ...closure.get(p.name)]);
    const check = (where, plugin, comp, kind) => {
      if (!allowed.has(plugin)) {
        err(where, `references "${plugin}:${comp}" but "${plugin}" is not in this plugin's dependencies`);
      } else if (kind === 'skill' && !skillExists(plugin, comp)) {
        err(where, `preloads skill "${plugin}:${comp}", which does not exist`);
      }
    };

    for (const { full } of walk(path.join(p.dir, 'agents'))) {
      if (!full.endsWith('.md')) continue;
      for (const id of frontmatterList(full, 'skills')) {
        const [plugin, skill] = id.includes(':') ? id.split(':') : [p.name, id];
        if (!byName.has(plugin)) err(rel(full), `preloads skill "${id}" from unknown plugin "${plugin}"`);
        else check(rel(full), plugin, skill, 'skill');
      }
    }
    for (const sub of ['agents', 'skills']) {
      for (const { full } of walk(path.join(p.dir, sub))) {
        if (!full.endsWith('.md')) continue;
        for (const m of fs.readFileSync(full, 'utf8').matchAll(refPattern)) {
          if (!allowed.has(m[1])) check(rel(full), m[1], m[2], 'reference');
        }
      }
    }
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Version bumps ───────────────────────────────────────────────────────────

function checkVersionBumps(base, plugins) {
  let mergeBase;
  let changed;
  try {
    mergeBase = git('merge-base', base, 'HEAD');
    // Committed + uncommitted changes since the merge base, plus untracked files.
    changed = [
      ...git('diff', '--name-only', mergeBase).split('\n'),
      ...git('ls-files', '--others', '--exclude-standard').split('\n'),
    ].filter(Boolean);
  } catch (e) {
    // Fatal in CI; locally the base may simply not be fetched yet (e.g. a fresh clone without origin/main).
    const report = process.env.GITHUB_ACTIONS === 'true' ? err : warn;
    report('version-bump', `cannot diff against "${base}", version bumps not checked: ${e.stderr?.trim() || e.message}`);
    return;
  }

  for (const { name, version } of plugins) {
    const prefix = `${PLUGINS_DIR}/${name}/`;
    if (!changed.some((f) => f.startsWith(prefix))) continue;
    let baseVersion;
    try {
      baseVersion = JSON.parse(git('show', `${mergeBase}:${prefix}.claude-plugin/plugin.json`)).version;
    } catch {
      continue; // new plugin: nothing to compare with
    }
    if (!SEMVER.test(baseVersion ?? '') || !SEMVER.test(version ?? '')) continue;
    if (compareSemver(version, baseVersion) <= 0) {
      err(`${prefix}.claude-plugin/plugin.json`, `plugin changed but version was not bumped (${base}: ${baseVersion}, now: ${version}); users with a pinned version will not receive the change`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const baseIdx = args.indexOf('--base');
  const base = baseIdx >= 0 ? args[baseIdx + 1] : undefined;
  if (baseIdx >= 0 && !base) {
    console.error('Usage: node scripts/validate-marketplace.mjs [--base <git-ref>]');
    process.exit(2);
  }

  const marketplace = checkMarketplace();
  const checked = [];
  const catalogDirs = new Set();

  if (marketplace) {
    marketplace.plugins.forEach((entry, i) => {
      const dir = checkEntry(entry, i);
      if (!dir) return;
      catalogDirs.add(path.resolve(dir));
      const pj = checkPluginDir(dir, { entryName: entry.name });
      if (pj) checked.push({ name: pj.name, version: pj.version, dir, pj });
    });
    checkDependencies(checked.filter((p) => typeof p.name === 'string'), marketplace.name);

    for (const dir of subdirs(path.join(ROOT, PLUGINS_DIR))) {
      if (!catalogDirs.has(path.resolve(dir))) err(rel(dir), `plugin directory has no entry in ${MANIFEST}`);
    }

    for (const { name, version } of checked) {
      const listed = readmeVersion(name);
      if (listed === undefined) warn('README.md', `plugin "${name}" is missing from the catalog table`);
      else if (listed !== version) warn('README.md', `catalog lists ${name} ${listed}, plugin.json has ${version} (scripts/release.mjs bump keeps them in sync)`);
    }
  }

  const templates = subdirs(path.join(ROOT, TEMPLATES_DIR));
  for (const dir of templates) {
    checkPluginDir(dir, { isTemplate: true });
    if (marketplace?.plugins.some((p) => p?.name === path.basename(dir))) {
      err(rel(dir), 'template name must not be used by a catalog plugin');
    }
  }

  if (base) checkVersionBumps(base, checked);

  report(marketplace, checked.length, templates.length, base);
}

function report(marketplace, pluginCount, templateCount, base) {
  const ci = process.env.GITHUB_ACTIONS === 'true';
  console.log(`Marketplace "${marketplace?.name ?? '?'}": ${pluginCount} plugin(s), ${templateCount} template(s)${base ? `, version bumps vs ${base}` : ''}`);
  for (const { where, msg } of warnings) {
    console.log(`${ci ? '::warning::' : '⚠ '}${where}: ${msg}`);
  }
  for (const { where, msg } of errors) {
    console.log(`${ci ? '::error::' : '✘ '}${where}: ${msg}`);
  }
  if (errors.length) {
    console.log(`\n✘ ${errors.length} error(s), ${warnings.length} warning(s)`);
    process.exit(1);
  }
  console.log(`✔ Passed with ${warnings.length} warning(s)`);
}

main();
