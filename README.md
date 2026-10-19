# Shark Software AI Marketplace

A private team marketplace of [Claude Code](https://code.claude.com/docs/en/plugins/create-marketplace) plugins: skills, agents, hooks and MCP configurations for Shark Software projects.

- Marketplace name: **`shark-plugins`**
- Plugin id: `<plugin>@shark-plugins`

## Catalog

| Plugin | Version | What it does |
|---|---|---|
| `team-conventions` | 0.1.0 | Baseline team conventions: code style, commit messages and pull request descriptions |

## Quick start

The repository is private, so your machine needs git access first (details in [docs/CONSUMERS.md](docs/CONSUMERS.md#authentication)):

```bash
gh auth login && gh auth setup-git
```

Then add the marketplace and install a plugin:

```bash
claude plugin marketplace add korzunss/shark-software-ai-marketplace
claude plugin install team-conventions@shark-plugins
```

### Enable for a whole project team

Commit `.claude/settings.json` to the project:

```json
{
  "extraKnownMarketplaces": {
    "shark-plugins": {
      "source": { "source": "github", "repo": "korzunss/shark-software-ai-marketplace" }
    }
  },
  "enabledPlugins": {
    "team-conventions@shark-plugins": true
  }
}
```

> Auto-update is **off by default** for third-party marketplaces. Turn it on in `/plugin` → **Marketplaces** → **Enable auto-update**, or update by hand: `claude plugin marketplace update shark-plugins`.

## Repository layout

```text
.claude-plugin/marketplace.json   plugin catalog
plugins/<name>/                   plugins (one folder per plugin)
templates/plugin-template/        starting point for a new plugin (not in the catalog)
docs/                             rules for authors and consumers
scripts/validate-marketplace.mjs  structural linter (Node, no dependencies)
scripts/release.mjs               version bump, tags, release notes
scripts/rollback.mjs              roll a plugin back to an earlier release
scripts/test/                     tests for the scripts (node --test)
.github/                          CI, release workflow, CODEOWNERS, PR and issue templates
```

## Documentation

| Document | Audience |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Adding or changing a plugin |
| [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md) | Plugin layout, names, paths, variables |
| [docs/SECURITY.md](docs/SECURITY.md) | Hooks, MCP, scripts, secrets, review |
| [docs/RELEASES.md](docs/RELEASES.md) | Versioning, releases, rollback, renames |
| [docs/CONSUMERS.md](docs/CONSUMERS.md) | Adding the marketplace, authentication, managed settings |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | A plugin does not install or load |
| [docs/temp/MARKETPLACE-RESEARCH.md](docs/temp/MARKETPLACE-RESEARCH.md) | The research this repository is based on |

## Commands

```bash
npm run validate                                   # linter + official validator (needs the claude CLI)
npm test                                           # tests for the release/rollback scripts
npm run release -- bump <plugin> <major|minor|patch>
npm run rollback -- <plugin> --to <version> --reason "<why>"
```

There are no dependencies to install: `npm` is only used as a command runner.
