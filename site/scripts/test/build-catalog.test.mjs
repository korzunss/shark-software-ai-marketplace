import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCatalog, splitCatalog } from '../build-catalog.mjs';
import { ownersOf, parseCodeowners } from '../lib/codeowners.mjs';
import { renderMarkdown } from '../lib/markdown.mjs';

// Writes a throwaway marketplace: { 'relative/path': string | object }.
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-'));
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return root;
}

const md = (fm, body = '') => `---\n${fm}\n---\n${body}`;

function marketplace(plugins) {
  return { name: 'test-market', owner: { name: 'Owner' }, plugins };
}

function build(files, config = { hiddenPlugins: [] }) {
  const root = fixture({ ...files, 'catalog.config.json': config });
  return buildCatalog({ root, configFile: path.join(root, 'catalog.config.json') });
}

test('discovers every component type the way Claude Code loads them', () => {
  const { catalog } = build({
    '.claude-plugin/marketplace.json': marketplace([{ name: 'full', source: './plugins/full', category: 'dev' }]),
    'plugins/full/.claude-plugin/plugin.json': { name: 'full', version: '1.2.3', description: 'Full plugin', keywords: ['a', 'b'] },
    'plugins/full/skills/review/SKILL.md': md('name: review\ndescription: Reviews PRs\nallowed-tools: Read, Grep', '# Review\n\nBody'),
    'plugins/full/agents/checker.md': md('name: checker\ndescription: >-\n  Checks things\n  carefully\ntools: [Read, Bash]\nmodel: opus'),
    'plugins/full/commands/ship.md': md('description: Ships it\nargument-hint: <tag>'),
    'plugins/full/hooks/hooks.json': { hooks: { PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'fmt.sh' }] }] } },
    'plugins/full/.mcp.json': {
      mcpServers: {
        local: { command: 'node', args: ['server.js', '--token', 'SECRET-VALUE'], env: { DB_URL: 'postgres://user:pw@host' } },
        remote: { type: 'http', url: 'https://mcp.example.com/mcp?key=SECRET-VALUE', headers: { Authorization: 'Bearer ${API_TOKEN}' } },
      },
    },
  });

  const plugin = catalog.plugins[0];
  assert.equal(plugin.version, '1.2.3');
  assert.equal(plugin.installId, 'full@test-market');
  assert.deepEqual(plugin.risk, {
    executesCode: true,
    network: true,
    needsSecrets: false,
    reasons: ['hooks: PostToolUse', 'mcp: local (stdio)', 'mcp: remote (http)'],
  });

  const byId = Object.fromEntries(catalog.artifacts.map((a) => [a.id, a]));
  assert.deepEqual(Object.keys(byId).sort(), ['full:checker', 'full:hooks', 'full:local', 'full:remote', 'full:review', 'full:ship']);
  assert.equal(byId['full:review'].invocation, '/full:review');
  assert.deepEqual(byId['full:review'].tools, ['Read', 'Grep']);
  assert.equal(byId['full:checker'].description, 'Checks things carefully');
  assert.deepEqual(byId['full:checker'].tools, ['Read', 'Bash']);
  assert.equal(byId['full:checker'].details.model, 'opus');
  assert.equal(byId['full:ship'].details.argumentHint, '<tag>');
  assert.deepEqual(byId['full:hooks'].details.hooks, [{ event: 'PostToolUse', matcher: 'Edit', kind: 'command', command: 'fmt.sh' }]);
  assert.deepEqual(byId['full:local'].details, { transport: 'stdio', envVars: ['DB_URL'], command: 'node' });
  assert.deepEqual(byId['full:remote'].details, { transport: 'http', envVars: ['API_TOKEN'], url: 'https://mcp.example.com/mcp' });
  assert.deepEqual(byId['full:review'].keywords, ['a', 'b']);

  // MCP secrets never leave the build: only variable names.
  const json = JSON.stringify(catalog);
  assert.ok(!json.includes('SECRET-VALUE'));
  assert.ok(!json.includes('user:pw'));
});

