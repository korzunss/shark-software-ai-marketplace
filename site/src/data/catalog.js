// Adapts src/generated/catalog.json (written by scripts/build-catalog.mjs) to
// the flat entry list the UI and search work with. Rendered HTML is not in the
// index; usePluginContent() loads it per plugin on demand.
import { useEffect, useState } from 'react';
import index from '../generated/catalog.json';
import { REPO_URL } from '../config.js';
import { t } from '../i18n/index.js';

const contentModules = import.meta.glob('../generated/content/*.json', { import: 'default' });

export const pluginIds = index.plugins.map((p) => p.id);

// Hooks, MCP and LSP servers have no frontmatter description; word one from details.
function describe(a) {
  if (a.description) return a.description;
  const d = a.details;
  switch (a.type) {
    case 'hook': return t('artifact.describe.hooks', { events: [...new Set(d.hooks.map((h) => h.event))].join(', ') });
    case 'mcp': return d.transport === 'stdio'
      ? t('artifact.describe.mcpLocal', { command: d.command ?? '' })
      : t('artifact.describe.mcpRemote', { transport: d.transport, url: d.url ?? '' });
    case 'lsp': return d.languages.length
      ? t('artifact.describe.lsp', { languages: d.languages.join(', ') })
      : t('artifact.describe.lspNoLanguages');
    default: return '';
  }
}

export function buildCatalog(source = index) {
  const entries = [];
  const plugins = {};
  const branch = source.marketplace.defaultBranch;
  for (const p of source.plugins) {
    const plugin = {
      id: 'plugin:' + p.id, kind: 'plugin', name: p.id, displayName: p.displayName,
      description: p.description, plugin: p.id, keywords: p.keywords, author: p.author ?? '',
      version: p.version ? 'v' + p.version : '', rawVersion: p.version, updated: p.updatedAt,
      category: p.category, owners: p.owners, risk: p.risk, external: p.external,
      installText: `/plugin install ${p.installId}`,
      githubUrl: p.path ? `${REPO_URL}/tree/${branch}/${p.path}` : REPO_URL,
      bodyText: p.keywords.join(' '), changelog: p.changelog, deps: p.dependencies, invocation: '',
    };
    plugins[p.id] = plugin;
    entries.push(plugin);
  }
  for (const a of source.artifacts) {
    const parent = plugins[a.plugin];
    entries.push({
      id: `${a.type}:${a.plugin}/${a.name}`, catalogId: a.id, kind: a.type, name: a.name, displayName: a.name,
      description: describe(a), plugin: a.plugin, keywords: a.keywords, author: parent.author,
      version: parent.version, rawVersion: parent.rawVersion, updated: parent.updated,
      installText: parent.installText, githubUrl: `${REPO_URL}/blob/${branch}/${a.path}`,
      bodyText: [a.headings.join(' '), a.bodyText].join(' '), invocation: a.invocation,
      tools: a.tools, details: a.details,
    });
  }
  return { entries, plugins };
}

// Every changelog entry of every plugin, newest first.
export function releases(plugins) {
  const list = [];
  for (const p of Object.values(plugins)) {
    for (const c of p.changelog || []) {
      list.push({ plugin: p.name, displayName: p.displayName, version: c.version, date: c.date, summary: c.summary });
    }
  }
  return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function keywordCounts(entries) {
  const counts = {};
  for (const e of entries) for (const k of e.keywords) counts[k] = (counts[k] || 0) + 1;
  return counts;
}

// { readmeHtml, changelog: { version: html }, artifacts: { id: html } } of one
// plugin; null while loading or when the plugin has no content file.
export function usePluginContent(pluginName) {
  const [state, setState] = useState({ name: null, content: null });
  useEffect(() => {
    const load = contentModules[`../generated/content/${pluginName}.json`];
    if (!load) return undefined;
    let live = true;
    load().then((content) => { if (live) setState({ name: pluginName, content }); });
    return () => { live = false; };
  }, [pluginName]);
  return state.name === pluginName ? state.content : null;
}
