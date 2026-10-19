# Layer map — reference layout

Each onion ring mapped onto the reference layout, with what lives there and the allowed /
forbidden imports. Read this when you are unsure *where* a piece of code belongs.

Paths are relative to the backend's source root (`src/`). **Map your project's folders onto
these layers and document the mapping in `CLAUDE.md` / `AGENTS.md`**, for example:

```md
## Backend layers (onion)
| Layer | Our path |
|---|---|
| Core | `src/core/**` |
| Ports | `packages/contracts/src/**` (alias `@acme/contracts`) |
| Application | `src/features/*/service.ts` |
| Infrastructure | `src/infra/**`, `src/features/*/repo.ts` |
| Composition root | `src/di.ts` |
| Transport | `src/features/*/routes.ts`, `src/app.ts` |
Env chokepoints: `src/config.ts`, `scripts/migrate.ts`.
Exceptions: … · Drift: …
```

If the backend imports the ports or the core through a path alias or a workspace package,
note the alias too: the tracer needs it (`--alias`).

---

## 1. Core / Domain — `domain/**`

The center. Pure functions and types: entities, value objects, policies, calculations,
state transitions. The **iron rule**: no I/O — no DB, fs, network, git, or persistence; no
clock or randomness it doesn't receive as an argument. If the core needs an outside
capability (an LLM, a clock, an id generator), it receives it as an injected port. Pure core
code can run anywhere (server, worker, CLI, CI, tests) without infrastructure.

- **May import:** itself; contract **types** (DTO types, Zod schemas) from the ports.
- **Must NOT import:** the HTTP framework (`fastify`, `express`, …), the ORM or driver
  (`drizzle-orm`, `pg`, `postgres`, `@prisma/client`, …), SDKs, `node:fs`, `adapters/**`,
  `db/**`.

A small backend may have no separate core: the services are the center. That's fine; the
rest of the rules still apply.

## 2. Ports / Contracts — `ports/**`

The interfaces the inner layers depend on; outer layers implement them.

- **Lives here:** port interfaces (`LLMProvider`, `GitClient`, `ForgeClient`,
  `PaymentGateway`, `ObjectStorage`, `SecretsProvider`, `Clock`, …) and contracts (DTOs,
  request/response schemas, event payloads).
- **Rule:** ports name *what the application needs*, never a vendor. `ForgeClient`, not
  `Octokit`; `PaymentGateway`, not `StripeClient`. A port with `openai` in its shape is a leak.
- **May import:** other port/contract types and a schema library (e.g. `zod`).
- **Must NOT import or re-export:** `adapters/`, `modules/`, `platform/`, SDKs.
- If the contracts are shared with a frontend (a workspace package or a copied folder), say
  in the project instructions how changes propagate.

## 3. Application / Services — `modules/<name>/service.ts`

Orchestration. Loads what it needs through its repository and ports, applies domain logic,
persists, emits events.

- **May import:** ports, `domain/`, its own `repository` / `helpers` / `constants` /
  `types`, and (for older "takes the whole container" services) the container type.
- **Must NOT import:** `adapters/**` or SDK packages, values or types. Get adapters through
  the container (`container.llm(...)`, `container.forge(ref)`, `container.storage`, …) or,
  preferably, through a narrow `<Name>ServiceDeps` object the container builds.
- **Exception pattern:** a module that *is* an infrastructure subsystem (e.g. a code indexer)
  may import adapters if it is reached only through a container facade. Document it by
  name; no other module inherits it.

## 4. Infrastructure / Adapters — `adapters/**`, `db/**`, `modules/*/repository*.ts`

The outer ring of *implementations*. Knows about vendors and drivers; knows nothing about
which feature calls it.

### 4a. External-service adapters — `adapters/<kind>/`

Each implements a port; one external system has exactly one adapter. Typical mapping:

| Tool / SDK | Port | Adapter |
|------------|------|---------|
| `openai`, `@anthropic-ai/sdk`, other LLM SDKs | `LLMProvider` | `adapters/llm/<vendor>.ts` |
| `octokit`, a GitLab client | `ForgeClient` | `adapters/forge/<vendor>.ts` |
| `simple-git`, `git` CLI | `GitClient` | `adapters/git/<impl>.ts` |
| `@aws-sdk/client-s3`, GCS | `ObjectStorage` | `adapters/storage/<vendor>.ts` |
| `stripe` | `PaymentGateway` | `adapters/payments/stripe.ts` |
| SMTP / email API | `Mailer` | `adapters/mail/<vendor>.ts` |
| a CLI tool (ripgrep, ast-grep, ffmpeg) | a capability port (`CodeSearch`, …) | `adapters/<tool>/index.ts` |
| env / secret store / vault | `SecretsProvider` | `adapters/secrets/<impl>.ts` |
| — (tests) | every port | `adapters/mocks.ts` or `adapters/<kind>/fake.ts` |

- **May import:** the SDK/driver it wraps, the port it implements, contract types.
- **Must NOT import:** `modules/**` (an adapter must not know about a feature). If an adapter
  needs a constant a module owns, move the constant to `ports/`, `platform/` or `_shared`.

### 4b. Persistence — `db/**` + `modules/<name>/repository.ts`

The ORM / driver and the schema. The repository is the **only** feature code touching the
schema.

- **May import:** `db/schema`, `db/client`, the ORM/driver, contract types.
- **Returns** domain rows (types in `repository.ts` or `db/rows.ts`), not raw query
  builders — keep the ORM from leaking past the repository.
- **Schema changes:** follow the project's migration workflow (generate migrations from the
  schema with the ORM's tool rather than hand-writing them, if that's how the project works).

## 5. Composition root — `container.ts`

The single place that binds ports to concrete adapters. One per app instance; lazily
constructs adapters (resolving credentials through the config or `SecretsProvider`); tests
inject mocks through an overrides object (`ContainerOverrides`). Because its whole purpose is
wiring, it is *allowed* to import both ports and concrete adapter classes — no other file is.

Also platform-level (cross-cutting, not a feature): `config.ts` (the env chokepoint),
`errors.ts`, logging, job scheduling, resilience helpers (retry, timeout, circuit breaker).

## 6. Transport — `modules/<name>/routes.ts` + app bootstrap

The outermost edge: HTTP routes, framework plugins, CLI commands, queue consumers.

- **Pattern:** declare request schemas (params/body/query) that drive validation **and**
  response serialization → call `service.method(...)` → map the result to a DTO.
- **May import:** its own `service`, `_shared` request helpers, contracts from the ports.
- **Must NOT import:** `adapters/**`; `db/schema` (go through the service/repository).
- Register cross-cutting infrastructure (security headers, CORS, rate limits, the error
  handler) **before** the module routes, so encapsulated module plugins inherit it.

---

## Quick "where does it go?" cheatsheet

- Calling an external API / an LLM / git / a CLI tool → **adapter** behind a **port**;
  consume via the container.
- A SQL / ORM query → **repository**.
- "When X happens, do Y then Z" → **service**.
- Parsing/validating a request, shaping a response → **route** (request schema).
- "Given these inputs, compute the result" with no I/O → **domain** (pure).
- Reading an env var or a secret → **config / secrets chokepoint**, injected from there.
- "Feature A needs something feature B owns" → **container**, never a direct cross-module
  value import.

---

## 7. Small packages — the same rule

A small service, worker or CLI package (an MCP server, a queue worker) applies the same rule
with fewer folders and package-local ports:

| Path | Layer | May import | Must not import |
|---|---|---|---|
| `core/*.ts` | application (pure) | `import type` from contracts, `core/` | `http/`, `tools/`, the transport SDK, `fetch`, `process.env`, timers |
| `http/client.ts` (or `adapters/`) | adapter | `core/ports.ts`, `core/errors.ts`, contract types | `tools/`, the entry point |
| `tools/*.ts` / `commands/*.ts`, `server.ts` | transport | `core/`, the transport SDK, schema lib | `http/`, `fetch`, `process.env` |
| `index.ts` | composition root | everything | — |
| `log.ts` | cross-cutting | stderr only (when stdout is a protocol channel) | stdout |