test('plugin.json "agents" replaces the default agents/ folder', () => {
  const { catalog } = build({
    '.claude-plugin/marketplace.json': marketplace([{ name: 'p', source: './plugins/p' }]),
    'plugins/p/.claude-plugin/plugin.json': { name: 'p', agents: ['./custom/one.md'] },
    'plugins/p/agents/ignored.md': md('name: ignored\ndescription: x'),
    'plugins/p/custom/one.md': md('name: one\ndescription: y'),
  });
  assert.deepEqual(catalog.artifacts.map((a) => a.id), ['p:one']);
});

test('hiddenPlugins removes a plugin from the catalog entirely', () => {
  const files = {
    '.claude-plugin/marketplace.json': marketplace([
      { name: 'shown', source: './plugins/shown' },
      { name: 'secret', source: './plugins/secret' },
    ]),
    'plugins/shown/skills/s/SKILL.md': md('name: s\ndescription: shown skill'),
    'plugins/secret/skills/t/SKILL.md': md('name: t\ndescription: internal-only skill'),
  };
  const { catalog, hidden } = build(files, { hiddenPlugins: ['secret'] });
  assert.deepEqual(hidden, ['secret']);
  assert.deepEqual(catalog.plugins.map((p) => p.id), ['shown']);
  assert.ok(!JSON.stringify(catalog).includes('internal-only'));
});

test('hiddenPlugins with an unknown name fails the build', () => {
  assert.throws(
    () => build({ '.claude-plugin/marketplace.json': marketplace([]) }, { hiddenPlugins: ['typo'] }),
    /not in marketplace\.json: typo/,
  );
});

test('a broken component fails the build with its path', () => {
  assert.throws(
    () => build({
      '.claude-plugin/marketplace.json': marketplace([{ name: 'p', source: './plugins/p' }]),
      'plugins/p/agents/bad.md': '# no frontmatter',
    }),
    /plugins\/p\/agents\/bad\.md: missing YAML frontmatter/,
  );
});

test('external sources are listed with entry metadata only', () => {
  const { catalog } = build({
    '.claude-plugin/marketplace.json': marketplace([{ name: 'ext', source: { source: 'github', repo: 'o/r' }, description: 'From elsewhere' }]),
  });
  assert.equal(catalog.plugins[0].external, true);
  assert.equal(catalog.plugins[0].description, 'From elsewhere');
  assert.equal(catalog.artifacts.length, 0);
});

test('splitCatalog keeps HTML out of the index', () => {
  const { catalog } = build({
    '.claude-plugin/marketplace.json': marketplace([{ name: 'p', source: './plugins/p' }]),
    'plugins/p/README.md': '# Readme',
    'plugins/p/CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-02\n\n### Added\n\n- First release.\n',
    'plugins/p/skills/s/SKILL.md': md('name: s\ndescription: d', 'Body text'),
  });
  const { index, content } = splitCatalog(catalog);
  assert.ok(!JSON.stringify(index).includes('<h1>'));
  assert.deepEqual(index.plugins[0].changelog, [{ version: '1.0.0', date: '2026-01-02', summary: 'First release.' }]);
  assert.match(content.p.readmeHtml, /<h1>Readme<\/h1>/);
  assert.match(content.p.changelog['1.0.0'], /<li>First release\.<\/li>/);
  assert.match(content.p.artifacts['p:s'], /<p>Body text<\/p>/);
});

test('markdown: raw HTML is escaped, unsafe links dropped, relative links point to GitHub', () => {
  const html = renderMarkdown(
    '<script>alert(1)</script>\n\n[x](javascript:alert(1)) [doc](ref/a.md) [ext](https://e.com) ![img](pic.png)',
    { baseUrl: 'https://github.com/o/r/blob/main/plugins/p' },
  );
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.ok(!html.includes('javascript:'));
  assert.match(html, /href="https:\/\/github\.com\/o\/r\/blob\/main\/plugins\/p\/ref\/a\.md"/);
  assert.match(html, /href="https:\/\/e\.com"/);
  assert.ok(!html.includes('<img'));
});

test('CODEOWNERS: the last matching rule wins, deeper-path rules do not own the plugin', () => {
  const rules = parseCodeowners('*  @default\n/plugins/a/  @team-a\n**/hooks/**  @security\n');
  assert.deepEqual(ownersOf(rules, 'plugins/a'), ['@team-a']);
  assert.deepEqual(ownersOf(rules, 'plugins/b'), ['@default']);
});
