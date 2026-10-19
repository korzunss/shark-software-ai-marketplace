// Finds a plugin's components the way Claude Code loads them (SITE-SPEC §5.1),
// so the site shows what an install actually gets:
//   skills    skills/ PLUS the paths in plugin.json "skills"
//   commands  plugin.json "commands" REPLACES commands/ when set
//   agents    plugin.json "agents" REPLACES agents/ when set
//   hooks     hooks/hooks.json + plugin.json "hooks" + the marketplace entry's "hooks"
//   mcp       .mcp.json + plugin.json "mcpServers" + the entry's "mcpServers"
//   lsp       .lsp.json + plugin.json "lspServers" + the entry's "lspServers"
// Anything that cannot be parsed throws with the file path: the build fails
// instead of silently dropping content.
//
// Output is language-neutral: hooks, MCP and LSP servers carry no description
// of their own, and the UI words one from `details` (src/i18n/en.json).
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { headings, plainText, renderMarkdown } from './markdown.mjs';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export class CatalogError extends Error {}

export function readJson(file, rel) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new CatalogError(`${rel}: invalid JSON: ${e.message}`);
  }
}

function frontmatter(text, rel) {
  const m = text.match(FRONTMATTER);
  if (!m) throw new CatalogError(`${rel}: missing YAML frontmatter`);
  try {
    const data = parseYaml(m[1]);
    if (!data || typeof data !== 'object') throw new Error('not a mapping');
    return data;
  } catch (e) {
    throw new CatalogError(`${rel}: invalid frontmatter: ${e.message}`);
  }
}

const toList = (v) => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String);
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
};

function walkMd(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMd(full));
    else if (e.name.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

function hasDirNamed(dir, names, relTo, found = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (names.includes(e.name)) found.push(path.relative(relTo, full).split(path.sep).join('/'));
    else hasDirNamed(full, names, relTo, found);
  }
  return found;
}

// Paths from a plugin.json component field: a string, an array of strings, or
// (commands only) a { name: { source } } map. Inline objects carry no paths.
function manifestPaths(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
  if (value && typeof value === 'object') {
    return Object.values(value).map((v) => v?.source).filter((s) => typeof s === 'string');
  }
  return [];
}

