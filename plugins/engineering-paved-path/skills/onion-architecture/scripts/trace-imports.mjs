#!/usr/bin/env node
// Transitive import trace for a TypeScript backend laid out as an onion (see layer-map.md).
// Follows each import of the given files through the layers where a leak can hide (own module
// files, the modules' _shared folder, the ports, platform/*) and
// reports every chain that ends on a layer the starting file may not reach. Catches what a
// one-file grep cannot:
//   - an adapter or db/schema reached through _shared or a re-export,
//   - a concrete import re-exported by the ports,
//   - dynamic `import()`, `require()` / `createRequire(...)(…)` and `import('x').T` types,
//   - a type imported from another module's types.ts that is one of that module's own
//     dependency ports (named in its `*ServiceDeps`), not something it provides.
//
//   node trace-imports.mjs <file|dir>... [options]
//
// Paths are relative to the project root. Options (defaults follow the reference layout):
//   --repo <dir>          project root (default: git top level, else cwd)
//   --root <draft>        overlay a draft laid out at project paths on top of --repo: a file is
//                         read from the draft when it exists there, else from the repo
//   --src <dir>           backend source root, relative to the project root (default: src)
//   --modules <dir>       feature modules, relative to --src (default: modules)
//   --shared <dir>        cross-module helpers, relative to --src (default: modules/_shared)
//   --adapters <dir>      adapters, relative to --src (default: adapters)
//   --ports <dir>         ports / contracts, relative to --src; may point outside it with ../
//                         (default: ports)
//   --db <dir>            db code, relative to --src (default: db)
//   --schema <dir|file>   db schema without extension, relative to --src (default: db/schema)
//   --platform <dir>      platform / cross-cutting, relative to --src (default: platform)
//   --container <file>    composition root, relative to --src (default: container.ts)
//   --alias <spec>=<path> path alias into the backend, repeatable; <path> is relative to the
//                         project root (e.g. --alias @app/ports=src/ports). A spec ending in
//                         /* maps a prefix (e.g. --alias '@/*=src/*').
//   --sdk <regex>         package specifiers that count as SDK / I/O imports
//   --db-pkg <regex>      package specifiers that count as ORM / driver imports
//   --ts-from <dir>       directory whose node_modules provides `typescript` (default: --repo,
//                         then --src)
//   -h, --help            show this help
//
// Exit 1 on hits, 2 on a usage error. A hit is a lead: check it against the project's
// documented exceptions before you report it.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
  console.log(self.slice(1, 39).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = args[i + 1];
  if (v === undefined) { console.error(`${name} needs a value`); process.exit(2); }
  args.splice(i, 2);
  return v;
};
const optAll = (name) => {
  const out = [];
  for (let v = opt(name); v !== undefined; v = opt(name)) out.push(v);
  return out;
};
const trimSlash = (p) => normalize(p).replace(/\/+$/, '');

