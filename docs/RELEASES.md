# Releases and versioning

Reference: [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace), [Plugin loading](https://code.claude.com/docs/en/plugins/loading).

## How Claude Code detects updates

A plugin's version is both the **update signal** and the name of its cache folder (`~/.claude/plugins/cache/shark-plugins/<plugin>/<version>/`). Claude Code takes it, in order, from:

1. `version` in `plugin.json`;
2. `version` in the `marketplace.json` entry;
3. if neither is set, the commit SHA.

**Our rule:** the version is set **only in `plugin.json`** and is bumped on every change to the plugin. If the version string does not change, users **do not receive** new commits, even with auto-update on. CI enforces this. The one exception is `plugins/<name>/evals/`: eval cases for `claude plugin eval` are never loaded by a session, so changing only them needs no bump.

## SemVer

| Change | Version | Examples |
|---|---|---|
| Breaks behavior or configuration | MAJOR (`1.4.2` → `2.0.0`) | removed a skill or agent, changed `userConfig` keys, changed required environment variables |
| New capability | MINOR (`1.4.2` → `1.5.0`) | new skill, agent, hook or MCP server |
| Fix | PATCH (`1.4.2` → `1.4.3`) | clarified skill instructions, fixed a script, updated the README |

- While a plugin is on `0.x`, any MINOR version may break compatibility.
- Pre-release versions (`1.5.0-beta.1`) are allowed, but a beta channel is better served by a separate marketplace (see below).

## Release flow

```text
feature branch                        pull request              main
──────────────                        ────────────              ────
edit plugins/<name>/**
describe changes under ## [Unreleased]
npm run release -- bump <name> minor  →  CI: validate,     →  merge  →  release workflow:
                                          version bump,               tag <name>--v<version>
                                          tests                       + GitHub release with
                                                                        the CHANGELOG notes
```

### 1. Bump (on the feature branch)

```bash
npm run release -- bump <plugin> <major|minor|patch|x.y.z>
```

`scripts/release.mjs bump`:

- computes the new version **from the version on `main`** (`origin/main`, or `--base <ref>`), so re-running it on the same branch never bumps twice: changing your mind from `patch` to `minor` simply recomputes;
- turns the notes under `## [Unreleased]` into a `## [x.y.z] - YYYY-MM-DD` section and leaves an empty `## [Unreleased]` on top; it refuses to bump when there are no notes;
- writes the version to `plugin.json` and the README catalog.

### 2. Tag and publish (on main, automatic)

After the merge, the `Release` workflow (`.github/workflows/release.yml`) runs:

```bash
node scripts/release.mjs tag --push --github-output
```

It creates an annotated tag `<plugin>--v<version>` for every plugin version that has no tag yet, pushes it, and creates a GitHub release with the notes from the CHANGELOG (`node scripts/release.mjs notes <plugin> <version>`).

Claude Code resolves version ranges in other plugins' `dependencies` against these tags. They are also the targets for rollbacks.

The same can be done by hand on an up-to-date `main`: `npm run release -- tag --dry-run`, then `npm run release -- tag --push`.

## CHANGELOG

Every plugin keeps a `CHANGELOG.md` in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. CI requires a section for the current version:

```markdown
## [Unreleased]

## [1.5.0] - 2026-11-02

### Added
- `release-notes` skill.

### Fixed
- …
```

## How updates reach users

- **Auto-update is off by default for `shark-plugins`**: it is on only for Anthropic's official marketplaces. Options:
  - users turn it on themselves: `/plugin` → **Marketplaces** → **Enable auto-update**;
  - an admin forces it on through managed settings (`"autoUpdate": true` in `extraKnownMarketplaces`, see [CONSUMERS.md](CONSUMERS.md#managed-settings));
  - by hand: `claude plugin marketplace update shark-plugins`, then `claude plugin update <name>@shark-plugins`.
- The update check runs after the first message of a session, with a random delay of up to 10 minutes.
- A running session keeps the old version until `/reload-plugins`.
- Old versions are removed from the cache after 14 days.

## Rollback

A rollback is a **new version (roll-forward)**: the plugin's files are restored from an earlier release and published under a new, higher version.

```bash
npm run rollback -- <plugin> --to <version> --reason "<why>" [--bump patch|minor|major]
```

`scripts/rollback.mjs`:

- restores `plugins/<plugin>/` exactly as it was at the tag `<plugin>--v<version>` (or at any git ref passed to `--to`), including deleting files added since;
- keeps the current CHANGELOG and adds a `## [x.y.z]` section with `### Reverted` and the reason;
- sets the version to the **next** version after the current one (patch by default), never the old one;
- updates the README catalog and stages the result.

Then review the staged diff, run `npm run validate`, commit and open a pull request. After the merge the release workflow tags the new version as usual.

Do not rewrite tags or bring back an old version string: a folder with that version already exists in users' caches, so Claude Code may not treat it as an update.

Use `--bump minor` or `--bump major` when the rollback itself breaks something for users of the bad version (for example, it removes a `userConfig` key they already set).

### Emergency disable

A rollback reaches users only after a merge and their next update. To stop a harmful plugin **now**, disable it for the organization through managed settings first, then roll back:

```json
{
  "enabledPlugins": { "<name>@shark-plugins": false }
}
```

`false` in managed settings blocks the plugin at every scope.

## Renaming and removing

**Renaming** breaks `enabledPlugins` and `/plugin install` for every user. So:

- to change only the label, change `displayName`;
- for a real rename, add an entry to the marketplace's `renames` map. Entries are only ever added, never changed:

  ```json
  "renames": { "old-name": "new-name" }
  ```

  Users who installed the plugin from git must run `/plugin install` once after a rename. Announce it in the CHANGELOG and the team chat.

**Removing a plugin:**

1. Remove its entry from `plugins` and the `plugins/<name>/` folder.
2. Add `"renames": { "<name>": null }`.
3. If the plugin must disappear from machines and not only from the catalog, set `"forceRemoveDeletedPlugins": true` in `marketplace.json`. Otherwise it stays installed for everyone who already has it.

Claude Code has no "deprecated" state. Warn about a removal in advance through the `description` and the CHANGELOG.

## Stable / beta channels

If a beta channel is needed, create a **separate marketplace** with a different `name` (for example `shark-plugins-beta`) pointing at a `beta` branch of this repo. Versions in the two channels must differ (`1.5.0-beta.1` vs `1.4.2`), otherwise users stay on the cached copy.

## Changes to the marketplace itself

Changes to `marketplace.json` (descriptions, categories, `renames`) need no version. Users get them with `claude plugin marketplace update` or the marketplace auto-update.
