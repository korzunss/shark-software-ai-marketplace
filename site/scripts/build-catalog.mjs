#!/usr/bin/env node
// Builds site/src/generated/catalog.json from the marketplace in the repo root
// (SITE-SPEC §4–5). Runs before every `vite dev` / `vite build`, so the site
// always reflects the commit it was built from; no manual reindexing.
//
//   node scripts/build-catalog.mjs [--root <repo>] [--out <dir>]
//
// Writes, under <dir> (default site/src/generated/):
//   catalog.json          index for the UI and search, without rendered HTML
//   content/<plugin>.json README, changelog and artifact bodies as HTML,
//                         loaded only when that plugin's page opens
// plus site/public/catalog.json: the full catalog, served as a public API.
//
// Indexed: plugins listed in .claude-plugin/marketplace.json, minus the ones
// in site/catalog.config.json "hiddenPlugins". Hidden plugins are left out of
// catalog.json entirely (it is public), not just hidden in the UI.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseChangelog } from '../../scripts/lib/common.mjs';
import { parseCodeowners, ownersOf } from './lib/codeowners.mjs';
import { CatalogError, discoverPlugin, readJson } from './lib/discover.mjs';
import { plainText, renderMarkdown } from './lib/markdown.mjs';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCHEMA_VERSION = '1.0.0';
const DEFAULT_BRANCH = 'main';
const FALLBACK_REPO = 'korzunss/shark-software-ai-marketplace';

function gitIn(root) {
  return (...args) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
}

function repoSlug(git) {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const m = git('remote', 'get-url', 'origin').match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  return m ? m[1] : FALLBACK_REPO;
}

export function loadConfig(file, marketplace) {
  const config = fs.existsSync(file) ? readJson(file, path.basename(file)) : {};
  const hidden = config.hiddenPlugins ?? [];
  if (!Array.isArray(hidden) || hidden.some((h) => typeof h !== 'string')) {
    throw new CatalogError(`${path.basename(file)}: "hiddenPlugins" must be an array of plugin names`);
  }
  const listed = new Set(marketplace.plugins.map((p) => p.name));
  const unknown = hidden.filter((h) => !listed.has(h));
  if (unknown.length) {
    throw new CatalogError(`${path.basename(file)}: "hiddenPlugins" names plugins that are not in marketplace.json: ${unknown.join(', ')}`);
  }
  return { hiddenPlugins: hidden };
}

const personName = (a) => (typeof a === 'string' ? a : a?.name) || undefined;

function dependencyIds(deps, marketplaceName) {
  if (!Array.isArray(deps)) return [];
  return deps.map((d) => {
    const raw = typeof d === 'string' ? d : d?.name ?? '';
    const [dep, market] = raw.split('@');
    const m = market ?? d?.marketplace;
    return m && m !== marketplaceName ? `${dep}@${m}` : dep;
  }).filter(Boolean);
}

