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

## Stable channel

Claude Code has no release-channel concept: one marketplace serves one version of each plugin. A channel is therefore a **second marketplace**, with its own `name`, on another branch of this repo ([Run release channels](https://code.claude.com/docs/en/plugins/host-marketplace#run-release-channels)).

| Channel | Marketplace `name` | Branch | Add with | Receives |
|---|---|---|---|---|
| Latest | `shark-plugins` | `main` | `korzunss/shark-software-ai-marketplace` | every release, right after the merge |
| Stable | `shark-plugins-stable` | `stable` | `korzunss/shark-software-ai-marketplace#stable` | only versions promoted after their evals passed |

The `stable` branch is a copy of the plugin trees at verified release tags. It differs from `main` only in the marketplace `name` and `description`, its README banner, and which plugin versions it holds. It started at `main` 4d1f1a2, where every plugin is 1.0.0.

- The names must differ: Claude Code identifies a marketplace by its `name`, so a user can't register two with the same name.
- `#stable` pins the marketplace to the branch. `claude plugin marketplace update shark-plugins-stable` follows the latest commit of `stable`, not `main`.
- Plugins are cached per marketplace (`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`), so `sdd-engineering` 1.0.0 from stable never collides with any copy from `shark-plugins`.
- Users should install from one channel at a time: both carry the same plugin names, so two installs give two copies of every skill and agent. Switching is in [USAGE.md → 5a](USAGE.md#5a-switch-to-the-stable-channel-and-back).

### Dependencies on the stable channel

The root plugin a user installs (for example `sdd-engineering`) comes from the `stable` branch tree. Its **dependencies** are resolved like on any channel: a range such as `^1.0.0` installs the **highest `<plugin>--v<version>` tag** in the repository that satisfies it ([How a constraint resolves against tags](https://code.claude.com/docs/en/plugins/dependencies#how-a-constraint-resolves-against-tags)). Tags are repository-wide, not per branch, so once `architecture-review--v1.1.0` is released on `main`, stable's `sdd-engineering` 1.0.0 also gets `architecture-review` 1.1.0. That is a released, CI-checked version inside the range the plugin declared, which is what SemVer promises; `claude plugin list` shows it as `1.1.0-<sha>`.

To hold a dependency at an exact version on stable, tighten the range in the stable copy of the dependent plugin's `plugin.json` (`"version": "=1.0.0"`). A range in a marketplace entry does not override `plugin.json`. Do this only on purpose: it makes the stable `plugin.json` differ from the tagged release.

### Promote a version to stable

Promote only a version that has a release tag on `main` and whose evals passed (see the plugin's `evals/README.md`):

```bash
git switch stable && git pull
git rm -r --quiet plugins/<plugin>
git checkout <plugin>--v<version> -- plugins/<plugin>    # the tree exactly as released
# README.md: set the plugin's Version cell in the catalog table to <version>
claude plugin validate . --strict && npm test
git commit -am "chore(stable): promote <plugin> <version>"
# open a pull request into stable; after the merge users get it with
# `claude plugin marketplace update shark-plugins-stable` + `claude plugin update <plugin>@shark-plugins-stable`
```

A promotion always moves a plugin forward. To take a bad version off stable, promote the previous good tag's contents under a new version through the normal [rollback](#rollback) on `main`, then promote that.

The Release and Site workflows run only on `main`, so the `stable` branch creates no tags and doesn't deploy the catalog site. The Validate workflow runs on pull requests into `stable` as on any other base.

### A beta channel

A beta channel works the same way: a marketplace named `shark-plugins-beta` on a `beta` branch. Its versions must differ from the other channels' (`1.5.0-beta.1` vs `1.4.2`), otherwise users stay on the cached copy, and dependency ranges match a pre-release only when they opt in (`^1.5.0-0`).

## Changes to the marketplace itself

Changes to `marketplace.json` (descriptions, categories, `renames`) need no version. Users get them with `claude plugin marketplace update` or the marketplace auto-update.
