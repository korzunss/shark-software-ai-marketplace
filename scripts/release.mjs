#!/usr/bin/env node
// Release helper for marketplace plugins. See docs/RELEASES.md.
//
//   bump <plugin> <major|minor|patch|x.y.z>   On a feature branch: bump plugin.json, turn the
//                                             CHANGELOG "Unreleased" notes into a version section,
//                                             update the README catalog. Safe to re-run: the new
//                                             version is always computed from the base branch.
//   tag [--push] [--dry-run]                  On main after merge: create a <plugin>--v<version>
//                                             tag for every plugin version that has none yet.
//   notes <plugin> [version]                  Print the CHANGELOG section of a version (release notes).

import fs from 'node:fs';
import {
  MAIN_BRANCH, UsageError, changelogSection, git, gitOk, loadMarketplace, nextVersion,
  parseArgs, parseChangelog, pluginPaths, renderChangelog, requirePlugin, runCli, tagName,
  today, updateReadmeVersion, writeJsonFile, SEMVER,
} from './lib/common.mjs';

const USAGE = `Usage:
  node scripts/release.mjs bump <plugin> <major|minor|patch|x.y.z> [--base <ref>] [--date YYYY-MM-DD]
  node scripts/release.mjs tag [--push] [--dry-run] [--github-output]
  node scripts/release.mjs notes <plugin> [version]`;

runCli(main, USAGE);

function main(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case 'bump': return bump(rest);
    case 'tag': return tag(rest);
    case 'notes': return notes(rest);
    default: throw new UsageError(command ? `unknown command "${command}"` : 'command is required');
  }
}

// ── bump ────────────────────────────────────────────────────────────────────

function bump(argv) {
  const { positionals, values } = parseArgs(argv, { options: ['base', 'date'] });
  const [name, kind] = positionals;
  if (!kind) throw new UsageError('bump needs <plugin> and <major|minor|patch|x.y.z>');
  const date = values.date ?? today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new UsageError(`--date must be YYYY-MM-DD, got "${date}"`);

  const plugin = requirePlugin(name);
  const current = plugin.manifestData.version;
  if (!SEMVER.test(current ?? '')) throw new UsageError(`${plugin.relDir}: current version "${current}" is not SemVer`);

  // Compute from the version on the base branch, so re-running (e.g. patch → minor) does not double-bump.
  const base = values.base ?? defaultBase();
  const baseVersion = base ? versionAt(base, plugin.relDir) : undefined;
  const from = baseVersion ?? current;
  const next = nextVersion(from, kind);

  const changelogText = fs.readFileSync(plugin.changelog, 'utf8');
  const changelog = parseChangelog(changelogText);
  const unreleased = changelog.sections.find((s) => s.name === 'Unreleased');
  // A section for `current` that is not on the base branch yet belongs to this branch: reuse it.
  const pending = current !== from ? changelog.sections.find((s) => s.name === current) : undefined;

  const notesBody = [pending?.body.trim(), unreleased?.body.trim()].filter(Boolean).join('\n\n');
  if (!notesBody) {
    throw new UsageError(`describe the changes under "## [Unreleased]" in ${plugin.relDir}/CHANGELOG.md first`);
  }

  const versionSection = { name: next, header: `## [${next}] - ${date}`, body: notesBody };
  const others = changelog.sections.filter((s) => s !== unreleased && s !== pending);
  changelog.sections = [{ name: 'Unreleased', header: '## [Unreleased]', body: '' }, versionSection, ...others];
  fs.writeFileSync(plugin.changelog, renderChangelog(changelog));

  writeJsonFile(plugin.manifest, { ...plugin.manifestData, version: next });
  const readmeUpdated = updateReadmeVersion(name, next);

  console.log(`✔ ${name}: ${from} → ${next}${base && baseVersion ? ` (base ${base})` : ''}`);
  console.log(`  updated ${plugin.relDir}/.claude-plugin/plugin.json, ${plugin.relDir}/CHANGELOG.md${readmeUpdated ? ', README.md' : ''}`);
  if (!readmeUpdated) console.log(`⚠ README.md has no catalog row for \`${name}\`; add it by hand`);
  console.log('\nNext: review the diff, run `npm run validate`, commit and open a pull request.');
}

function defaultBase() {
  for (const ref of [`origin/${MAIN_BRANCH}`, MAIN_BRANCH]) {
    if (gitOk('rev-parse', '--verify', '--quiet', `${ref}^{commit}`)) return ref;
  }
  return undefined;
}

function versionAt(ref, relDir) {
  try {
    return JSON.parse(git('show', `${ref}:${relDir}/.claude-plugin/plugin.json`)).version;
  } catch {
    return undefined; // plugin does not exist on that ref yet
  }
}

// ── tag ─────────────────────────────────────────────────────────────────────

function tag(argv) {
  const { values } = parseArgs(argv, { flags: ['push', 'dry-run', 'github-output'] });
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== MAIN_BRANCH) throw new UsageError(`tags are created on "${MAIN_BRANCH}" only (current branch: "${branch}")`);
  if (values.push) git('fetch', '--tags', '--quiet', 'origin');

  const created = [];
  for (const entry of loadMarketplace().plugins) {
    if (typeof entry.source !== 'string') continue; // external plugins are released in their own repos
    const { relDir } = pluginPaths(entry.name);
    // Read from HEAD, not the working tree: the tag must match what is committed.
    const version = versionAt('HEAD', relDir);
    if (!version) throw new Error(`${relDir}/.claude-plugin/plugin.json is not committed on HEAD`);
    const name = tagName(entry.name, version);
    if (gitOk('rev-parse', '--verify', '--quiet', `refs/tags/${name}`)) continue;

    const changelog = git('show', `HEAD:${relDir}/CHANGELOG.md`);
    if (changelogSection(changelog, version) === undefined) {
      throw new Error(`${relDir}/CHANGELOG.md has no "## [${version}]" section`);
    }
    if (!values['dry-run']) git('tag', '--annotate', name, '--message', `${entry.name} v${version}`);
    created.push(name);
  }

  if (created.length && values.push && !values['dry-run']) {
    git('push', '--quiet', 'origin', ...created.map((t) => `refs/tags/${t}`));
  }
  if (values['github-output'] && process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `tags=${created.join(' ')}\n`);
  }

  const verb = values['dry-run'] ? 'would create' : values.push ? 'created and pushed' : 'created';
  if (!created.length) console.log('✔ every plugin version is already tagged');
  else console.log(`✔ ${verb} ${created.length} tag(s):\n${created.map((t) => `  ${t}`).join('\n')}`);
  if (created.length && !values.push && !values['dry-run']) {
    console.log(`\nPush them with: git push origin ${created.map((t) => `refs/tags/${t}`).join(' ')}`);
  }
}

// ── notes ───────────────────────────────────────────────────────────────────

function notes(argv) {
  const { positionals } = parseArgs(argv);
  const [name, versionArg] = positionals;
  const plugin = requirePlugin(name);
  const version = versionArg ?? plugin.manifestData.version;
  const body = changelogSection(fs.readFileSync(plugin.changelog, 'utf8'), version);
  if (body === undefined) throw new UsageError(`${plugin.relDir}/CHANGELOG.md has no "## [${version}]" section`);
  console.log(body || '_No notes._');
}