export function discoverPlugin({ name, dir, relDir, pj, entry, blobUrl }) {
  const rel = (abs) => path.relative(dir, abs).split(path.sep).join('/');
  const repoRel = (abs) => `${relDir}/${rel(abs)}`;
  const inside = (p, field) => {
    const abs = path.resolve(dir, p);
    if (abs !== dir && !abs.startsWith(dir + path.sep)) {
      throw new CatalogError(`${relDir}/.claude-plugin/plugin.json: "${field}" path "${p}" points outside the plugin`);
    }
    return abs;
  };
  const artifacts = [];

  const fromMarkdown = (type, file, artifactName, invocation) => {
    const text = fs.readFileSync(file, 'utf8');
    const fm = frontmatter(text, repoRel(file));
    const description = fm.description != null ? String(fm.description) : '';
    const fileBlob = `${blobUrl}/${path.dirname(rel(file))}`.replace(/\/\.$/, '');
    const details = {};
    if (type === 'agent' && fm.model) details.model = String(fm.model);
    if (type === 'command' && fm['argument-hint']) details.argumentHint = String(fm['argument-hint']);
    artifacts.push({
      id: `${name}:${artifactName}`,
      type,
      name: artifactName,
      plugin: name,
      description,
      path: repoRel(file),
      invocation,
      tools: toList(type === 'agent' ? fm.tools : fm['allowed-tools']),
      bodyHtml: renderMarkdown(text, { baseUrl: fileBlob }),
      bodyText: plainText(text),
      headings: headings(text),
      details,
    });
  };

  // ── skills ──
  const skillRoots = [path.join(dir, 'skills'), ...manifestPaths(pj.skills).map((p) => inside(p, 'skills'))];
  const seenSkills = new Set();
  for (const root of skillRoots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.existsSync(path.join(root, 'SKILL.md'))
      ? [root]
      : fs.readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, e.name, 'SKILL.md')))
        .map((e) => path.join(root, e.name))
        .sort();
    for (const d of dirs) {
      if (seenSkills.has(d)) continue;
      seenSkills.add(d);
      const skillName = path.basename(d);
      fromMarkdown('skill', path.join(d, 'SKILL.md'), skillName, `/${name}:${skillName}`);
    }
  }

  // ── commands, agents ──
  for (const [type, field, folder] of [['command', 'commands', 'commands'], ['agent', 'agents', 'agents']]) {
    const roots = pj[field] !== undefined
      ? manifestPaths(pj[field]).map((p) => inside(p, field))
      : [path.join(dir, folder)];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const files = fs.statSync(root).isDirectory() ? walkMd(root) : [root];
      for (const file of files) {
        const base = path.basename(file, '.md');
        if (type === 'agent') {
          const fm = frontmatter(fs.readFileSync(file, 'utf8'), repoRel(file));
          const agentName = fm.name ? String(fm.name) : base;
          fromMarkdown('agent', file, agentName, `${name}:${agentName}`);
        } else {
          fromMarkdown('command', file, base, `/${name}:${base}`);
        }
      }
    }
  }

  // ── JSON-configured components: hooks, MCP, LSP ──
  // Each source is a file path (relative to the plugin) or an inline object.
  const configSources = (defaultFile, pjValue, entryValue, field) => {
    const out = [];
    const addFile = (abs) => {
      if (fs.existsSync(abs)) out.push({ data: readJson(abs, repoRel(abs)), where: repoRel(abs) });
    };
    addFile(path.join(dir, defaultFile));
    for (const v of [pjValue, entryValue].flatMap((x) => (Array.isArray(x) ? x : [x]))) {
      if (typeof v === 'string') addFile(inside(v, field));
      else if (v && typeof v === 'object') out.push({ data: v, where: `${relDir} (${field})` });
    }
    return out;
  };

  const hookRows = [];
  for (const { data } of configSources('hooks/hooks.json', pj.hooks, entry.hooks, 'hooks')) {
    const events = data.hooks ?? data;
    for (const [event, groups] of Object.entries(events || {})) {
      if (!Array.isArray(groups)) continue;
      for (const g of groups) {
        for (const h of g?.hooks ?? []) {
          hookRows.push({
            event,
            matcher: g.matcher ?? '',
            kind: h.type ?? 'command',
            command: h.command ?? h.prompt ?? '',
          });
        }
      }
    }
  }
  if (hookRows.length) {
    artifacts.push({
      id: `${name}:hooks`, type: 'hook', name: 'hooks', plugin: name,
      description: '',
      path: fs.existsSync(path.join(dir, 'hooks/hooks.json')) ? `${relDir}/hooks/hooks.json` : `${relDir}/.claude-plugin/plugin.json`,
      invocation: '', tools: [], bodyHtml: '', bodyText: hookRows.map((r) => `${r.event} ${r.matcher}`).join(' '),
      headings: [], details: { hooks: hookRows },
    });
  }

  const mcpServers = [];
  for (const { data, where } of configSources('.mcp.json', pj.mcpServers, entry.mcpServers, 'mcpServers')) {
    for (const [serverName, s] of Object.entries(data.mcpServers ?? data)) {
      if (!s || typeof s !== 'object') continue;
      const transport = s.type ?? (s.url ? 'http' : 'stdio');
      // Only variable NAMES leave the build: values, headers and args may hold secrets.
      const refs = JSON.stringify(s).match(/\$\{([A-Z0-9_]+)(?::-[^}]*)?\}/g) ?? [];
      const envVars = [...new Set([...Object.keys(s.env ?? {}), ...refs.map((r) => r.replace(/^\$\{|(?::-[^}]*)?\}$/g, ''))])]
        .filter((v) => !v.startsWith('CLAUDE_'))
        .sort();
      const details = { transport, envVars };
      if (transport === 'stdio' && typeof s.command === 'string') details.command = s.command;
      if (typeof s.url === 'string') details.url = s.url.split('?')[0];
      mcpServers.push({ serverName, details, where });
    }
  }
  for (const { serverName, details, where } of mcpServers) {
    artifacts.push({
      id: `${name}:${serverName}`, type: 'mcp', name: serverName, plugin: name,
      description: '',
      path: where, invocation: '', tools: [], bodyHtml: '', bodyText: serverName, headings: [], details,
    });
  }

  const lspServers = [];
  for (const { data, where } of configSources('.lsp.json', pj.lspServers, entry.lspServers, 'lspServers')) {
    for (const [serverName, s] of Object.entries(data.lspServers ?? data)) {
      if (!s || typeof s !== 'object') continue;
      const languages = [...new Set(Object.values(s.extensionToLanguage ?? {}))];
      lspServers.push(serverName);
      artifacts.push({
        id: `${name}:${serverName}`, type: 'lsp', name: serverName, plugin: name,
        description: '',
        path: where, invocation: '', tools: [], bodyHtml: '', bodyText: `${serverName} ${languages.join(' ')}`, headings: [],
        details: { languages, command: typeof s.command === 'string' ? s.command : '' },
      });
    }
  }

  // ── risk (SITE-SPEC §5.2) ──
  const reasons = [];
  const hookEvents = [...new Set(hookRows.map((r) => r.event))];
  if (hookEvents.length) reasons.push(`hooks: ${hookEvents.join(', ')}`);
  for (const s of mcpServers.filter((m) => m.details.transport === 'stdio')) reasons.push(`mcp: ${s.serverName} (stdio)`);
  for (const s of lspServers) reasons.push(`lsp: ${s}`);
  for (const d of hasDirNamed(dir, ['bin', 'scripts'], dir)) reasons.push(`${d}/`);
  const remote = mcpServers.filter((m) => m.details.transport !== 'stdio');
  const sensitive = Object.entries(pj.userConfig ?? {}).filter(([, v]) => v?.sensitive).map(([k]) => k);
  const risk = {
    executesCode: reasons.length > 0,
    network: remote.length > 0,
    needsSecrets: sensitive.length > 0,
    reasons: [
      ...reasons,
      ...remote.map((m) => `mcp: ${m.serverName} (${m.details.transport})`),
      ...sensitive.map((k) => `userConfig: ${k} (sensitive)`),
    ],
  };

  return { artifacts, risk };
}
