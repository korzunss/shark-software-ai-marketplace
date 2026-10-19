#!/usr/bin/env node
// Run a plugin's eval suite (`plugins/<plugin>/evals/`) with its dependencies loaded.
//
//   node scripts/run-evals.mjs <plugin> [claude plugin eval options…]
//   npm run evals -- architecture-review --runs 5 --model sonnet --json /tmp/baseline.json
//
// Why a wrapper: `claude plugin eval` loads only the plugins a case lists, only from
// inside the directory it runs against, and skips a plugin whose manifest sets
// `defaultEnabled: false` (engineering-paved-path does). A real install enables
// dependencies, so the wrapper reproduces that: it copies the plugin and its
// dependencies into a temporary marketplace-shaped directory, enables the copies,
// and runs the suite there. The source tree is never modified.
//
// Always passed: --scaffold (the cases' fixture scripts are ours), --trust-plugin,
// --allow-tools Bash (reviewer agents run read-only git and rg under the eval sandbox),
// and --output-dir plugins/<plugin>/evals/results/<timestamp> unless you pass one.
// Every other option goes to `claude plugin eval` unchanged.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PLUGINS_DIR, ROOT, UsageError, readJsonFile, requirePlugin, runCli, writeJsonFile } from './lib/common.mjs';

const USAGE = `Usage:
  node scripts/run-evals.mjs <plugin> [claude plugin eval options…]`;

runCli(main, USAGE);

function main(argv) {
  const [name, ...rest] = argv;
  if (!name || name.startsWith('--')) throw new UsageError('plugin name is required');
  const { dir } = requirePlugin(name);
  if (!fs.existsSync(path.join(dir, 'evals'))) throw new UsageError(`${PLUGINS_DIR}/${name}/evals/ not found`);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shark-evals-'));
  const keep = rest.includes('--keep-temp');
  try {
    for (const plugin of withDependencies(name)) {
      const target = path.join(work, PLUGINS_DIR, plugin);
      fs.cpSync(path.join(ROOT, PLUGINS_DIR, plugin), target, {
        recursive: true,
        filter: (src) => !src.includes(`${path.sep}evals${path.sep}results`),
      });
      const manifest = path.join(target, '.claude-plugin', 'plugin.json');
      const data = readJsonFile(manifest);
      if (data.defaultEnabled === false) {
        data.defaultEnabled = true;
        writeJsonFile(manifest, data);
        console.error(`ℹ ${plugin}: defaultEnabled set to true in the temporary copy (a real install enables dependencies)`);
      }
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = rest.includes('--output-dir')
      ? []
      : ['--output-dir', path.join(ROOT, PLUGINS_DIR, name, 'evals', 'results', stamp)];
    // The target goes first: --allow-tools and --json read a following target as their own value.
    const args = [
      'plugin', 'eval', '.', '--eval-dir', `${PLUGINS_DIR}/${name}/evals`,
      '--allow-tools', 'Bash', '--scaffold', '--trust-plugin', ...outputDir, ...rest,
    ];
    const r = spawnSync('claude', args, { cwd: work, stdio: 'inherit' });
    if (r.error) throw r.error;
    process.exitCode = r.status ?? 1;
  } finally {
    if (keep) console.error(`ℹ kept ${work}`);
    else fs.rmSync(work, { recursive: true, force: true });
  }
}

// The plugin and, transitively, every plugin in its `dependencies`.
function withDependencies(name, seen = new Set()) {
  if (seen.has(name)) return seen;
  seen.add(name);
  const { manifestData } = requirePlugin(name);
  for (const dep of manifestData.dependencies ?? []) withDependencies(typeof dep === 'string' ? dep : dep.name, seen);
  return seen;
}
