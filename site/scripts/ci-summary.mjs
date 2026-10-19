#!/usr/bin/env node
// Markdown report of a finished build for the GitHub Actions run page:
//   node scripts/ci-summary.mjs >> "$GITHUB_STEP_SUMMARY"
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(SITE, 'dist');
const catalog = JSON.parse(fs.readFileSync(path.join(dist, 'catalog.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(SITE, 'catalog.config.json'), 'utf8'));
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const lines = [
  '## Site build',
  '',
  `Catalog of **${catalog.marketplace.name}** at \`${(catalog.commit || '').slice(0, 7)}\`: `
    + `**${catalog.plugins.length}** plugin(s), **${catalog.artifacts.length}** artifact(s).`,
  config.hiddenPlugins?.length ? `Hidden from the site: ${config.hiddenPlugins.map((h) => `\`${h}\``).join(', ')}.` : '',
  '',
  '| Plugin | Version | Components | Risk |',
  '|---|---|---|---|',
  ...catalog.plugins.map((p) => {
    const counts = {};
    for (const a of catalog.artifacts) if (a.plugin === p.id) counts[a.type] = (counts[a.type] ?? 0) + 1;
    const comps = Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ') || (p.external ? 'external' : '—');
    const risk = [p.risk.executesCode && 'code', p.risk.network && 'network', p.risk.needsSecrets && 'secrets'].filter(Boolean).join(', ') || '—';
    return `| \`${p.id}\` | ${p.version ?? '—'} | ${comps} | ${risk} |`;
  }),
  '',
  '| Asset | Size | Gzip |',
  '|---|---|---|',
  ...fs.readdirSync(path.join(dist, 'assets'))
    .filter((f) => /\.(js|css)$/.test(f))
    .map((f) => {
      const buf = fs.readFileSync(path.join(dist, 'assets', f));
      return { f, size: buf.length, gzip: zlib.gzipSync(buf).length };
    })
    .sort((a, b) => b.size - a.size)
    .map(({ f, size, gzip }) => `| \`${f}\` | ${kb(size)} | ${kb(gzip)} |`),
];
console.log(lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n'));
