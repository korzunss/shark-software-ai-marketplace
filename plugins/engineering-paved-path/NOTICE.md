# Notice

The skills in this plugin are taken from an upstream open-source project. Most were
collected there from third-party skill repositories; two were written there and are
generalized here for use in any repository. The upstream material is used under the MIT
License reproduced below.

## What was adapted

- `skills/engineering-insights/`: the upstream insights skill. The fixed package routing
  table and the upstream project's dated examples were replaced with configurable file
  locations (`.sdd/config.json` → `insights`, `packages`, or the project's own convention),
  instructions for starting the files, and neutral illustrative examples.
- `skills/onion-architecture/`: the upstream backend layering skill. The upstream module map,
  exceptions and drift lists were replaced with a generic reference layout and guidance for
  mapping a project onto it; the dependency-cruiser config was rewritten for the reference
  layout; `scripts/check-module.sh` and `scripts/trace-imports.mjs` now take the layout as
  arguments. The upstream eval suite (`evals/`) is not included.
- Third-party skills were copied with only these changes: cross-skill references use
  namespaced ids (`engineering-paved-path:<skill>`), a reference to a performance skill not
  shipped here now points to `engineering-paved-path:react-best-practices`, a link to an
  upstream-only document was removed, `security`'s description states the stack of its
  examples and its general scope, `typescript-expert` gained a short *Bundled resources*
  section, and `fastify-best-practices/tile.json` (registry metadata, unreferenced) was
  dropped. The `zod` eval harness (`evals/`) is not included.

## Third-party skill origins

Origins as recorded by the upstream project (its skill lock file or bundled metadata).
Each skill keeps any author, license or source notes it carries in its own files.

| Skill | Origin |
|---|---|
| `fastify-best-practices` | [mcollina/skills](https://github.com/mcollina/skills) (`skills/fastify`), published as `mcollina/fastify-best-practices` |
| `next-best-practices` | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) |
| `zod` | [pproenca/dot-skills](https://github.com/pproenca/dot-skills) (`skills/.curated/zod`) |
| `typescript-expert` | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) |
| `drizzle-orm-patterns` | [giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit) |
| `postgresql-table-design` | [wshobson/agents](https://github.com/wshobson/agents) (`plugins/database-design/skills/postgresql`) |
| `security` | compiled in the upstream project from the sources listed in `skills/security/references.md` |
| `react-testing-library` | rewrite in the upstream project of an earlier community skill; sources in `skills/react-testing-library/README.md` |
| `frontend-architecture` | written in the upstream project; sources in `skills/frontend-architecture/README.md` |
| `react-best-practices`, `mermaid-diagram` | origin not recorded upstream |

## Upstream license

```text
MIT License

Copyright (c) 2026 Ivan Lapa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
