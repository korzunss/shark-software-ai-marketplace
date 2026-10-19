---
name: onion-architecture
description: "Onion / ports-and-adapters layering for TypeScript backends (Fastify, Express, NestJS-style or plain Node services). Use when adding or reviewing a backend module — placing routes/services/repositories/adapters, deciding where a DB query or an external SDK call (LLM, payment, GitHub, git, S3, a CLI) may live, defining a port, wiring DI in the composition root, keeping a pure domain core. Enforces the dependency rule (imports point inward), env reads only at their chokepoints, and one adapter per external system, with a per-module check script, a transitive import tracer that finds leaks hidden behind shared helpers, port re-exports and dynamic import(), and a dependency-cruiser config to install. NOT for frontend code (use engineering-paved-path:frontend-architecture) or React code."
version: "2.0.0"
---

# Onion Architecture — TypeScript backends

A reusable ports-and-adapters (onion, hexagonal, clean) layering for a TypeScript backend:
the rings, the one dependency rule, where each kind of code lives, and the checks that
enforce it. Use it whenever you add or review backend code.

Every project names its folders differently. This skill works on a **reference layout**
(below and in [layer-map.md](layer-map.md)); map the project's folders onto it before you
apply a rule. If the project's `CLAUDE.md` / `AGENTS.md` documents that mapping, use it. If
it doesn't, infer it from the code, state the mapping you used in one short table, and
suggest the project record it there.

For provenance and the full reading list, see [README.md](README.md).

## The one rule

**All imports point inward.** A file may depend on layers more central than itself; it may
never depend on a layer further out. Coupling is always toward the core. This is the
Dependency Inversion Principle: inner layers declare interfaces (ports); outer layers
implement them; the composition root wires them together.

```
        ┌──────────────────────────────────────────────┐
        │  Transport (HTTP routes, plugins, CLI, jobs)  │  ← outermost
        │   ┌──────────────────────────────────────┐    │
        │   │  Infrastructure / Adapters            │    │
        │   │   adapters/* · db/* · repositories    │    │
        │   │   ┌──────────────────────────────┐    │    │
        │   │   │  Application (services)       │    │    │
        │   │   │   modules/*/service.ts        │    │    │
        │   │   │   ┌──────────────────────┐    │    │    │
        │   │   │   │  Ports (interfaces)  │    │    │    │
        │   │   │   │  ports/*             │    │    │    │
        │   │   │   │   ┌──────────────┐   │    │    │    │
        │   │   │   │   │  Core/Domain │   │    │    │    │
        │   │   │   │   │  domain/*    │   │    │    │    │
        │   │   │   │   │  (pure)      │   │    │    │    │
        │   │   │   │   └──────────────┘   │    │    │    │
        │   │   │   └──────────────────────┘    │    │    │
        │   │   └──────────────────────────────┘    │    │
        │   └──────────────────────────────────────┘    │
        │      composition root: container.ts            │
        └──────────────────────────────────────────────┘
```

The composition root sits across the rings: it is the **only** place allowed to know both a
port and its concrete adapter, because its job is to bind them.

## Reference layout

Paths are relative to the backend's source root (`src/` below). Full table with
allowed/forbidden imports per layer: → **[layer-map.md](layer-map.md)**.

```
src/
├── domain/                 # Core: pure domain logic, entities, value objects. No I/O.
├── ports/                  # Ports: interfaces + contract types (DTOs, Zod schemas). Vendor-neutral.
├── modules/<name>/         # One folder per feature
│   ├── routes.ts           #   Transport: validate → call service → map result
│   ├── service.ts          #   Application: orchestration through ports
│   ├── repository.ts       #   Infrastructure: the only DB access of this module
│   ├── types.ts            #   what the module provides + the ports it consumes
│   └── helpers.ts, constants.ts
├── modules/_shared/        # Cross-module helpers with no I/O
├── adapters/<kind>/        # One adapter per external system (+ adapters/mocks.ts)
├── db/                     # schema/, client.ts, migrate.ts, seed.ts
├── platform/
│   └── config.ts           # Env chokepoint: parse + validate env once (+ errors, logging)
├── container.ts            # Composition root (DI): binds ports ↔ adapters
└── app.ts / server.ts      # Transport bootstrap: plugins, then module routes
```

