# Specification: marketplace site on GitHub Pages

Status: **approved v0.2** · 2026-10-17 · scope: MVP + v2 · design: [`SITE-DESIGN-SPEC.md`](SITE-DESIGN-SPEC.md)

A static site that shows the contents of the `shark-software-ai-marketplace` marketplace: plugins, skills, agents, commands, hooks, and MCP servers. Its main function is natural-language search («мені треба скіл для рев'ю PR», "I need a skill for PR review") with results shown as cards. The site also helps users install plugins and create a new one.

Context and terminology are described in [`docs/temp/MARKETPLACE-RESEARCH.md`](temp/MARKETPLACE-RESEARCH.md). References to it below are marked as "Research §N".

---

## Contents

1. [Goals and non-goals](#1-goals-and-non-goals)
2. [Constraints](#2-constraints)
3. [Architecture](#3-architecture)
4. [Data model: catalog.json](#4-data-model-catalogjson)
5. [Catalog build](#5-catalog-build)
6. [Search](#6-search)
7. [Pages and features](#7-pages-and-features)
8. [Plugin content requirements](#8-plugin-content-requirements)
9. [Non-functional requirements](#9-non-functional-requirements)
10. [CI, deployment, testing](#10-ci-deployment-testing)
11. [Repository structure](#11-repository-structure)
12. [Phases and acceptance criteria](#12-phases-and-acceptance-criteria)
13. [Open questions](#13-open-questions)

---

## 1. Goals and non-goals

### Goals

| # | Goal | For whom |
|---|---|---|
| G1 | Find an artifact for a task within a minute, even if the query is in Ukrainian and the content is in English | User |
| G2 | Understand before installing what a plugin does, whether it executes code, and how much context it takes | User |
| G3 | Install one or several plugins by copying ready-made commands or `settings.json` | User, team lead, admin |
| G4 | Follow changes without reading the git history | User |
| G5 | Create a new plugin from the correct template | Author |
| G6 | Give agents a machine-readable catalog | Claude Code, scripts |

### Non-goals

- Ratings, reviews, comments, install counters. They require a backend or a third-party service.
- Visit analytics and any third-party requests (see §9).
- Editing content from the site. All changes are made via PR.
- Semantic search on embeddings. This is v3, but the search architecture must not block it (see §6.8).
- An English interface. All interface strings are collected in a single dictionary so that EN can be added later.

---

## 2. Constraints

1. **No backend.** All data is computed at build time in GitHub Actions, and the browser only reads static files.
2. **Site visibility is a deployment blocker** (see §13, Q1). A GitHub Pages site from a private repo on the Pro and Team plans is **public**. Access can be restricted only on Enterprise Cloud (Pages with access control) or on other hosting with authentication. Development does not depend on this decision: the site is built as static files either way.
3. **Project site with a base path.** The site is served at `https://<org>.github.io/<repo>/`, so all links must account for `base`. A custom domain is optional.
4. **GitHub Pages limits:** site ≤ 1 GB, soft bandwidth limit of 100 GB/month, soft limit of 10 builds per hour. Not critical for us.
5. **The site is not a marketplace source.** A marketplace added by a URL to `marketplace.json` does not support relative `source` values (Research §1.15). Therefore all install snippets use the `github` source, not the Pages address.
6. **Plugin content is written by different authors**, so it is treated as untrusted during rendering (see §9.4).

---

## 3. Architecture

```text
push to main
  └─ .github/workflows/pages.yml
       1. validate (the same job as in validate.yml) ── fails → no deploy
       2. node scripts/build-catalog.mjs
            reads:  .claude-plugin/marketplace.json, plugins/**, docs/*.md,
                    .github/CODEOWNERS, git log
            writes: site/src/generated/catalog.json
                    site/src/generated/search-docs.json
       3. astro build (site/)
            static pages, one per plugin and artifact
            public/catalog.json, public/llms.txt, public/feed.xml
            search-index.json (serialized MiniSearch)
       4. actions/upload-pages-artifact → actions/deploy-pages
```

### Stack

| Layer | Choice | Why |
|---|---|---|
| Site generator | **Astro** (static output) | Generates a page per plugin and artifact, renders Markdown and highlights code (Shiki) at build time, and loads JS only into interactive islands |
| Interactive islands | **Preact** | Small size (~4 KB) for search, the configurator, and the generator |
| Search | **MiniSearch** | The index can be built ahead of time and serialized. Supports field boosts, prefix and fuzzy search, and tokenization can be replaced with a custom one |
| Zip in the browser | **JSZip** | For the plugin generator (v2) |
| Frontmatter parsing | `yaml` | Also used by `validate-marketplace.mjs` |

Dependency versions are pinned exactly in `site/package-lock.json`. No dependencies are loaded from a CDN.

**Shared code.** The plugin parser and naming rules live in `scripts/lib/`. They have three consumers: `validate-marketplace.mjs`, `build-catalog.mjs`, and the in-browser plugin generator. This keeps the rules from diverging.

---

## 4. Data model: catalog.json

`catalog.json` is the single data source for pages, search, the configurator, and the public API. The schema is versioned with the `schemaVersion` field. Breaking changes bump the major version.

```jsonc
{
  "schemaVersion": "1.0.0",
  "generatedAt": "2026-10-17T12:00:00Z",
  "commit": "<sha>",
  "marketplace": {
    "name": "shark-plugins",                 // from marketplace.json, not hardcoded
    "description": "…",
    "owner": { "name": "…", "url": "…" },
    "repo": "org/shark-software-ai-marketplace",   // from GITHUB_REPOSITORY
    "defaultBranch": "main"
  },
  "plugins": [
    {
      "id": "team-conventions",              // = name, the identifier before @
      "installId": "team-conventions@shark-plugins",
      "displayName": "Team Conventions",
      "description": "…",
      "version": "1.2.0",
      "author": { "name": "…" },
      "owners": ["@org/team-x"],             // from CODEOWNERS
      "license": "Proprietary",
      "keywords": ["code style", "стиль коду"],
      "category": "quality",
      "tags": ["review"],
      "defaultEnabled": true,
      "dependencies": ["base-tools"],        // normalized to id
      "path": "plugins/team-conventions",
      "createdAt": "2026-09-01",             // first commit of the entry in marketplace.json
      "updatedAt": "2026-10-10",             // last commit in plugins/<id>/**
      "readmeHtml": "…",                     // sanitized HTML
      "changelog": [ { "version": "1.2.0", "date": "2026-10-10", "html": "…" } ],
      "risk": {
        "executesCode": true,                // hooks | stdio MCP | LSP | monitors | bin/ | scripts/
        "network": false,                    // remote MCP (http/sse)
        "needsSecrets": false,               // userConfig.*.sensitive
        "reasons": ["hooks: PostToolUse", "mcp: deploy-api (stdio)"]
      },
      "contextCost": { "tokens": 240, "method": "chars/4 of name+description" },
      "components": ["team-conventions:code-style", "…"]   // artifact ids
    }
  ],
  "artifacts": [
    {
      "id": "team-conventions:code-style",   // as Claude Code sees it
      "type": "skill",                       // skill | agent | command | hook | mcp | lsp
      "name": "code-style",
      "plugin": "team-conventions",
      "description": "…",
      "keywords": ["…"],
      "path": "plugins/team-conventions/skills/code-style/SKILL.md",
      "frontmatter": { "…": "…" },           // only fields that are safe to display
      "bodyHtml": "…",                       // for skill, agent, command
      "headings": ["…"],
      "details": { }                        // depends on the type, see below
    }
  ],
  "docs": [ { "slug": "consumers", "title": "…", "path": "docs/CONSUMERS.md", "html": "…" } ],
  "events": [ { "date": "2026-10-10", "kind": "release|added", "plugin": "…", "version": "…" } ]
}
```

`details` for different types:

| type | details |
|---|---|
| `hook` | `[{ event, matcher, kind: "command"/"prompt"/…, command }]`: one artifact per plugin, a table of events |
| `mcp` | `{ transport: "stdio"/"http"/"sse", command?, url?, envVars: ["NAME"] }`: variable **names only**, no values |
| `lsp` | `{ languages, command }` |
| `agent` | `{ model?, tools? }` from frontmatter |
| `command` | `{ argumentHint? }` |

Sizes: `catalog.json` takes no more than **500 KB gzipped**. The artifact body in `search-docs.json` is truncated to the first 4 KB of text without markup.

---

## 5. Catalog build

The `scripts/build-catalog.mjs` script is written for Node 22. It has no dependencies other than `yaml` and Astro's Markdown pipeline, is idempotent, and works without network access.

### 5.1 How components are discovered

The script replicates Claude Code's rules (Research §1.5, §1.7); otherwise the site would show something other than what actually gets loaded:

1. For each entry in `marketplace.json` with a relative `source`, the plugin directory is taken. Entries with external `source` values are shown only with metadata from the entry and an "external source" label. Their content is not scanned.
2. Display metadata is taken first from the marketplace entry, then from `plugin.json` (the entry takes precedence, §1.4). `version` is taken from `plugin.json`.
3. Components:
   - `skills` — the standard `skills/` directory **plus** paths from `plugin.json`;
   - `commands`, `agents` — paths from `plugin.json` **replace** the standard directory if they are set;
   - `hooks` — `hooks/hooks.json`, merged with `plugin.json` and inline hooks from the entry;
   - `mcpServers` — `.mcp.json`, merged with `plugin.json`;
   - `lspServers` — `.lsp.json`, merged with `plugin.json`.
4. If an artifact fails to parse, the build fails with the path to the file. The site must not silently skip content.

### 5.2 Computed fields

- **`risk`.** `executesCode` = there are hooks, stdio MCP, LSP, monitors, or `bin/` or `scripts/` directories. `network` = there is an MCP with the `http`/`sse` transport. `needsSecrets` = `userConfig` has a field with `sensitive: true`. `reasons` lists the specific reasons.
- **`contextCost.tokens`** — an estimate of the context the plugin occupies permanently: `ceil(sum(len(name) + len(description)) / 4)` across skills, agents, and commands. On the site it is always labeled as "≈ estimate". Full skill texts are loaded only when the skill is used. Color thresholds (green < 300, yellow < 1000, red ≥ 1000) are configured in `site/config.ts`.
- **`owners`** — matches from `.github/CODEOWNERS` for the plugin path (the last matching rule, as in GitHub).
- **`createdAt`, `updatedAt`, `events`** — from `git log`. The workflow checks out with `fetch-depth: 0`.
- **`changelog`** — parsing of `CHANGELOG.md` in the Keep a Changelog format: `## [1.2.0] - 2026-10-10`.

---

## 6. Search

### 6.1 Index documents

Each plugin, artifact, and documentation page (v2) becomes a separate document with the fields:

| Field | Boost |
|---|---|
| `name`, `displayName` | 5 |
| `keywords` | 4 |
| `description`, `tags`, `category` | 3 |
| `headings` | 2 |
| `body` (≤ 4 KB) | 1 |
| `pluginName` | 1 |

Additional fields for filters: `type`, `plugin`, `tags`, `owners`, `risk.*`.

### 6.2 Text normalization

The same `normalize()` function is applied to both the index and the query:

1. NFKC, lowercasing.
2. All apostrophes (`'`, `’`, `ʼ`, `` ` ``) are reduced to `'`. The token is also stored without the apostrophe, so that «рев'ю» and «ревю» match.
3. Text is split on everything except letters, digits, `'`, `-`, and `_`. Tokens with `-` and `_` are indexed both whole and in parts: `code-style` → `code-style`, `code`, `style`.
4. UA and EN stopwords from the `site/src/search/stopwords.json` list are removed: «мені», «треба», «потрібен», «щоб», «для», «який», «need», «a», «for», «to», etc.
5. **Light stemmer for UA:** conservative stripping of the most common noun and verb endings if the remainder has at least 4 letters («тестів» → «тест», «перевірки» → «перевірк»). For EN — Porter. The original token is also indexed, so an exact match weighs more.

### 6.3 Intent parsing

Before searching, words denoting an artifact type are removed from the query and turned into a filter. The dictionary lives in `site/src/search/intents.json`:

| Words (all cases and variants) | Filter |
|---|---|
| скіл, скіла, скіли, навичка, skill | `type=skill` |
| агент, агента, субагент, agent, subagent | `type=agent` |
| команда, слеш-команда, command | `type=command` |
| хук, hook | `type=hook` |
| mcp, мсп, сервер | `type=mcp` |
| плагін, plugin | `type=plugin` |

A detected filter is shown as a removable chip ("Type: skill ✕"). If nothing remains after removing stopwords and intent words, all artifacts of that type are shown.

### 6.4 Synonyms and translation

`site/src/search/synonyms.json` contains groups of equivalent terms, for example `["review", "рев'ю", "огляд", "code review"]` or `["test", "тест", "тестування"]`. Each query term is expanded with the members of its group via OR with a down-weighting factor of 0.7. The dictionary is extended via PR. Candidates for it are suggested by zero-result queries (see §6.6).

The main mechanism for cross-language search is **bilingual `keywords`** in the plugins themselves (§8). Synonyms only complement them.

### 6.5 Ranking

- MiniSearch's BM25 with the boosts from §6.1.
- Prefix search for terms of 3 or more characters. Fuzzy search (`fuzzy: 0.2`) for terms of 5 or more characters.
- `combineWith: "AND"`. If there are 0 results, the search is automatically retried with `OR`, and a note "No exact matches, showing partial ones" appears above the results.
- A 1.2 multiplier for artifacts whose type matches the intent, for the case when the filter was removed manually.

### 6.6 Empty results

If there are still no results even after OR, the following are shown:
- a "Did you mean…" hint with the closest names by fuzzy matching;
- popular tags;
- a **"Request such a plugin"** button that opens a new issue from the `new-plugin` template with the user's query in the body (§7.9).

### 6.7 State and performance

- Search state lives in the URL: `?q=…&type=…&plugin=…&tag=…&risk=…`. A link to results can be shared, and the "back" button works.
- The index is loaded lazily when the search field receives focus or when the page is opened with search parameters in the URL.
- Results update with a 100 ms debounce. Search together with rendering takes < 50 ms on a catalog of up to 1000 documents.

### 6.8 Extensibility (groundwork for v3)

Search is hidden behind a `search(query, filters) → Result[]` interface, and intent parsing and normalization are extracted into separate modules. The semantic mode in v3 will be added as another implementation of the same interface with no changes to the UI.

---

## 7. Pages and features

Routes are relative to `base`. All pages are generated statically.

| Route | Feature | Phase |
|---|---|---|
| `/` | Search + cards, F1 | MVP |
| `/plugins/<id>/` | Plugin page, F2 | MVP |
| `/plugins/<id>/<type>/<name>/` | Artifact page, F3 | v2 |
| `/configure/` | Configuration builder, F4 | MVP |
| `/changelog/`, `/feed.xml` | What's new, F5 | v2 |
| `/docs/<slug>/` | Documentation, F6 | v2 |
| `/create/` | Plugin generator, F7 | v2 |
| `/catalog.json`, `/llms.txt` | Machine-readable catalog, F8 | v2 |

### F1. Search and cards (MVP)

- A large search field with example hints («скіл для рев'ю PR» — "skill for PR review", «агент для міграцій БД» — "agent for DB migrations").
- Facets: type (with counters), plugin, tag, owner, "no code execution".
- **Artifact card:**
  - type icon and color;
  - full id (`plugin:name`) and name;
  - a 2-line description with highlighted matches;
  - plugin and version;
  - risk and context-cost badges (F2.3);
  - actions: "Open", "Copy install command" (for the plugin the artifact belongs to), "Add to configuration".
- A "Group by plugin" toggle. Results are flat by default.
- With no query, the entire catalog is shown, sorted by `updatedAt`.

### F2. Plugin page (MVP)

1. **Header:**
   - name, version, description;
   - owners, license, update date;
   - a "Code on GitHub" link;
   - "disabled by default" and "external source" labels, if applicable.
2. **Install block** with tabs and a copy button:
   - *In a Claude Code session:* `/plugin marketplace add <repo>` and `/plugin install <id>@<marketplace>`;
   - *CLI:* `claude plugin marketplace add <repo>` and `claude plugin install <id>@<marketplace> --scope project`;
   - *`.claude/settings.json`:* an `extraKnownMarketplaces` + `enabledPlugins` snippet.

   Below the block — a link to `docs/CONSUMERS.md`: authentication to the private repo and the trust dialog (§1.9, §1.13).
3. **Risk badges:**
   - "Executes code", "Network", "Requires a secret" with an expandable `risk.reasons` list;
   - "≈ N tokens permanently" with an explanation of the method.
4. **Contents:** components grouped by type, with links to F3. In the MVP, while F3 does not exist, the links point to the file on GitHub.
5. **Dependencies:** a list with links. When a plugin is added to the configuration, the configurator adds its dependencies too (F4).
6. README (sanitized HTML) and CHANGELOG (last 5 versions, the rest collapsed).
7. "Report a bug" — a new issue from the `bug-report` template with the plugin and version pre-filled.

### F3. Artifact page (v2)

- skill, agent, command: a frontmatter table, the rendered body, a "Raw text" tab with Shiki highlighting and a copy button, a link to the file on GitHub.
- hook: an "event, matcher, type, command" table.
- mcp: transport, command or URL, environment variable **names**.

### F4. Configuration builder (MVP)

1. A list of plugins with checkboxes and the same search and filters as in F1.
2. The selection is stored in the URL (`?p=a,b,c`) and in `localStorage`. Dependencies are added automatically with the explanation "added as a dependency of X".
3. The result in tabs:
   - **Project** — `.claude/settings.json` to commit to the repo;
   - **User** — the same fragment for `~/.claude/settings.json`;
   - **Managed** — a fragment for managed settings with `autoUpdate: true` in the `extraKnownMarketplaces` entry. The exact location of the `autoUpdate` key must be **[verified]** on the current CLI version before release (Research §1.10–1.11);
   - **CLI** — a sequence of `claude plugin …` commands as a shell script.
4. **Merging with an existing file:** the user pastes their `settings.json`, and the result is merged into it. `extraKnownMarketplaces` and `enabledPlugins` are extended, the remaining keys are left unchanged, and invalid JSON produces an error with the line number. Everything runs in the browser.
5. "Copy" and "Download file" buttons.
6. Warnings below the result: the trust dialog for project scope, auto-update being disabled by default, authentication to the private repo. Each with a link to CONSUMERS.

Example result for the "Project" tab:

```json
{
  "extraKnownMarketplaces": {
    "shark-plugins": {
      "source": { "source": "github", "repo": "org/shark-software-ai-marketplace" }
    }
  },
  "enabledPlugins": {
    "team-conventions@shark-plugins": true
  }
}
```

### F5. What's new (v2)

- A feed of events from `events`: new plugins and releases with text from the CHANGELOG. Filter by plugin.
- `/feed.xml` — an Atom feed with the latest 50 events.
- On the home page — a "Recently updated" block (5 events).

### F6. Documentation (v2)

- Rendering of `README.md`, `CONTRIBUTING.md`, `docs/CONSUMERS.md`, `docs/TROUBLESHOOTING.md`, `docs/PLUGIN-GUIDELINES.md`, `docs/SECURITY.md`, and `docs/RELEASES.md`. The `docs/temp/` directory and this document are excluded.
- Documentation pages are indexed in search with the `doc` type.
- Relative links between documents are rewritten to site routes, and links to code are rewritten to GitHub.

### F7. Plugin generator (v2)

1. **Form:**
   - `name` with live validation: kebab-case, no reserved prefixes and names (§1.3), unique among existing plugins;
   - `displayName`, `description`, `author`, `keywords` (with the hint "add UA and EN");
   - which components to create: a skill or skills (with names), agent, command, hooks, MCP.
2. **Result:**
   - a **zip** with `plugins/<name>/…`, assembled from the files in `templates/plugin-template/`. The template is embedded into the site at build time, so the site and the repo do not diverge;
   - an entry snippet for `marketplace.json`;
   - steps from CONTRIBUTING: unpack → `claude plugin validate --strict` → `marketplace add ./` → PR.
3. Validation rules are imported from `scripts/lib/rules.mjs`, meaning they are the same as in the CI linter.

### F8. Machine-readable catalog (v2)

- `/catalog.json` — §4 without the `*Html` fields, with a stable `schemaVersion`.
- `/llms.txt` — a short description of the marketplace and a list of plugins and artifacts in the format "id — description — page URL".
- **The `marketplace-finder` plugin** (a separate plugin in `plugins/`). Its skill helps Claude pick a plugin for a task. It reads data from the **local copy of the marketplace** that Claude Code already keeps in `~/.claude/plugins/marketplaces/<name>/`, not from the site. This way the skill works offline and regardless of whether the site is public. The exact path must be **[verified]**.

### F9. Conveniences (v2)

- A `⌘K` / `Ctrl+K` command palette: quick navigation to a plugin, artifact, or document.
- "Favorites" and "Recently viewed" in `localStorage`. The page must work correctly if storage is unavailable.
- Light and dark theme based on `prefers-color-scheme`, with a manual toggle.

### Links to GitHub issues (F2, F6.6)

An issue is created by navigating to `https://github.com/<repo>/issues/new?template=<file>&title=…&body=…` with URL-encoded parameters. For issue forms in `.yml` format, fields are filled via parameters named by their `id`. The URL length does not exceed 8000 characters, so the body is truncated.

---

## 8. Plugin content requirements

Search quality depends on metadata. Therefore the following rules are added to `scripts/validate-marketplace.mjs` (Research §6):

| # | Rule | Level |
|---|---|---|
| S1 | `plugin.json` has `keywords`: at least 3, including at least one in Cyrillic and one in Latin script | error |
| S2 | The `description` of the plugin, skills, and agents is between 20 and 300 characters | error |
| S3 | The plugin has a `README.md` | error |
| S4 | `CHANGELOG.md` is in the Keep a Changelog format and has an entry for the current `version` | error |
| S5 | Skills have keywords in the `metadata.keywords` frontmatter. Before rollout, **[verify]** that `claude plugin validate --strict` does not treat this as an error | warning |
| S6 | `category` is from the closed list in `site/src/categories.json` | warning |

S1 addresses the main search risk, when the query is in Ukrainian and the content is in English. Updating `templates/plugin-template/` and `PLUGIN-GUIDELINES.md` for these rules is within the MVP scope.

---

## 9. Non-functional requirements

### 9.1 Performance

- LCP < 2 s on "Fast 4G" for `/` and the plugin page. Lighthouse Performance ≥ 90.
- Search island JS ≤ 60 KB gzipped, excluding the index. Index ≤ 300 KB gzipped at the current scale.
- Pages without interactivity load no JS, except for copy buttons.

### 9.2 Accessibility

- WCAG 2.2 AA: contrast, focus styles, `aria-live` for the result count.
- Everything works from the keyboard: `/` focuses search, arrow keys move through results, `Enter` opens.
- The layout is responsive from a width of 360 px, with no horizontal scrolling.

### 9.3 Privacy

- No third-party requests: fonts, icons, and scripts are local only, no analytics, no CDN.
- `localStorage` is used only for favorites, recent items, and the configurator selection.
- A `settings.json` pasted into the configurator is not sent anywhere. The page states this explicitly.

### 9.4 Content security

- Markdown from plugins is rendered at build time with `rehype-sanitize`: raw HTML, `<script>`, `on*` attributes, and `javascript:` links are stripped.
- A strict CSP via `<meta http-equiv="Content-Security-Policy">`: `default-src 'self'`, no `unsafe-eval`.
- `catalog.json` does not include MCP `env` values, only names. Nor does it include default values from `userConfig` with `sensitive: true`.

---

## 10. CI, deployment, testing

### 10.1 Workflow `.github/workflows/pages.yml`

- Triggers: `push` to `main` and `workflow_dispatch`. On a PR, the same workflow only builds the site and runs tests, without deploying.
- `permissions: { contents: read, pages: write, id-token: write }`, `concurrency: pages`.
- Actions are pinned to SHAs, `persist-credentials: false`, `fetch-depth: 0`.
- Steps: validate → build-catalog → tests → `astro build` → link check → upload → deploy.
- Pages in the repo settings: Source = GitHub Actions.

### 10.2 Tests

| Type | What it checks | Where |
|---|---|---|
| Unit | Component parser per the §5.1 rules, risk, contextCost, CHANGELOG and CODEOWNERS parsing | `scripts/lib/*.test.mjs`, fixtures in `scripts/fixtures/marketplace/` (several plugins with all component types, since the repo currently has only one demo plugin) |
| Unit | `normalize()`, stemmer, intent parsing, synonym expansion | `site/src/search/*.test.ts` |
| **Golden queries** | A "query → expected ids in the top 3" table: `скіл для рев'ю PR` → `…:code-review`. The build fails if even one query fails | `site/tests/search-golden.json` |
| E2E smoke | Search → card → plugin page → copy; configurator with two plugins and merging | Playwright, Chromium |
| Links | No broken internal links, accounting for `base` | link checker after the build |
| Accessibility | axe on `/`, `/plugins/<id>/`, `/configure/` | Playwright + axe |

Golden queries are the search quality contract. Each new plugin adds 1–2 queries, and this is an item in `pull_request_template.md`.

---

## 11. Repository structure

Additions to Research §5:

```text
├── scripts/
│   ├── lib/
│   │   ├── discover.mjs          # plugin component discovery (§5.1)
│   │   ├── rules.mjs             # naming and metadata rules, shared with the browser
│   │   ├── changelog.mjs
│   │   └── codeowners.mjs
│   ├── fixtures/marketplace/     # test marketplace
│   ├── build-catalog.mjs
│   └── validate-marketplace.mjs  # imports lib/
├── site/
│   ├── astro.config.mjs          # site, base from env
│   ├── package.json
│   ├── config.ts                 # thresholds, number of events, etc.
│   ├── src/
│   │   ├── generated/            # in .gitignore
│   │   ├── i18n/uk.json          # all interface strings
│   │   ├── search/               # normalize, stem, intents.json, synonyms.json, stopwords.json
│   │   ├── components/
│   │   ├── islands/              # Search, Configurator, Generator, CommandPalette
│   │   └── pages/
│   ├── public/
│   └── tests/
└── .github/workflows/pages.yml
```

---

## 12. Phases and acceptance criteria

### MVP

| ID | What | Acceptance criterion |
|---|---|---|
| M1 | `build-catalog.mjs` + `scripts/lib/` | On the fixtures, `catalog.json` matches the snapshot. A broken SKILL.md stops the build with the path to the file |
| M2 | Rules S1–S4 in the linter, updated template and guidelines | The demo plugin passes the rules, and a fixture without UA keywords fails |
| M3 | Search (F1, §6) | All golden queries pass. State is restored from the URL. Empty results offer an issue |
| M4 | Plugin page (F2) | Install snippets are copied and actually install the demo plugin on a clean profile |
| M5 | Configurator (F4) | The generated `settings.json` enables the plugins in a new project. Merging does not lose unrelated keys |
| M6 | Deployment (§10.1) | Merge to `main` → site updated within ≤ 5 min. A red validate blocks deployment |
| M7 | Non-functional requirements (§9) | Lighthouse ≥ 90 / a11y ≥ 95, axe with no critical issues, not a single third-party request in DevTools |

### v2

| ID | What | Acceptance criterion |
|---|---|---|
| V1 | Artifact pages (F3) | Every artifact in the catalog has a page. MCP pages contain no env values |
| V2 | What's new + Atom (F5) | The feed passes the W3C Feed Validator. A release appears on the site after merge |
| V3 | Documentation (F6) | Documents are in search with the `doc` type, internal links are not broken |
| V4 | Generator (F7) | The unpacked zip, without edits, passes `claude plugin validate --strict` and the linter |
| V5 | `catalog.json`, `llms.txt` (F8) | Validated against the JSON Schema in `site/public/catalog.schema.json` |
| V6 | `marketplace-finder` plugin (F8) | On 5 golden tasks, the skill suggests the correct plugin |
| V7 | ⌘K, favorites, theme (F9) | The E2E scenario passes. The page works without `localStorage` |

---

## 13. Open questions

| # | Question | Proposal | Blocks |
|---|---|---|---|
| Q1 | **Site visibility:** public Pages, Enterprise Cloud with private Pages, or other hosting with authentication | Decide before M6. If skill content cannot be shown publicly, public Pages are ruled out | M6 (deployment) |
| Q2 | ~~Marketplace name~~ | **Accepted:** `shark-plugins` | — |
| Q3 | ~~Interface language~~ | **Accepted:** UA only in v1, strings in `i18n/uk.json` | — |
| Q4 | ~~Who maintains `synonyms.json` and the golden queries~~ | **Accepted:** the marketplace owner in CODEOWNERS, contributions via PR | — |
| Q5 | ~~Custom domain~~ | **Accepted:** not needed for the MVP | — |
| Q6 | Location of `autoUpdate` in managed settings and the path to the local copy of the marketplace | Verify on the current CLI version | M5 (Managed tab), V6 |
