// End-to-end tests for scripts/release.mjs and scripts/rollback.mjs.
// Each test runs the scripts against a throwaway copy of this repository with its own git history.
// Run: node --test scripts/test/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT } from '../lib/common.mjs';

const PLUGIN = 'research-tools';
const PLUGIN_DIR = `plugins/${PLUGIN}`;
const AGENT = `${PLUGIN_DIR}/agents/researcher.md`;
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com',
  GITHUB_ACTIONS: '', GITHUB_OUTPUT: '',
  // No background `gc --auto` / maintenance after commits: a detached git process still
  // writing to .git/objects makes the cleanup below fail with ENOTEMPTY (seen on CI).
  GIT_CONFIG_COUNT: '2',
  GIT_CONFIG_KEY_0: 'gc.auto', GIT_CONFIG_VALUE_0: '0',
  GIT_CONFIG_KEY_1: 'maintenance.auto', GIT_CONFIG_VALUE_1: 'false',
};

function makeRepo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marketplace-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  fs.cpSync(ROOT, dir, {
    recursive: true,
    filter: (src) => !['.git', 'node_modules'].includes(path.basename(src)),
  });
  const repo = {
    dir,
    git: (...args) => execFileSync('git', args, { cwd: dir, env: GIT_ENV, encoding: 'utf8' }).trim(),
    run: (script, ...args) => spawnSync('node', [path.join(dir, 'scripts', script), ...args], { cwd: dir, env: GIT_ENV, encoding: 'utf8' }),
    read: (file) => fs.readFileSync(path.join(dir, file), 'utf8'),
    write: (file, text) => fs.writeFileSync(path.join(dir, file), text),
    version: () => JSON.parse(fs.readFileSync(path.join(dir, PLUGIN_DIR, '.claude-plugin/plugin.json'), 'utf8')).version,
  };
  repo.git('init', '--quiet', '--initial-branch=main');
  repo.git('add', '--all');
  repo.git('commit', '--quiet', '--message', 'init');
  return repo;
}

function ok(result) {
  assert.equal(result.status, 0, `exit ${result.status}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function addUnreleasedNote(repo, note) {
  const file = `${PLUGIN_DIR}/CHANGELOG.md`;
  repo.write(file, repo.read(file).replace('## [Unreleased]\n', `## [Unreleased]\n\n### Changed\n\n- ${note}\n`));
}

test('bump refuses without Unreleased notes', (t) => {
  const repo = makeRepo(t);
  const r = repo.run('release.mjs', 'bump', PLUGIN, 'patch', '--base', 'main');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unreleased/);
  assert.equal(repo.version(), '1.0.0');
});

