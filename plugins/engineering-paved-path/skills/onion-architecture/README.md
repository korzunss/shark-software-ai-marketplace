# onion-architecture — provenance & sources

A hand-authored skill that encodes onion / ports-and-adapters layering for TypeScript
backends, generalized from a production Fastify + Drizzle + Postgres codebase. It works on a
reference layout that each project maps its own folders onto, and ships checks to enforce it.

- **Scope:** TypeScript backends (HTTP APIs, workers, CLI/MCP-style packages).
- **Out of scope:** frontend code → use `engineering-paved-path:frontend-architecture` /
  `engineering-paved-path:react-best-practices`.

## Reading list (the practices this skill distills)

### Onion / Clean architecture (canon)
- Jeffrey Palermo — The Onion Architecture: part 1 — https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
- Jeffrey Palermo — onion-architecture tag (parts 2–4) — https://jeffreypalermo.com/tag/onion-architecture/
- Herberto Graça — Onion Architecture (Software Architecture Chronicles) — https://medium.com/the-software-architecture-chronicles/onion-architecture-79529d127f85
- Robert C. Martin (Uncle Bob) — The Clean Architecture — https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- Original Palermo example (repo) — https://github.com/Jordiag/Jeffrey-Palermo-Onion-Architecture

### Ports & Adapters in Node.js / TypeScript
- Domain-Driven Hexagon (Sairyss) — https://dev.to/sairyss/domain-driven-hexagon-18g5
- Khalil Stemmler — Clean Node.js Architecture — https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/
- Hexagonal & Clean Architecture with examples (dyarleniber) — https://dev.to/dyarleniber/hexagonal-architecture-and-clean-architecture-with-examples-48oi
- Ports and Adapters explained with two real codebases (Saad Hasan) — https://saadh393.github.io/blog/adapter-port-architecture-two-cases
- Future-Proof Your Code: Ports & Adapters (Alex Rusin) — https://blog.alexrusin.com/future-proof-your-code-a-guide-to-ports-adapters-hexagonal-architecture/
- tsh.io — Hexagonal architecture overview & best practices — https://tsh.io/blog/hexagonal-architecture

### dependency-cruiser (forcing the boundaries)
- dependency-cruiser — npm — https://www.npmjs.com/package/dependency-cruiser
- Validate Dependencies According to Clean Architecture (Ken Miyashita) — https://betterprogramming.pub/validate-dependencies-according-to-clean-architecture-743077ea084c
- Avoid Cross Module Dependencies with Dependency Cruiser — https://dev.to/jacobandrewsky/avoid-cross-module-dependencies-with-dependency-cruiser-3b0b
- Dependency Cruiser: Restrict Imports in JavaScript (Atomic Object) — https://spin.atomicobject.com/dependency-cruiser-imports/
- cubic — maintain clean architecture with dependency rules — https://www.cubic.dev/blog/how-to-maintain-clean-architecture-with-dependency-rules-in-your-codebase

### Fastify (layering / encapsulation)
- Fastify — Plugins Guide — https://fastify.dev/docs/latest/Guides/Plugins-Guide/
- Fastify — Encapsulation — https://fastify.dev/docs/latest/Reference/Encapsulation/
- Build Production-Ready APIs with Fastify (Strapi) — https://strapi.io/blog/build-production-ready-apis-with-fastify
- node-fastify-architecture (modular structure) — https://github.com/sujeet-agrahari/node-fastify-architecture

### ORM / Repository pattern
- Repository Pattern in Nest.js with Drizzle ORM — https://medium.com/@vimulatus/repository-pattern-in-nest-js-with-drizzle-orm-e848aa75ecae
- Atomic Repositories in Clean Architecture and TypeScript (Sentry) — https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript/
- cosmicpython — Repository Pattern — https://www.cosmicpython.com/book/chapter_02_repository
- Microsoft Learn — infrastructure persistence layer design — https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design

## Files

- `SKILL.md` — the one rule, the ring diagram, the reference layout, the decision framework,
  the "add a dependency" recipe, the rule vocabulary, how to check.
- `layer-map.md` — every ring on the reference layout, a tool→port→adapter table, a
  "where does it go?" cheatsheet, and a template for documenting your project's mapping.
- `enforcement.md` — a `.dependency-cruiser.cjs` for the reference layout, scripts, severity
  rationale (ratchet), and how to encode exceptions.
- `scripts/check-module.sh` — edge, env and second-client checks for one module folder;
  layout passed as arguments.
- `scripts/trace-imports.mjs` — follows imports transitively (`_shared`, ports re-exports,
  dynamic `import()`, `require`), flags imports of another module's consumer ports, and
  prints every chain that leaves its layer; layout passed as arguments.