// Keep a Changelog sections, newest first, without [Unreleased].
function changelog(text, baseUrl) {
  return parseChangelog(text).sections
    .filter((s) => s.name.toLowerCase() !== 'unreleased')
    .map((s) => {
      const body = s.body.trim();
      return {
        version: s.name,
        date: s.header.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
        summary: plainText(body.replace(/^###.*$/gm, ''), 200),
        html: renderMarkdown(body, { baseUrl }),
      };
    });
}

export function buildCatalog({ root, configFile = path.join(SITE, 'catalog.config.json'), now = new Date() }) {
  const git = gitIn(root);
  const marketplace = readJson(path.join(root, '.claude-plugin/marketplace.json'), '.claude-plugin/marketplace.json');
  const config = loadConfig(configFile, marketplace);
  const repo = repoSlug(git);
  const repoUrl = `https://github.com/${repo}`;
  const codeownersFile = path.join(root, '.github/CODEOWNERS');
  const rules = fs.existsSync(codeownersFile) ? parseCodeowners(fs.readFileSync(codeownersFile, 'utf8')) : [];
  const pluginRoot = marketplace.metadata?.pluginRoot ?? '';

  const plugins = [];
  const artifacts = [];
  const hidden = [];

  for (const entry of marketplace.plugins) {
    if (config.hiddenPlugins.includes(entry.name)) {
      hidden.push(entry.name);
      continue;
    }
    const base = {
      id: entry.name,
      installId: `${entry.name}@${marketplace.name}`,
      displayName: entry.displayName ?? entry.name,
      description: entry.description ?? '',
      version: entry.version ?? null,
      author: personName(entry.author ?? marketplace.owner),
      keywords: entry.keywords ?? [],
      category: entry.category ?? null,
      tags: entry.tags ?? [],
      dependencies: [],
      external: false,
      path: null,
      createdAt: null,
      updatedAt: null,
      owners: [],
      readmeHtml: '',
      changelog: [],
      risk: { executesCode: false, network: false, needsSecrets: false, reasons: [] },
      components: [],
    };

    // Only relative sources live in this repo; others are listed with entry metadata only.
    const source = typeof entry.source === 'string' ? entry.source : null;
    if (!source || /^[a-z]+:/i.test(source)) {
      plugins.push({ ...base, external: true });
      continue;
    }
    const relDir = path.posix.normalize(path.posix.join(source.startsWith('.') ? '' : pluginRoot, source)).replace(/^\.\//, '').replace(/\/$/, '');
    const dir = path.join(root, relDir);
    if (!fs.existsSync(dir)) throw new CatalogError(`marketplace.json: plugin "${entry.name}" source "${source}" does not exist`);

    const pjFile = path.join(dir, '.claude-plugin/plugin.json');
    const pj = fs.existsSync(pjFile) ? readJson(pjFile, `${relDir}/.claude-plugin/plugin.json`) : {};
    const blobUrl = `${repoUrl}/blob/${DEFAULT_BRANCH}/${relDir}`;
    const { artifacts: found, risk } = discoverPlugin({ name: entry.name, dir, relDir, pj, entry, blobUrl });

    // Display metadata: the marketplace entry wins over plugin.json; version comes from plugin.json.
    const readme = path.join(dir, 'README.md');
    const changes = path.join(dir, 'CHANGELOG.md');
    const plugin = {
      ...base,
      displayName: entry.displayName ?? pj.displayName ?? entry.name,
      description: entry.description ?? pj.description ?? '',
      version: pj.version ?? entry.version ?? null,
      author: personName(entry.author ?? pj.author ?? marketplace.owner),
      keywords: entry.keywords ?? pj.keywords ?? [],
      license: entry.license ?? pj.license ?? null,
      dependencies: dependencyIds(pj.dependencies ?? entry.dependencies, marketplace.name),
      path: relDir,
      createdAt: git('log', '--reverse', '--format=%cs', '--', relDir).split('\n')[0] || null,
      updatedAt: git('log', '-1', '--format=%cs', '--', relDir) || null,
      owners: ownersOf(rules, relDir),
      readmeHtml: fs.existsSync(readme) ? renderMarkdown(fs.readFileSync(readme, 'utf8'), { baseUrl: blobUrl }) : '',
      changelog: fs.existsSync(changes) ? changelog(fs.readFileSync(changes, 'utf8'), blobUrl) : [],
      risk,
      components: found.map((a) => a.id),
    };
    plugins.push(plugin);
    artifacts.push(...found.map((a) => ({ ...a, keywords: plugin.keywords })));
  }

  const ids = new Set();
  for (const a of artifacts) {
    if (ids.has(a.id)) throw new CatalogError(`duplicate artifact id "${a.id}" (${a.path})`);
    ids.add(a.id);
  }

  return {
    catalog: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: now.toISOString(),
      commit: process.env.GITHUB_SHA || git('rev-parse', 'HEAD') || null,
      marketplace: {
        name: marketplace.name,
        description: marketplace.description ?? '',
        owner: marketplace.owner ?? null,
        repo,
        defaultBranch: DEFAULT_BRANCH,
      },
      plugins,
      artifacts,
    },
    hidden,
  };
}

// Moves rendered HTML out of the index so the bundle stays small as content grows.
export function splitCatalog(catalog) {
  const content = {};
  for (const p of catalog.plugins) {
    content[p.id] = {
      readmeHtml: p.readmeHtml,
      changelog: Object.fromEntries(p.changelog.map((c) => [c.version, c.html])),
      artifacts: {},
    };
  }
  for (const a of catalog.artifacts) content[a.plugin].artifacts[a.id] = a.bodyHtml;
  const index = {
    ...catalog,
    plugins: catalog.plugins.map(({ readmeHtml, ...p }) => ({
      ...p,
      changelog: p.changelog.map(({ html, ...c }) => c),
    })),
    artifacts: catalog.artifacts.map(({ bodyHtml, ...a }) => a),
  };
  return { index, content };
}

const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data)}\n`);
};

function main(argv) {
  const opt = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? path.resolve(argv[i + 1]) : fallback;
  };
  const root = opt('root', path.resolve(SITE, '..'));
  const out = opt('out', path.join(SITE, 'src/generated'));
  const { catalog, hidden } = buildCatalog({ root });
  const { index, content } = splitCatalog(catalog);

  fs.rmSync(out, { recursive: true, force: true });
  writeJson(path.join(out, 'catalog.json'), index);
  for (const [id, data] of Object.entries(content)) writeJson(path.join(out, 'content', `${id}.json`), data);
  writeJson(path.join(SITE, 'public/catalog.json'), catalog);

  const byType = catalog.artifacts.reduce((acc, a) => ({ ...acc, [a.type]: (acc[a.type] ?? 0) + 1 }), {});
  console.log(`✔ catalog: ${catalog.plugins.length} plugin(s), ${catalog.artifacts.length} artifact(s) ${JSON.stringify(byType)}`
    + (hidden.length ? `; hidden: ${hidden.join(', ')}` : '')
    + ` → ${path.relative(process.cwd(), out) || '.'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`✘ ${e.message}`);
    process.exit(1);
  }
}
