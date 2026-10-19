# Enforcement — a dependency-cruiser gate for the reference layout

> **A template, not a result.** This config targets the reference layout in
> [layer-map.md](layer-map.md). Adapt the paths to the project's mapping, run it, and
> baseline against the real graph before anyone cites a count from it. Installing it is its
> own change. Until a project has it, check edges as SKILL.md "Enforcement" describes.

This is what turns the dependency rule from "remember to" into "the build fails otherwise."

[`dependency-cruiser`](https://www.npmjs.com/package/dependency-cruiser) is a "test runner for
your import graph": you declare `forbidden` rules over `from → to` path patterns and it
reports every edge that violates them. It is RE2-based — so **no regex look-ahead**;
exclusions are expressed with `pathNot`, and the `$1` back-reference in `to.path` refers to
the capture group in `from.path`.

## 1. Add the config — `.dependency-cruiser.cjs`

> CommonJS (`.cjs`) on purpose: in a `"type": "module"` package a plain `.js` config would be
> parsed as ESM.

Paths below assume the backend source root is `src/` at the package root. Replace `src/` and
the folder names with the project's mapping; replace the SDK/ORM lists with the packages the
project actually uses.

```js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment:
        'Cycles break the inward-only rule. Often starts as WARN: services that take the whole ' +
        'container create container <-> service cycles. Fix genuine same-module cycles first.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-is-pure',
      comment: 'The domain core has NO I/O. Outside capabilities arrive as injected ports.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: {
        path: [
          '^fastify', '^express', '^@nestjs/', 'drizzle-orm', '^pg$', '^postgres', '@prisma/client',
          '^node:fs', '^src/adapters/', '^src/db/', '^src/modules/', '^src/platform/',
        ],
      },
    },
    {
      name: 'ports-are-vendor-neutral',
      comment: 'Ports hold only types, contracts and interfaces; never anything concrete.',
      severity: 'error',
      from: { path: '^src/ports/' },
      to: { path: ['^src/adapters/', '^src/modules/', '^src/platform/', '^src/db/'] },
    },
    {
      name: 'services-depend-on-ports',
      comment:
        'A feature service orchestrates through ports (via the container or a deps object), ' +
        'never a concrete adapter. Add a pathNot for a documented infrastructure-subsystem module.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/service[^/]*\\.ts$' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'routes-are-thin',
      comment: 'Transport (routes) calls the service; it never reaches into adapters.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/routes\\.ts$' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'db-confined-to-repositories',
      comment: 'Schema and ORM queries belong in modules/*/repository*.',
      severity: 'error',
      from: { path: '^src/modules/', pathNot: '^src/modules/[^/]+/repository' },
      to: { path: ['^src/db/schema', 'drizzle-orm', '^pg$', '^postgres', '@prisma/client'] },
    },
    {
      name: 'no-cross-module-internals',
      comment:
        'One feature reaches another only through the composition root, never by importing ' +
        'its sibling module folder. _shared is the allowed common ground. (dependency-cruiser ' +
        'cannot tell an allowed `import type` of <other>/types.ts from a consumer port; the ' +
        'pathNot below allows types.ts, and the tracer script checks the rest.)',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/_shared/', '^src/modules/[^/]+/types\\.ts$'],
      },
    },
    {
      name: 'adapters-dont-know-modules',
      comment: 'Infrastructure must not depend on a feature.',
      severity: 'error',
      from: { path: '^src/adapters/' },
      to: { path: '^src/modules/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['node_modules', '/dist/', '\\.test\\.ts$', '\\.spec\\.ts$'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
```

`tsPreCompilationDeps: true` makes type-only imports count as edges, which is what the rules
mean (a type import of `db/schema` is still a schema edge). `tsConfig` lets
dependency-cruiser resolve path aliases. `env-at-chokepoints` and `one-adapter-per-system`
are about calls, not imports, so they stay with the grep checks / `check-module.sh`.

## 2. Add the scripts — `package.json`

```jsonc
{
  "scripts": {
    "depcruise": "depcruise src --config .dependency-cruiser.cjs"
  }
}
```

If the core or the ports live in another workspace package, add its source folder as a
second root (`depcruise src ../core/src --config …`) so `core-is-pure` walks it as a
first-class root rather than only where the backend imports it.

## 3. Run it

```bash
npm run depcruise          # or the project's package manager
```

dependency-cruiser exits non-zero only on an **`error`**; warnings report without failing.
Wire it into CI next to typecheck and tests; optionally add a pre-commit hook so bad edges
never land.

## Severity rationale — adopt as a ratchet, not a big-bang

Run the config once against the existing code before choosing severities:

- Rules the codebase **already** satisfies → `error`. A new violation fails CI.
- Rules with genuine existing violations → start at `warn` (a burn-down baseline), list the
  violating files in the rule's `comment` or in the project instructions, and promote each
  rule to `error` once its backlog is cleared.
- `no-circular` usually needs a policy decision for cycles through the composition root
  (inject only the needed ports through a deps object, or `exclude` the composition root
  from circular detection) before it can be promoted.

## Exceptions (and how to retire them)

Encode a documented exception as a narrow `pathNot` on the one rule it relaxes, with the
reason in the rule's `comment`, for example:

| Exception | Why it exists | Clean fix |
|-----------|---------------|-----------|
| `pathNot: '^src/modules/indexer/'` on `services-depend-on-ports` | the indexer module *is* infrastructure, reached only through a container facade | none needed; keep the facade boundary intact |
| `pathNot: '^src/modules/search/constants'` on `adapters-dont-know-modules` | an adapter shares a constant a module owns | move the constant to `ports/`, `platform/` or `_shared`, then delete the `pathNot` |

When you remove an exception (or burn down a `warn` backlog) in code, tighten the config in
the same change — an exception or lenient severity that outlives its cause silently re-opens
the boundary. That tightening *is* the ratchet.

## Validating the config itself

After editing rules, sanity-check that they parse and that the exception scoping is right:

```bash
npx depcruise src --config .dependency-cruiser.cjs --output-type err-long   # readable violation report
npx depcruise src --config .dependency-cruiser.cjs --output-type dot | dot -T svg > graph.svg  # visualize
```