test('bump moves notes into a version section, updates README, passes the linter', (t) => {
  const repo = makeRepo(t);
  repo.git('checkout', '--quiet', '-b', 'feat');
  repo.write(AGENT, `${repo.read(AGENT)}\n- New rule.\n`);
  addUnreleasedNote(repo, 'Added a rule.');

  ok(repo.run('release.mjs', 'bump', PLUGIN, 'patch', '--base', 'main', '--date', '2026-11-01'));
  assert.equal(repo.version(), '1.0.1');

  const changelog = repo.read(`${PLUGIN_DIR}/CHANGELOG.md`);
  assert.match(changelog, /## \[Unreleased\]\n\n## \[1\.0\.1\] - 2026-11-01\n\n### Changed\n\n- Added a rule\./);
  assert.match(changelog, /## \[1\.0\.0\] - 2026-10-19/);
  assert.match(repo.read('README.md'), /\| `research-tools` \| 1\.0\.1 \|/);

  ok(repo.run('validate-marketplace.mjs', '--base', 'main'));
});

test('re-running bump on the same branch recomputes from the base instead of bumping twice', (t) => {
  const repo = makeRepo(t);
  repo.git('checkout', '--quiet', '-b', 'feat');
  addUnreleasedNote(repo, 'First change.');
  ok(repo.run('release.mjs', 'bump', PLUGIN, 'patch', '--base', 'main', '--date', '2026-11-01'));
  ok(repo.run('release.mjs', 'bump', PLUGIN, 'minor', '--base', 'main', '--date', '2026-11-02'));

  assert.equal(repo.version(), '1.1.0');
  const changelog = repo.read(`${PLUGIN_DIR}/CHANGELOG.md`);
  assert.doesNotMatch(changelog, /1\.0\.1/);
  assert.match(changelog, /## \[1\.1\.0\] - 2026-11-02\n\n### Changed\n\n- First change\./);
});

test('bump rejects an explicit version that is not greater', (t) => {
  const repo = makeRepo(t);
  addUnreleasedNote(repo, 'x');
  const r = repo.run('release.mjs', 'bump', PLUGIN, '1.0.0', '--base', 'main');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /must be greater/);
});

test('tag creates missing tags on main only, once', (t) => {
  const repo = makeRepo(t);
  const first = ok(repo.run('release.mjs', 'tag'));
  assert.match(first.stdout, /research-tools--v1\.0\.0/);
  const expected = fs.readdirSync(path.join(repo.dir, 'plugins'))
    .map((name) => `${name}--v${JSON.parse(repo.read(`plugins/${name}/.claude-plugin/plugin.json`)).version}`)
    .sort();
  assert.deepEqual(repo.git('tag', '--list').split('\n').sort(), expected);

  const second = ok(repo.run('release.mjs', 'tag'));
  assert.match(second.stdout, /already tagged/);

  repo.git('checkout', '--quiet', '-b', 'feat');
  assert.equal(repo.run('release.mjs', 'tag').status, 2);
});

test('notes prints the CHANGELOG section of a version', (t) => {
  const repo = makeRepo(t);
  const r = ok(repo.run('release.mjs', 'notes', PLUGIN, '1.0.0'));
  assert.match(r.stdout, /researcher/);
  assert.equal(repo.run('release.mjs', 'notes', PLUGIN, '9.9.9').status, 2);
});

test('rollback restores files from a tag under a new, higher version', (t) => {
  const repo = makeRepo(t);
  const originalAgent = repo.read(AGENT);
  ok(repo.run('release.mjs', 'tag'));

  // Release 1.1.0 with a modified agent and an extra file.
  repo.write(AGENT, `${originalAgent}\n- Bad rule.\n`);
  repo.write(`${PLUGIN_DIR}/agents/extra.md`, '---\nname: extra\ndescription: Extra agent\n---\n');
  addUnreleasedNote(repo, 'Bad change.');
  ok(repo.run('release.mjs', 'bump', PLUGIN, 'minor', '--date', '2026-11-01'));
  repo.git('add', '--all');
  repo.git('commit', '--quiet', '--message', 'release 1.1.0');

  ok(repo.run('rollback.mjs', PLUGIN, '--to', '1.0.0', '--reason', 'Bad rule broke reviews.', '--date', '2026-11-02'));

  assert.equal(repo.version(), '1.1.1');
  assert.equal(repo.read(AGENT), originalAgent);
  assert.equal(fs.existsSync(path.join(repo.dir, PLUGIN_DIR, 'agents/extra.md')), false);

  const changelog = repo.read(`${PLUGIN_DIR}/CHANGELOG.md`);
  assert.match(changelog, /## \[Unreleased\]\n\n## \[1\.1\.1\] - 2026-11-02\n\n### Reverted\n\n- Rolled back to the contents of 1\.0\.0 \(`[0-9a-f]+`\)\. Reason: Bad rule broke reviews\./);
  assert.match(changelog, /## \[1\.1\.0\] - 2026-11-01/, 'history is kept');
  assert.match(repo.read('README.md'), /\| `research-tools` \| 1\.1\.1 \|/);
  assert.notEqual(repo.git('diff', '--cached', '--name-only'), '', 'result is staged');

  ok(repo.run('validate-marketplace.mjs', '--base', 'main~1'));
});

test('rollback refuses a dirty plugin folder and a missing tag', (t) => {
  const repo = makeRepo(t);
  assert.match(repo.run('rollback.mjs', PLUGIN, '--to', '0.0.1', '--reason', 'x').stderr, /not found/);

  repo.write(AGENT, 'dirty\n');
  assert.match(repo.run('rollback.mjs', PLUGIN, '--to', 'HEAD', '--reason', 'x').stderr, /uncommitted changes/);
  assert.match(repo.run('rollback.mjs', PLUGIN, '--to', 'HEAD').stderr, /--reason is required/);
});
