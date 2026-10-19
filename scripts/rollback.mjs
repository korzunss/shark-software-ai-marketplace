#!/usr/bin/env node
// Roll a plugin back by rolling FORWARD: restore the plugin's files from an earlier
// release and publish them under a NEW, higher version. Lowering the version string
// would not be picked up reliably: that version is already in users' caches.
// See docs/RELEASES.md#rollback.
//
//   node scripts/rollback.mjs <plugin> --to <version|git-ref> --reason "<why>" [--bump patch|minor|major]
//
// --to 1.4.0 restores from the tag <plugin>--v1.4.0; any other value is used as a git ref.
// The current CHANGELOG is kept (history is not rewritten) and gets a "Reverted" section.
// The result is staged; review it, commit and open a pull request.

import fs from 'node:fs';
import {
  BUMPS, SEMVER, UsageError, git, gitOk, nextVersion, parseArgs, parseChangelog,
  readJsonFile, renderChangelog, requirePlugin, runCli, tagName, today,
  updateReadmeVersion, writeJsonFile,
} from './lib/common.mjs';

const USAGE = `Usage:
  node scripts/rollback.mjs <plugin> --to <version|git-ref> --reason "<why>" [--bump patch|minor|major] [--date YYYY-MM-DD]`;

runCli(main, USAGE);

function main(argv) {
  const { positionals, values } = parseArgs(argv, { options: ['to', 'reason', 'bump', 'date'] });
  const [name] = positionals;
  if (!values.to) throw new UsageError('--to is required');
  if (!values.reason?.trim()) throw new UsageError('--reason is required: it goes into the CHANGELOG');
  const kind = values.bump ?? 'patch';
  if (!BUMPS.includes(kind)) throw new UsageError(`--bump must be one of ${BUMPS.join(', ')}`);
  const date = values.date ?? today();

  const plugin = requirePlugin(name);
  if (git('status', '--porcelain', '--', plugin.relDir)) {
    throw new UsageError(`${plugin.relDir} has uncommitted changes; commit or stash them first`);
  }

  const ref = SEMVER.test(values.to) ? tagName(name, values.to) : values.to;
  if (!gitOk('rev-parse', '--verify', '--quiet', `${ref}^{commit}`)) {
    throw new UsageError(`"${ref}" not found; run \`git fetch --tags\` or pass a commit`);
  }
  const sha = git('rev-parse', '--short', `${ref}^{commit}`);

  let restored;
  try {
    restored = JSON.parse(git('show', `${ref}:${plugin.relDir}/.claude-plugin/plugin.json`));
  } catch {
    throw new UsageError(`${plugin.relDir} does not exist at ${ref}`);
  }
  if (restored.name !== name) {
    throw new UsageError(`plugin was named "${restored.name}" at ${ref}; roll back renames by hand`);
  }

  const current = plugin.manifestData.version;
  const next = nextVersion(current, kind);
  const changelogText = fs.readFileSync(plugin.changelog, 'utf8');

  // Restore the files exactly as they were at `ref`, including deleting files added since.
  fs.rmSync(plugin.dir, { recursive: true, force: true });
  git('checkout', ref, '--', plugin.relDir);

  // Keep the current history and record the rollback on top of it.
  const changelog = parseChangelog(changelogText);
  const at = changelog.sections[0]?.name === 'Unreleased' ? 1 : 0;
  changelog.sections.splice(at, 0, {
    name: next,
    header: `## [${next}] - ${date}`,
    body: `### Reverted\n\n- Rolled back to the contents of ${restored.version} (\`${sha}\`). Reason: ${values.reason.trim()}`,
  });
  fs.writeFileSync(plugin.changelog, renderChangelog(changelog));

  writeJsonFile(plugin.manifest, { ...readJsonFile(plugin.manifest), version: next });
  const readmeUpdated = updateReadmeVersion(name, next);
  git('add', '--all', '--', plugin.relDir, ...(readmeUpdated ? ['README.md'] : []));

  console.log(`✔ ${name}: restored the contents of ${restored.version} (${ref}, ${sha}) as version ${next}`);
  console.log(`  staged ${plugin.relDir}${readmeUpdated ? ' and README.md' : ''}`);
  console.log(`\nNext:
  git diff --cached -- ${plugin.relDir}
  npm run validate
  git commit -m "revert(${name}): roll back to ${restored.version}"   # then open a pull request
Need it off right now? Disable the plugin through managed settings first (docs/RELEASES.md#emergency-disable).`);
}
