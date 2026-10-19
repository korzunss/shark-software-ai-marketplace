# Changelog

All notable changes to this plugin are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-19

### Added

- `engineering-insights` skill: read the project's insights log and distilled rules at the start of a task, append non-obvious findings at the end (locations from `.sdd/config.json` → `insights`, or the project's own convention).
- `onion-architecture` skill: ports-and-adapters layering for TypeScript backends on a reference layout, with `scripts/check-module.sh`, `scripts/trace-imports.mjs` and a dependency-cruiser config template.
- `frontend-architecture` skill: where frontend code lives in React / Next.js apps.
- `react-best-practices` skill: React anti-pattern catalog with severities.
- `next-best-practices` skill: Next.js App Router practices with topic references.
- `fastify-best-practices` skill: Fastify practices with `rules/`.
- `react-testing-library` skill: user-flow tests with React Testing Library, Vitest and MSW.
- `zod` skill: Zod rules with `references/` and an `assets/` template.
- `typescript-expert` skill: type-level programming, tooling and migrations, with references and a diagnostic script.
- `drizzle-orm-patterns` skill: Drizzle schema, queries, relations, transactions, migrations.
- `postgresql-table-design` skill: PostgreSQL schema design, types, indexes, constraints.
- `security` skill: OWASP Top 10:2025 web-app security with examples and checklists.
- `mermaid-diagram` skill: Mermaid diagrams in Markdown.
