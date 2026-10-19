# Using the marketplace

For people who **use** the `shark-plugins` plugins. This is the detailed reference; for a short task-by-task guide see [USAGE.md](USAGE.md).

Reference: [Install plugins](https://code.claude.com/docs/en/plugins/install), [Manage plugins for your organization](https://code.claude.com/docs/en/plugins/org).

## Authentication

The repository is private. Claude Code has **no git token of its own**: it runs `git` non-interactively with the credentials already configured on the machine. If git would ask for a password, the operation simply fails.

**HTTPS (recommended):**

```bash
gh auth login
gh auth setup-git
```

A `GITHUB_TOKEN` or `GH_TOKEN` in the environment **does not by itself authenticate** the background update check. It only works through a credential helper, for example after `gh auth setup-git`.

**SSH:** a key without a passphrase, or one loaded into ssh-agent, with `github.com` in `known_hosts`.

**Important:** for an `owner/repo` address, Claude Code tries SSH first (`ssh -T git@github.com`) and only then HTTPS. If you have no SSH key for GitHub, set:

```bash
export CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1
```

## Personal install

```bash
claude plugin marketplace add korzunss/shark-software-ai-marketplace
claude plugin install sdd-engineering@shark-plugins
```

Inside a session, `/plugin install sdd-engineering@shark-plugins` opens a panel where you choose the scope:

| Scope | Stored in | Use it for |
|---|---|---|
| user (default) | `~/.claude/settings.json` | The plugin in all your projects |
| project | `.claude/settings.json` (committed) | The plugin for everyone in the project |
| local | `.claude/settings.local.json` | Only you, in this project |

## Enabling for a project

Commit `.claude/settings.json` to the project repository:

```json
{
  "extraKnownMarketplaces": {
    "shark-plugins": {
      "source": { "source": "github", "repo": "korzunss/shark-software-ai-marketplace" }
    }
  },
  "enabledPlugins": {
    "sdd-engineering@shark-plugins": true
  }
}
```

The same can be done with: `claude plugin marketplace add korzunss/shark-software-ai-marketplace --scope project`.

Caveats:

- `extraKnownMarketplaces` takes effect only after the user **trusts the project folder** (trust dialog).
- Our plugins use relative paths, so no separate `install` is needed. Plugins with an external source, if any appear, must be installed by hand: `claude plugin install <name>@shark-plugins --scope project`.
- Cloud sandboxes may not process `extraKnownMarketplaces` from the repo ([#78119](https://github.com/anthropics/claude-code/issues/78119)).

## Updates

Auto-update for `shark-plugins` is **off by default**. Turn it on in `/plugin` → **Marketplaces** → **Enable auto-update**. By hand:

```bash
claude plugin marketplace update shark-plugins
claude plugin update sdd-engineering@shark-plugins
```

An update applies from the next session. In the current session, run `/reload-plugins`.

If the background check cannot authenticate, `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` keeps the existing copy of the marketplace.

## Managed settings

For admins rolling the marketplace out to every machine on the team. These keys go into managed settings (MDM, a file, or server-managed):

```json
{
  "extraKnownMarketplaces": {
    "shark-plugins": {
      "source": { "source": "github", "repo": "korzunss/shark-software-ai-marketplace" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "sdd-engineering@shark-plugins": true
  }
}
```

- `autoUpdate` here turns auto-update on and locks the user's toggle.
- `enabledPlugins`: `true` force-enables a plugin, `false` blocks it at every scope. This is the emergency off switch.
- If sources are restricted with `strictKnownMarketplaces`, include `{ "source": "github", "repo": "korzunss/*" }`, `{ "source": "skills-dir" }` and the official marketplace if you need it. Matching is exact: the ref, a `.git` suffix and ssh vs https all count.
- With server-managed settings, plugin keys from files or MDM are ignored unless `managedSourcesBehavior: "merge"` is set.
- **CI agents:** pass a token with read access to this repo as `GH_TOKEN` and run `gh auth setup-git`. Set `CLAUDE_CODE_SYNC_PLUGIN_INSTALL=1` so the first turn waits for plugin installs. The default GitHub Actions `GITHUB_TOKEN` only sees its own repository.

## Windows

- Git for Windows is required, with `git` on the `PATH`.
- Known issues: mixed separators in `CLAUDE_PLUGIN_ROOT` ([#18527](https://github.com/anthropics/claude-code/issues/18527)), locating `/bin/bash` ([#18610](https://github.com/anthropics/claude-code/issues/18610)), a bare `npx` ([#58510](https://github.com/anthropics/claude-code/issues/58510)).
- If a hook fails with a strange error, check that scripts have LF line endings. `.gitattributes` guarantees them on a normal clone.