let repo = opt('--repo');
if (!repo) {
  try { repo = execSync('git rev-parse --show-toplevel', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { repo = process.cwd(); }
}
repo = resolve(repo);
const root = resolve(opt('--root') ?? repo);
const SRC = trimSlash(opt('--src', 'src'));
const L = {
  modules: trimSlash(opt('--modules', 'modules')),
  shared: trimSlash(opt('--shared', 'modules/_shared')),
  adapters: trimSlash(opt('--adapters', 'adapters')),
  ports: trimSlash(opt('--ports', 'ports')),
  db: trimSlash(opt('--db', 'db')),
  schema: trimSlash(opt('--schema', 'db/schema')),
  platform: trimSlash(opt('--platform', 'platform')),
  container: trimSlash(opt('--container', 'container.ts')),
};
const aliases = optAll('--alias').map((a) => {
  const i = a.indexOf('=');
  if (i < 1) { console.error(`bad --alias ${a}: expected <spec>=<path>`); process.exit(2); }
  return { spec: a.slice(0, i), path: trimSlash(a.slice(i + 1)) };
});
const SDK = new RegExp(opt('--sdk',
  '^(drizzle-orm|pg|postgres|mysql2|@prisma/client|mongodb|mongoose|ioredis|redis|octokit|@octokit/|simple-git|' +
  '@anthropic-ai/|openai|@google/genai|@aws-sdk/|@google-cloud/|stripe|@slack/|@ast-grep/|@gitbeaker/|axios|undici|' +
  'node-fetch|nodemailer)(/|$)'));
const DB_PKG = new RegExp(opt('--db-pkg', '^(drizzle-orm|pg|postgres|mysql2|@prisma/client|mongodb|mongoose)(/|$)'));
const tsFrom = opt('--ts-from');
const unknown = args.find((a) => a.startsWith('--'));
if (unknown) { console.error(`unknown option: ${unknown}`); process.exit(2); }
if (args.length === 0) {
  console.error('usage: trace-imports.mjs <file|dir>... [options]   (--help for options)');
  process.exit(2);
}

let ts;
for (const base of [tsFrom, repo, join(repo, SRC), join(repo, SRC, '..')].filter(Boolean)) {
  try { ts = createRequire(join(resolve(base), 'package.json'))('typescript'); break; } catch { /* try next */ }
}
if (!ts) {
  console.error('cannot load `typescript` from the project; install it or pass --ts-from <dir with node_modules/typescript>');
  process.exit(2);
}

// ---- file system overlay (draft first, then repo), paths relative to the project root ----
const abs = (rel) => (existsSync(join(root, rel)) ? join(root, rel) : join(repo, rel));
const exists = (rel) => existsSync(join(root, rel)) || existsSync(join(repo, rel));
const isFile = (rel) => exists(rel) && statSync(abs(rel)).isFile();
const EXT = /\.(ts|tsx|mts|cts)$/;
const isTest = (rel) => /\.(test|spec)\.[cm]?tsx?$/.test(rel);

function resolveFile(base) {
  const cands = [base, base.replace(/\.(m|c)?js$/, '.$1ts'), base.replace(/\.js$/, '.tsx'),
    `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return cands.find((c) => EXT.test(c) && isFile(c)) ?? null;
}
function resolveSpec(fromRel, spec) {
  for (const a of aliases) {
    if (a.spec.endsWith('/*')) {
      const prefix = a.spec.slice(0, -1);
      if (spec.startsWith(prefix)) return resolveFile(join(a.path.replace(/\/\*$/, ''), spec.slice(prefix.length)));
    } else if (spec === a.spec) {
      return resolveFile(a.path);
    } else if (spec.startsWith(`${a.spec}/`)) {
      return resolveFile(join(a.path, spec.slice(a.spec.length + 1)));
    }
  }
  if (!spec.startsWith('.')) return null;
  return resolveFile(join(dirname(fromRel), spec));
}

// ---- layers ----
const under = (s, dir) => s === dir || s.startsWith(`${dir}/`);
const stripExt = (s) => s.replace(EXT, '');
function layer(rel) {
  const s = relative(SRC, rel);
  // the ports may live outside --src (a workspace package): --ports ../../packages/contracts/src
  if (under(s, L.ports)) return { kind: 'ports' };
  if (s.startsWith('..')) return { kind: 'outside' };
  if (s === L.container || stripExt(s) === stripExt(L.container)) return { kind: 'root' };
  if (under(s, L.adapters)) return { kind: 'adapter' };
  if (stripExt(s) === L.schema || under(s, L.schema)) return { kind: 'schema' };
  if (under(s, L.db)) return { kind: 'db' };
  if (under(s, L.shared)) return { kind: 'mshared' };
  if (under(s, L.modules)) {
    const m = s.slice(L.modules.length + 1).match(/^([^/]+)\/(.*)$/);
    if (m) {
      const repoFile = /^repository(\.[cm]?tsx?$|\/)|\.repo\.[cm]?tsx?$/.test(m[2]);
      return { kind: 'module', mod: m[1], file: m[2], repoFile, routes: /^routes\.[cm]?tsx?$/.test(m[2]), types: /^types\.[cm]?tsx?$/.test(m[2]) };
    }
  }
  if (under(s, L.platform)) return { kind: 'platform' };
  return { kind: 'other' };
}

// ---- import extraction ----
function importsOf(rel) {
  const text = readFileSync(abs(rel), 'utf8');
  const kind = rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind);
  const out = [];
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const add = (node, spec, how, names = []) => out.push({ spec, how, line: line(node), names });
  const namesOf = (clause) => {
    const b = clause?.namedBindings;
    return b && ts.isNamedImports(b) ? b.elements.map((e) => (e.propertyName ?? e.name).text) : [];
  };
  const visit = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      add(n, n.moduleSpecifier.text, n.importClause?.isTypeOnly ? 'type' : 'import', namesOf(n.importClause));
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      const names = n.exportClause && ts.isNamedExports(n.exportClause)
        ? n.exportClause.elements.map((e) => (e.propertyName ?? e.name).text) : [];
      add(n, n.moduleSpecifier.text, n.isTypeOnly ? 'type re-export' : 're-export', names);
    } else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteral(n.argument.literal)) {
      add(n, n.argument.literal.text, 'type');
    } else if (ts.isCallExpression(n) && n.arguments.length >= 1 && ts.isStringLiteralLike(n.arguments[0])) {
      const callee = n.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword) add(n, n.arguments[0].text, 'dynamic import');
      else if ((ts.isIdentifier(callee) && /require$/i.test(callee.text)) ||
               (ts.isCallExpression(callee) && /createRequire$/.test(callee.expression.getText(sf)))) {
        add(n, n.arguments[0].text, 'require');
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

// ---- consumer ports: what <mod>/types.ts declares for <mod>'s OWN dependencies ----
// The types named in <mod>'s `*ServiceDeps`, plus the types.ts declarations they reference.
// Another module may import what <mod> provides (its service interface, its result types),
// never these: they are shaped to <mod>'s needs and change with them.
const portCache = new Map();
function consumerPorts(mod) {
  if (portCache.has(mod)) return portCache.get(mod);
  const dir = join(SRC, L.modules, mod);
  const refsIn = (node, sf) => {
    const out = new Set();
    const walk = (x) => {
      if (ts.isTypeReferenceNode(x)) out.add(x.typeName.getText(sf).split('.')[0]);
      ts.forEachChild(x, walk);
    };
    walk(node);
    return out;
  };
  const parse = (rel) => ts.createSourceFile(rel, readFileSync(abs(rel), 'utf8'), ts.ScriptTarget.Latest, true);
  const decls = new Map();
  const typesFile = resolveFile(join(dir, 'types'));
  if (typesFile) {
    const sf = parse(typesFile);
    for (const st of sf.statements) {
      if ((ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) && st.name) decls.set(st.name.text, refsIn(st, sf));
    }
  }
  const ports = new Set();
  for (const f of listTs(dir)) {
    const sf = parse(f);
    for (const st of sf.statements) {
      if ((ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) && /ServiceDeps$/.test(st.name.text)) {
        for (const r of refsIn(st, sf)) if (decls.has(r)) ports.add(r);
      }
    }
  }
  for (const queue = [...ports]; queue.length; ) {
    for (const r of decls.get(queue.pop()) ?? []) if (decls.has(r) && !ports.has(r)) { ports.add(r); queue.push(r); }
  }
  portCache.set(mod, ports);
  return ports;
}

// ---- rule for an edge, given where the chain started ----
function ruleFor(origin, edgeFile, target, spec, names = []) {
  const o = layer(origin);
  const e = layer(edgeFile);
  const t = target ? layer(target) : null;
  const sdk = !target && SDK.test(spec);
  if (e.kind === 'ports') {
    if (sdk || (t && t.kind !== 'ports' && t.kind !== 'outside')) return 'ports-are-vendor-neutral';
    return null;
  }
  if (o.kind === 'adapter') return t?.kind === 'module' || t?.kind === 'mshared' ? 'adapters-dont-know-modules' : null;
  if (o.kind !== 'module' || o.repoFile) {
    if (o.kind === 'mshared' || o.kind === 'platform') {
      if (t?.kind === 'adapter') return 'services-depend-on-ports';
      if (t?.kind === 'schema' || (!target && DB_PKG.test(spec))) return 'db-confined-to-repositories';
    }
    return null;
  }
  if (t?.kind === 'schema' || (!target && DB_PKG.test(spec))) return 'db-confined-to-repositories';
  if (t?.kind === 'adapter' || sdk) return o.routes ? 'routes-are-thin' : 'services-depend-on-ports';
  if (t?.kind === 'module' && t.mod !== o.mod && !t.types) return 'no-cross-module-internals';
  if (t?.kind === 'module' && t.mod !== o.mod && t.types && names.some((n) => consumerPorts(t.mod).has(n))) {
    return 'no-foreign-consumer-ports';
  }
  return null;
}
// layers a chain may pass through (where a leak hides); everything else ends the walk
function passThrough(origin, rel) {
  const o = layer(origin);
  const l = layer(rel);
  if (l.kind === 'mshared' || l.kind === 'ports' || l.kind === 'platform') return true;
  return l.kind === 'module' && o.kind === 'module' && l.mod === o.mod && !l.repoFile;
}

// ---- walk ----
const hits = new Map();
function trace(origin) {
  const seen = new Set([origin]);
  const queue = [{ file: origin, chain: [] }];
  while (queue.length) {
    const { file, chain } = queue.shift();
    if (chain.length > 8) continue;
    for (const imp of importsOf(file)) {
      const target = resolveSpec(file, imp.spec);
      const step = `${file}:${imp.line}${imp.how === 'import' ? '' : ` (${imp.how})`}`;
      const rule = ruleFor(origin, file, target, imp.spec, imp.names);
      if (rule) {
        const key = `${origin}|${file}:${imp.line}`;
        const to = rule === 'no-foreign-consumer-ports'
          ? `${target} { ${imp.names.filter((n) => consumerPorts(layer(target).mod).has(n)).join(', ')} }`
          : target ?? imp.spec;
        if (!hits.has(key)) hits.set(key, { origin, rule, chain: [...chain, step], to });
      }
      if (target && !seen.has(target) && passThrough(origin, target)) {
        seen.add(target);
        queue.push({ file: target, chain: [...chain, step] });
      }
    }
  }
}

function listTs(rel) {
  if (isFile(rel)) return EXT.test(rel) && !isTest(rel) && !rel.endsWith('.d.ts') ? [rel] : [];
  const out = new Set();
  for (const base of [join(root, rel), join(repo, rel)]) {
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) if (name !== 'node_modules') out.add(join(rel, name));
  }
  return [...out].flatMap(listTs);
}

const origins = [...new Set(args.map((a) => relative(root, resolve(root, a))).flatMap(listTs))];
if (origins.length === 0) { console.error('no .ts files found in the given paths'); process.exit(2); }
for (const o of origins) trace(o);

// An edge inside another traced file is reported once, from that file, not again per chain.
const originSet = new Set(origins);
const byRule = new Map();
for (const h of hits.values()) {
  const edgeFile = h.chain[h.chain.length - 1].split(':')[0];
  if (h.chain.length > 1 && originSet.has(edgeFile)) continue;
  if (!byRule.has(h.rule)) byRule.set(h.rule, []);
  byRule.get(h.rule).push(h);
}
if (byRule.size === 0) console.log(`no transitive edge leaves its layer (${origins.length} files traced)`);
for (const [rule, list] of byRule) {
  console.log(`[${rule}]`);
  for (const h of list) console.log(`  ${h.chain.join(' → ')} → ${h.to}`);
}
process.exit(byRule.size ? 1 : 0);
