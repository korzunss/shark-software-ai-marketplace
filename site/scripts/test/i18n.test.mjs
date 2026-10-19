// Guards the site's text: everything is in English (no Cyrillic left in code,
// strings or docs), and every i18n key the code asks for exists in
// src/i18n/en.json with the right shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const messages = JSON.parse(fs.readFileSync(path.join(SITE, 'src/i18n/en.json'), 'utf8'));
const CYRILLIC = /[\u0400-\u04FF]/;

function files(dir, exts) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return ['generated', 'node_modules'].includes(e.name) ? [] : files(full, exts);
    return exts.some((x) => e.name.endsWith(x)) ? [full] : [];
  });
}

const code = [
  ...files(path.join(SITE, 'src'), ['.js', '.jsx']),
  ...files(path.join(SITE, 'scripts'), ['.mjs']),
  path.join(SITE, 'index.html'),
  path.join(SITE, 'vite.config.js'),
];
// design/ holds the original mock-up as delivered and is not part of the site.
const text = [...code, ...files(path.join(SITE, 'src/i18n'), ['.json']), path.join(SITE, 'README.md'), path.join(SITE, 'catalog.config.json')];
const lookup = (key) => key.split('.').reduce((node, part) => node?.[part], messages);

test('site code, strings and docs are in English', () => {
  const offenders = text.flatMap((file) => fs.readFileSync(file, 'utf8').split('\n')
    .map((line, i) => (CYRILLIC.test(line) ? `${path.relative(SITE, file)}:${i + 1}: ${line.trim()}` : null))
    .filter(Boolean));
  assert.deepEqual(offenders, []);
});

test('every i18n key used in code exists', () => {
  const missing = [];
  for (const file of code.filter((f) => !f.includes(`${path.sep}test${path.sep}`))) {
    const text = fs.readFileSync(file, 'utf8');
    // t('a.b'), tp('a.b', n), tm('a.b')
    for (const [, fn, key] of text.matchAll(/\b(t|tp|tm)\(\s*'([\w.]+)'/g)) {
      const value = lookup(key);
      const ok = fn === 't' ? typeof value === 'string' : fn === 'tp' ? value && typeof value === 'object' && 'other' in value : value !== undefined;
      if (!ok) missing.push(`${path.relative(SITE, file)}: ${fn}('${key}')`);
    }
    // t(cond ? 'a.b' : 'c.d')
    for (const [, a, b] of text.matchAll(/\bt\([^)]*\?\s*'([\w.]+)'\s*:\s*'([\w.]+)'\s*\)/g)) {
      for (const key of [a, b]) if (typeof lookup(key) !== 'string') missing.push(`${path.relative(SITE, file)}: t('${key}')`);
    }
  }
  assert.deepEqual(missing, []);
});

test('dynamic keys cover every kind and stat', () => {
  const kinds = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp', 'lsp'];
  for (const k of kinds) {
    assert.equal(typeof messages.kinds[k], 'string', `kinds.${k}`);
    assert.equal(typeof messages.kindBadge[k], 'string', `kindBadge.${k}`);
  }
  for (const k of ['executesCode', 'network', 'needsSecrets', 'safe']) assert.equal(typeof messages.risk[k], 'string', `risk.${k}`);
  for (const k of ['transport', 'command', 'url', 'envVars', 'languages', 'model', 'arguments']) {
    assert.equal(typeof messages.artifact.details[k], 'string', `artifact.details.${k}`);
  }
  for (const k of ['plugin', 'skill', 'agent', 'command', 'mcp']) assert.ok(messages.home.stats[k]?.other, `home.stats.${k}`);
});
