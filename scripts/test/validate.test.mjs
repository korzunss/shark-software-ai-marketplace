// Tests for the cross-plugin checks in scripts/validate-marketplace.mjs:
// dependencies, namespaced skill references and project-agnostic content.
// Each test runs the linter against a throwaway marketplace with two small plugins.
// Run: node --test scripts/test/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../lib/common.mjs';

function makeMarketplace(t, { baseDeps, reviewerSkills = ['base:style'], body = '' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  fs.cpSync(path.join(ROOT, 'scripts'), path.join(dir, 'scripts'), { recursive: true });

  write('.claude-plugin/marketplace.json', JSON.stringify({
    name: 'test-plugins',
    description: 'Test marketplace',
    owner: { name: 'Test' },
    plugins: [
      { name: 'base', source: './plugins/base', description: 'Base skills for tests' },
      { name: 'reviewer', source: './plugins/reviewer', description: 'Reviewer agent for tests' },
    ],
  }));
  write('README.md', '| `base` | 1.0.0 | x |\n| `reviewer` | 1.0.0 | x |\n');

  const plugin = (name, extra) => {
    write(`plugins/${name}/.claude-plugin/plugin.json`, JSON.stringify({ name, version: '1.0.0', description: name, ...extra }));
    write(`plugins/${name}/README.md`, `# ${name}\n`);
    write(`plugins/${name}/CHANGELOG.md`, '## [1.0.0] - 2026-10-19\n');
  };
  plugin('base');
  write('plugins/base/skills/style/SKILL.md', '---\nname: style\ndescription: Style rules\n---\n');
  plugin('reviewer', baseDeps === undefined ? { dependencies: [{ name: 'base', version: '^1.0.0' }] } : { dependencies: baseDeps });
  write('plugins/reviewer/agents/reviewer.md',
    `---\nname: reviewer\ndescription: Reviews code\nskills:\n${reviewerSkills.map((s) => `  - ${s}`).join('\n')}\n---\n${body}\n`);

  const r = spawnSync('node', [path.join(dir, 'scripts', 'validate-marketplace.mjs')], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' },
  });
  return { dir, write, out: r.stdout + r.stderr, status: r.status };
}

test('a declared dependency with an existing namespaced skill passes', (t) => {
  const r = makeMarketplace(t);
  assert.equal(r.status, 0, r.out);
});

test('preloading a skill from a plugin that is not a dependency fails', (t) => {
  const r = makeMarketplace(t, { baseDeps: [] });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /"base" is not in this plugin's dependencies/);
});

test('preloading a skill that does not exist fails', (t) => {
  const r = makeMarketplace(t, { reviewerSkills: ['base:missing'] });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /"base:missing", which does not exist/);
});

test('a dependency outside the marketplace fails', (t) => {
  const r = makeMarketplace(t, { baseDeps: [{ name: 'base', version: '^1.0.0' }, 'ghost'] });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /dependency "ghost" is not a plugin in this marketplace/);
});

test('a namespaced reference in agent text needs the dependency too', (t) => {
  const r = makeMarketplace(t, { baseDeps: [], reviewerSkills: [], body: 'Read `base:style` first.' });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /references "base:style"/);
});

test('mentioning the source project fails, except in NOTICE.md', (t) => {
  const r = makeMarketplace(t, { body: 'Ported from DevDigest.' });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /mentions the source project/);

  const ok = makeMarketplace(t);
  ok.write('plugins/reviewer/NOTICE.md', 'Portions adapted from dev-digest (MIT).\n');
  const rerun = spawnSync('node', [path.join(ok.dir, 'scripts', 'validate-marketplace.mjs')], { cwd: ok.dir, encoding: 'utf8' });
  assert.equal(rerun.status, 0, rerun.stdout + rerun.stderr);
});

test('a change under evals/ needs no version bump; any other change does', (t) => {
  const r = makeMarketplace(t);
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd: r.dir, encoding: 'utf8' });
  const lint = () => spawnSync('node', [path.join(r.dir, 'scripts', 'validate-marketplace.mjs'), '--base', 'HEAD'], {
    cwd: r.dir, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' },
  });
  git('init', '--quiet');
  git('add', '-A');
  git('commit', '--quiet', '-m', 'base');

  r.write('plugins/reviewer/evals/smoke/prompt.md', 'Review this.\n');
  const evalsOnly = lint();
  assert.equal(evalsOnly.status, 0, evalsOnly.stdout + evalsOnly.stderr);

  r.write('plugins/reviewer/agents/reviewer.md', '---\nname: reviewer\ndescription: Reviews code, changed\nskills:\n  - base:style\n---\n');
  const agentChanged = lint();
  assert.notEqual(agentChanged.status, 0);
  assert.match(agentChanged.stdout + agentChanged.stderr, /version was not bumped/);
});