| Layer | Reference path | May import | Must NOT import |
|-------|------|-----------|-----------------|
| Core | `domain/**` | itself, port/contract **types** | any I/O: HTTP framework, ORM/driver, SDKs, `node:fs`, `adapters/**`, `db/**` |
| Ports | `ports/**` | other port/contract types | anything concrete (adapters, modules, platform, SDKs) |
| Application | `modules/*/service.ts` | ports, own `repository`/`helpers`/`types`, `domain` | `adapters/**`, SDKs (values **or** types) |
| Infrastructure | `adapters/**`, `db/**`, `modules/*/repository*.ts` | ports, drivers/SDKs, `db/schema` | `modules/**` (a feature) |
| Composition root | `container.ts` | everything (binds ports↔adapters) | — |
| Transport | `modules/*/routes.ts`, app bootstrap | own `service`, `_shared`, contracts | `adapters/**`, `db/schema` (go through the service) |

Common alternative names map straight onto these rings: `core/`, `entities/` → Core;
`contracts/`, `interfaces/`, a shared types package → Ports; `use-cases/`, `application/` →
Application; `infrastructure/`, `infra/`, `gateways/`, `clients/` → Infrastructure;
`controllers/`, `handlers/`, `http/` → Transport; `di.ts`, `bootstrap.ts`, `main.ts` →
composition root.

## Decision framework (placing a change)

Apply in order:

1. **Is it an external call** (HTTP API, DB, git, an LLM, a payment provider, object storage,
   a CLI tool)? It belongs behind a **port** in `ports/`, implemented by an **adapter** in
   `adapters/<kind>/`. Never call an SDK from a service or a route.
2. **Is it a DB query?** It lives in `modules/<name>/repository.ts` (or `repository/*.repo.ts`),
   the only files allowed to touch `db/schema` and the ORM/driver. Repositories return domain
   rows, never a query builder that the caller keeps chaining: a repository method that returns
   `this.db.select()…` without awaiting it lets the service reach `.limit()` and `.orderBy()`, so
   the ORM has leaked into the application layer. Take the limit or order as a parameter and
   await inside. This includes **type-only** imports: `import type * as t from '../../db/schema'`
   in `types.ts` is still a schema edge. Put a row type in `repository.ts` or `db/rows.ts`.
3. **Is it business orchestration?** It lives in `modules/<name>/service.ts`. The service
   depends on **interfaces**, never on a concrete adapter class and never on SDK **types**
   either (`import type { Octokit } from 'octokit'` in a service is a leak; the payload type
   belongs in the port).
   **Prefer a narrow deps object for a new service:** `<Name>ServiceDeps` holding its
   repository, the ports it uses (`forge: (ref) => …`, `llm`, `storage`), and plain functions.
   A `container.<name>` getter builds it, and that getter is the only place that knows both
   the service and the container. Services that take the whole container work, but they
   create cycles through the composition root and hide what a service really needs; a new
   module shouldn't copy that style.
4. **Is it HTTP wiring?** `modules/<name>/routes.ts` only: request schema (validation +
   response serialization) → call the service → map the result. No logic, no DB, no SDK.
5. **Pure domain logic** (calculations, state transitions, policies, parsing)? It lives in
   `domain/` and stays pure: no I/O, no clock or randomness it doesn't receive as input. If it
   needs an outside capability (an LLM, a clock), inject it as a port.
