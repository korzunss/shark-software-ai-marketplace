# site/: marketplace catalog on GitHub Pages

[![Site](https://github.com/korzunss/shark-software-ai-marketplace/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/korzunss/shark-software-ai-marketplace/actions/workflows/pages.yml)

A static site built with Vite + React. It is kept apart from the marketplace: nothing in `site/` is read by Claude Code, and the only site file outside it is `.github/workflows/pages.yml`.

```bash
cd site
npm ci
npm run dev        # catalog from ../plugins → http://localhost:5173
npm test           # catalog builder and i18n tests
npm run build      # → site/dist

# same as on Pages: BASE_PATH is needed by both build and preview
export BASE_PATH=/shark-software-ai-marketplace/
npm run build && npm run preview   # http://localhost:4173/shark-software-ai-marketplace/
```

## Where the data comes from

`npm run dev` and `npm run build` first run `scripts/build-catalog.mjs`. It reads the repository and writes:

| File | Contents |
|---|---|
| `src/generated/catalog.json` | Index for the UI and search: plugins, artifacts, search text. No HTML |
| `src/generated/content/<plugin>.json` | README, changelog and artifact docs as HTML. Loaded only when that plugin's page opens |
| `public/catalog.json` | The full catalog, published as `/catalog.json` for agents and scripts |

All three are generated and git-ignored. There is no manual reindexing: the catalog is built from the same commit as the site.

**What gets indexed:** plugins listed in `.claude-plugin/marketplace.json`, minus hidden ones. Components are discovered by Claude Code's own rules (SITE-SPEC §5.1): `skills/`, `agents/`, `commands/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`, plus the paths in `plugin.json`. Folders in `plugins/` without a marketplace entry, `templates/`, and the contents of plugins with an external `source` are not indexed. From MCP configs only environment variable **names** are taken. Markdown is rendered at build time: raw HTML is escaped and unsafe links are dropped.

**If a component cannot be parsed** (missing frontmatter, broken JSON), the build fails with the file path and the site stays on its previous version.

## UI text

Every UI string lives in one file, **`src/i18n/en.json`**, including the `<title>`, `description` and `<noscript>` of `index.html`. Components refer to strings by key only:

```jsx
import { t, tp } from '../i18n/index.js';

t('search.resultsFor', { query })   // "Results for “…”"
tp('search.count', 3)               // "3 artifacts": plural form picked by Intl.PluralRules
```

- `scripts/test/i18n.test.mjs` fails if the code asks for a key that is missing from `en.json`, or if any non-English (Cyrillic) text appears in `src/`, `scripts/`, `index.html`, `vite.config.js` or this README.
- The catalog builder writes no UI text: descriptions of hooks, MCP and LSP servers are worded by the UI from `details` using the `artifact.describe.*` templates.
- Another language is added as `<lang>.json` with the same keys.
- Plugin content (READMEs, skill descriptions) is shown as written in the repository and is not translated.

## Hiding a plugin from the site

Add its name to `catalog.config.json`:

```json
{ "hiddenPlugins": ["internal-tool"] }
```

- The plugin is removed from `catalog.json` entirely, not just from the UI. The catalog is public, so none of its content reaches the site.
- The plugin **stays installable** with `/plugin install internal-tool@shark-plugins`. Hiding affects the site only.
- If another plugin depends on a hidden one, the dependency is shown as plain text without a link. Mentions in other plugins' READMEs are not scrubbed.
- A name that is not in `marketplace.json` fails the build, so a typo cannot hide the wrong plugin.

The flag lives here rather than in `marketplace.json` or `plugin.json` because `claude plugin validate --strict` may reject unknown fields in Claude Code manifests.

## Layout

| Path | Contents |
|---|---|
| `design/` | The original mock-up (`Catalog.dc.html` + the `support.js` runtime) as delivered. Reference for the layout, not part of the build |
| `scripts/build-catalog.mjs` | Catalog builder; `scripts/lib/` holds component discovery, Markdown and CODEOWNERS |
| `scripts/test/` | Builder tests on temporary fixtures, plus the i18n checks |
| `scripts/ci-summary.mjs` | Build report for the GitHub Actions run page |
| `catalog.config.json` | Hidden plugins |
| `src/i18n/` | `en.json` with every UI string, plus `t()` / `tp()` |
| `src/data/catalog.js` | Adapts the generated catalog to the UI, loads content on demand |
| `src/lib/` | Search, hash router, clipboard |
| `src/pages/`, `src/components/` | Screens and components from the mock-up |

## Deployment and build status

The `.github/workflows/pages.yml` workflow is named **Site** and is separate from `validate.yml`, which checks the marketplace itself. In the Actions tab and in PR checks it shows up as three jobs:

| Job | What it does | When |
|---|---|---|
| **Site / Tests** | `npm test`: catalog builder and i18n | every PR and push |
| **Site / Build** | `npm run build`: catalog from `plugins/` + Vite. A report with the plugin list and bundle sizes goes to the run's Summary page | after Tests |
| **Site / Deploy** | publishes `site/dist` to GitHub Pages; the site URL is shown on the `github-pages` environment | pushes to `main` only |

- On PRs the workflow always runs, with no paths filter, so **Site / Build** can be a required check in branch protection: a path-filtered required check never reports on PRs that don't touch its paths and leaves them stuck in "Expected — Waiting".
- On `main` it runs only when `site/**`, `plugins/**`, `.claude-plugin/**` or `.github/CODEOWNERS` change. It can also be started by hand (`workflow_dispatch`).
- The badge at the top of this file shows the latest run on `main`.

One-time repository setting: **Settings → Pages → Source = GitHub Actions**.

What makes the site work on Pages:
- `base` in `vite.config.js` comes from `BASE_PATH`, which CI gets from `actions/configure-pages`;
- routes live after `#` (`#/plugins/<name>`), so reloading any page never 404s;
- fonts come from `@fontsource/*` and are bundled as files, with no requests to Google Fonts. That allows the strict CSP that `vite.config.js` adds to the built `index.html` (SITE-SPEC §9.3, §9.4). The dev server runs without it, since Vite injects CSS as inline `<style>` tags there.

## Deviations from SITE-SPEC

- The spec (§3) calls for Astro + Preact islands. This is a React SPA: there is no separate HTML page per plugin (SEO, working without JS), and the main bundle (~124 KB gzip including the index) is over the §9.1 budget (60 KB).
- The UI is in English, while the design spec plans a Ukrainian-only interface.
- Search is plain substring matching, as in the mock-up. MiniSearch, the stemmer, synonyms and intent parsing (§6) are not done yet.
- `contextCost` and `events` are not computed; there is no `llms.txt` or `feed.xml`.
- The builder lives in `site/scripts/`, not `scripts/`, and does not yet share rules with `validate-marketplace.mjs`. The only shared piece is `parseChangelog` from `scripts/lib/common.mjs`.