6. **Cross-module need?** Reach the other capability through `container.*`, never by
   importing another module's `service`, `helpers`, `constants` or `repository` **values**.
   One import across modules is allowed: an `import type` from another module's `types.ts`
   of what that module **provides** — the interface its own service implements and the types
   its methods return. Don't flag those.
   **Never import another module's *consumer ports*** (`no-foreign-consumer-ports`). Those are
   the interfaces a module declares in its `types.ts` for **its own dependencies** — the types
   named in its `*ServiceDeps`, plus the types they reference (e.g. `billing/types.ts`
   declaring `BillingCustomerPort`, `BillingClock`, `BillingLogger` for billing's service).
   They are shaped to that module's needs and change when its needs change, so a second module
   that reuses them breaks on a refactor it never touched. They look exactly like the allowed
   case (an `import type` from `<other>/types.ts`), so check what the name *is*: find it in
   `<other>/service.ts`'s `*ServiceDeps`. The fix is a narrow port in **your own** `types.ts`
   (`export interface InvoicesCustomerPort { getCustomer(…): … }`); structural typing means the
   container passes the same object, so nothing else changes.
7. **Does it read configuration or a secret?** `process.env` is read only at its
   **chokepoints**: the config module (`platform/config.ts`: `loadConfig()` → a validated
   `AppConfig`, reached as `container.config`), the secrets adapter if the project has one,
   an adapter that must set env for a subprocess it spawns, and standalone CLI entry points
   (`db/migrate.ts`, `db/seed.ts`). A new tunable is a field in the config schema + `AppConfig`;
   a new key goes through the secrets port. A `process.env` read anywhere else — a service, a
   route, a helper, **an adapter** — is a finding (`env-at-chokepoints`): tests can't override
   it through the container, and the value skips validation. A draft that adds the field to
   the config *and* still reads `process.env` at the call site is the common half-done
   version: flag the call site, not the config. List the project's actual chokepoints in its
   `CLAUDE.md` / `AGENTS.md`.
8. **Is there already an adapter for that system?** One external system has **one** adapter,
   and everything else goes through its port (git → one `GitClient` adapter, GitHub → one
   forge adapter, each LLM vendor → one adapter behind `LLMProvider`). A second client for the
   same system — another `simpleGit(…)`, another `new Octokit(…)`, a `new OpenAI(…)` outside
   the LLM adapter, or a raw `fetch` to the same API — is a finding (`one-adapter-per-system`),
   **even when it sits in `adapters/` and is wired through the container**. It bypasses what
   the owner enforces: locks, cancellation, per-tenant tokens and host resolution, retries,
   timeouts, cost and tracing. The fix is a new method on the existing port (e.g.
   `GitClient.listTags(ref)`), implemented in the owning adapter and its mock.

## Adding a new external dependency (the canonical move)

1. **Define the port first** — an interface in `ports/` that speaks the application's
   language ("I need to post a review comment", "I need to charge a customer"), with **no**
   vendor name in it.
2. **Implement the adapter** in `adapters/<kind>/<impl>.ts` that wraps the SDK.
3. **Add a mock or fake** (e.g. in `adapters/mocks.ts`) that tests inject.
4. **Wire it in the composition root** as a lazy getter, and add an override field (e.g.
   `ContainerOverrides`) so tests can inject the mock. A getter with no override field, or an
   adapter with no mock, is a review finding: every integration test that reaches it then
   calls the real service. Token and credential lookup belongs inside the container too
   (resolved per tenant or per resource where needed), not in the caller.
5. Services consume `container.<port>` — they never see the SDK.

## Rule vocabulary

Cite these names in findings; the checks and the dependency-cruiser config use the same ones.

| Rule | Meaning |
|---|---|
| `core-is-pure` | Core imports no I/O, framework, ORM, SDK, adapter or db code |
| `ports-are-vendor-neutral` | Ports hold only types, contracts and interfaces; no re-export of anything concrete |
| `services-depend-on-ports` | Services reach external systems through ports, never adapters or SDKs |
| `routes-are-thin` | Routes call the service; no adapters, no DB |
| `db-confined-to-repositories` | Schema and ORM imports only in repositories and `db/` |
| `no-cross-module-internals` | No value imports from another module; reach it via the container |
| `no-foreign-consumer-ports` | No reuse of another module's dependency ports |
| `adapters-dont-know-modules` | Adapters never import a feature module |
| `env-at-chokepoints` | `process.env` only at the documented chokepoints |
| `one-adapter-per-system` | One client per external system, behind one port |
| `no-circular` | No import cycles |

## Enforcement — how to check

### 1. A dependency-cruiser gate, if the project has one

If the project has a dependency-cruiser config (`.dependency-cruiser.cjs` / `.js` / `.json`)
and a script for it, run that script and treat its result as the gate. If it doesn't, don't
run `depcruise` and don't quote a gate result: [enforcement.md](enforcement.md) is a config
for the reference layout that the project can adopt, and its rule names are the vocabulary.

### 2. Trace imports transitively — a clean import line proves nothing

A file's own import lines can all be clean while the file still depends on an adapter or on
`db/schema`, because the edge sits **one hop away**, where a one-file grep never looks:

- **`modules/_shared/`** — a helper there that imports an adapter or the ORM / `db/schema`
  makes every module that imports the helper depend on it. `_shared` is outside the module
  folder, so a per-module search does not see it.
- **The ports package** may hold only types, contracts and interfaces. An
  `export { x } from '../adapters/…'` (or any import of `adapters/`, `modules/`, `platform/`
  or an SDK) in a ports file turns every import from the ports package into a hidden adapter
  import. Flag it in the ports file as `ports-are-vendor-neutral`.
- **Re-exports** (`export … from`, `export type … from`): a re-export is an import. A local
  `types.ts` that re-exports another module's `repository.ts` row type is a cross-module edge.
- **Non-static imports**: `await import('…')`, `require('…')`,
  `createRequire(import.meta.url)('…')` and the type form `import('…').T`. Searches for
  `from '…'` miss all of them.

So for every changed backend file, follow each import until it reaches a layer the file may
not depend on, or a layer that ends the walk (an adapter, `db/`, another module, the
container, the own repository). **Report the edge where it actually is** (the `_shared` /
ports file line, the dynamic `import()` line), and name the changed file that reaches it.
The bundled tracer does this on the TypeScript AST (it loads `typescript` from the project's
`node_modules`):

```bash
node "${CLAUDE_SKILL_DIR}/scripts/trace-imports.mjs" <files or dirs>... [--src src] [layout options]
node "${CLAUDE_SKILL_DIR}/scripts/trace-imports.mjs" --help      # all options
```

Paths are relative to the project root (the git top level, or `--repo`). Layout options
(`--src`, `--modules`, `--shared`, `--adapters`, `--ports`, `--db`, `--schema`,
`--platform`, `--container`, `--alias <specifier>=<path>`) default to the reference layout;
pass the project's own folders when they differ, and `--alias` for each path alias that
points into the backend (e.g. `--alias @app/ports=src/ports`). `--root <draft>` overlays a
draft laid out at project paths on top of the repo.

Pass **every** changed file, including new `_shared`, ports and adapter files. It prints one
chain per leaking edge, for example
`src/modules/x/service.ts:4 → src/modules/_shared/forge-client.ts:2 → src/adapters/github/octokit.ts`.
It also flags an `import type` from another module's `types.ts` that names one of that
module's consumer ports (`no-foreign-consumer-ports`, step 6; it relies on the
`*ServiceDeps` naming), and prints the port names. It does not read `.diff` files, so trace
the edits in a diff by hand.

### 3. Edge checks for one module

**For one backend module, run the bundled script first.** It runs the edge checks below for
that module, plus the repo-wide adapter, second-client and env checks, and skips comment
lines and test files:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/check-module.sh" <module-dir> [options]
bash "${CLAUDE_SKILL_DIR}/scripts/check-module.sh" --help        # all options
```

`<module-dir>` is the module folder (e.g. `src/modules/billing`). The source root defaults to
two levels above it; `--adapters`, `--env-allow` (regex of chokepoint files),
`--clients` (regex of SDK client constructors) and `--db` (regex of schema/ORM imports)
default to the reference layout and common SDKs. Each hit is a lead, not a verdict: match it
against the project's documented exceptions and check `git show HEAD:<file>` before you
report it. It does not read `.diff` files or tell value from type use beyond the
`import type` prefix, so read the changed files too.

Without the scripts, the same checks by hand (adjust the paths to the project's mapping):

```bash
grep -rnE "from '(\.\./)+adapters/" src/modules/<mod>             # services-depend-on-ports / routes-are-thin
grep -rnE "db/schema|drizzle-orm|from 'pg'|@prisma/client" src/modules/<mod>   # db-confined-to-repositories (expect repository only)
grep -rnE "from '\.\./[a-z-]+/" src/modules/<mod>                 # cross-module: keep only `import type` from <other>/types
grep -rnE "modules/" src/adapters                                 # adapters-dont-know-modules
grep -rnE "process\.env" src --include=*.ts                       # env-at-chokepoints (expect only the chokepoints)
grep -rnE "new (Octokit|OpenAI|Anthropic|S3Client|Stripe)\(|simpleGit\(" src   # one-adapter-per-system (one file each)
grep -rnE "from '(node:fs|fastify|express|drizzle-orm|pg|postgres)" src/domain  # core-is-pure
```

Call an edge *pre-existing* only after checking `git show HEAD:<file>`. A new file that
copies existing drift is still a new violation, because drift is a backlog to burn down, not
a precedent.

## Known exceptions & drift (do not "fix" silently)

Real codebases have both. Keep them in the project's `CLAUDE.md` / `AGENTS.md` (or next to
the dependency-cruiser config) so reviewers can tell them apart:

- **Exceptions** are legitimate and stay: e.g. a module that *is* an infrastructure
  subsystem (an indexer reached only through a container facade) may import adapters; the
  env chokepoints of step 7; the one client per system of step 8; an `import type` of what
  another module provides (step 6). Each exception names the file and the reason, and no
  other file inherits it.
- **Drift** is a real violation in existing code: list it, don't copy it, and burn it down.
  Verify before you cite it; the list goes stale.

When the project documents neither, report what you find and say which edges you treated as
exceptions and why.
