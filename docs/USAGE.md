# How to use the marketplace

A short, task-by-task guide for the `shark-plugins` marketplace. Background and edge cases are in [CONSUMERS.md](CONSUMERS.md), and fixes for errors are in [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

- Marketplace: `korzunss/shark-software-ai-marketplace` (private repository), named **`shark-plugins`**
- Plugin id: `<plugin>@shark-plugins`
- Catalog: [README](../README.md#catalog) or the [catalog site](https://korzunss.github.io/shark-software-ai-marketplace/)

## Cheat sheet

| I want to… | Terminal | Inside a Claude Code session |
|---|---|---|
| Add the marketplace | `claude plugin marketplace add korzunss/shark-software-ai-marketplace` | `/plugin marketplace add korzunss/shark-software-ai-marketplace` |
| See what's available | — | `/plugin` → **Discover** |
| Install a plugin | `claude plugin install <plugin>@shark-plugins` | `/plugin install <plugin>@shark-plugins` |
| See what's installed | `claude plugin list` | `/plugin` → **Installed** |
| Get the latest versions | `claude plugin marketplace update shark-plugins` | `/plugin` → **Marketplaces** |
| Use the stable channel | `claude plugin marketplace add korzunss/shark-software-ai-marketplace#stable` | see [5a](#5a-switch-to-the-stable-channel-and-back) |
| Update one plugin | `claude plugin update <plugin>@shark-plugins` | then `/reload-plugins` |
| Turn a plugin off for a while | `claude plugin disable <plugin>@shark-plugins` | `/plugin` → **Installed** |
| Turn it back on | `claude plugin enable <plugin>@shark-plugins` | `/plugin` → **Installed** |
| Remove a plugin | `claude plugin uninstall <plugin>@shark-plugins` | `/plugin` → **Installed** |
| Remove the marketplace | `claude plugin marketplace remove shark-plugins` | `/plugin` → **Marketplaces** |

## 1. Prepare git access (once per machine)

The repository is private. Claude Code fetches the marketplace with your own git credentials and never asks for a password, so you need read access to the repository and git set up for it:

```bash
gh auth login
gh auth setup-git
```

No SSH key for GitHub? Also set `export CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`. Details: [CONSUMERS.md → Authentication](CONSUMERS.md#authentication).

## 2. Add the marketplace (once per machine)

```bash
claude plugin marketplace add korzunss/shark-software-ai-marketplace
claude plugin marketplace list    # shark-plugins should be listed
```

## 3. Install a plugin

```bash
claude plugin install sdd-engineering@shark-plugins
```

Dependencies are installed with it: `sdd-engineering` brings the other four plugins along.

`/plugin install …` inside a session also asks for the **scope**:

| Scope | Who gets the plugin |
|---|---|
| user (default) | You, in every project |
| project | Everyone who opens this project (written to the committed `.claude/settings.json`) |
| local | Only you, only in this project |

New plugins load in the next session. To load them in the current one, run `/reload-plugins`.

## 4. Use what a plugin provides

| Component | How you use it | Example |
|---|---|---|
| Skill | Claude picks it up when the task matches. You can also call it as `/<plugin>:<skill>` | `/sdd-engineering:run-plan "Let users export a review as Markdown"` |
| Agent | Claude delegates to it, or you ask for it by name. Listed in `/agents` | "Use the security-reviewer agent on this diff" |
| Hook, MCP server | Work on their own once the plugin is enabled | — |

Each plugin's README in [`plugins/`](../plugins/) lists its skills and agents with examples. `claude plugin details <plugin>@shark-plugins` shows the same from the terminal.

## 5. Keep plugins up to date

Auto-update is **off** for this marketplace by default. Turn it on once in `/plugin` → **Marketplaces** → `shark-plugins` → **Enable auto-update**. Or update by hand, in two separate steps:

| Step | Command | What it changes | What it doesn't change |
|---|---|---|---|
| 1. Update the catalog | `claude plugin marketplace update shark-plugins` | Your local copy of the catalog: new plugins, new versions, descriptions. It prints `Successfully updated marketplace: shark-plugins` | Installed plugins. `claude plugin list` still shows the old versions |
| 2. Update a plugin | `claude plugin update sdd-engineering@shark-plugins` | The installed plugin, to the version the catalog now offers | Plugins you didn't name |

Run step 1 first, so step 2 sees the new version. The new version loads in the next session, or after `/reload-plugins` in a running one. A plugin gets a new copy only when its `version` changes; when it is already current, the update prints `… is already at the latest version`.

What changed: each plugin's `CHANGELOG.md` and the [releases](https://github.com/korzunss/shark-software-ai-marketplace/releases).

## 5a. Switch to the stable channel and back

The marketplace has two channels in the same repository:

| Channel | Marketplace name | Source | What it serves |
|---|---|---|---|
| Latest | `shark-plugins` | `korzunss/shark-software-ai-marketplace` (the `main` branch) | Every released version, right after it merges |
| Stable | `shark-plugins-stable` | `korzunss/shark-software-ai-marketplace#stable` (the `stable` branch) | Only versions promoted after their evals passed |

Use one channel at a time: both carry plugins with the same names, so installing from both gives two copies of every skill and agent.

Switch to stable (for example, to go back to the last verified version after a bad release):

```bash
claude plugin marketplace remove shark-plugins          # also uninstalls its plugins
claude plugin marketplace add korzunss/shark-software-ai-marketplace#stable
claude plugin install sdd-engineering@shark-plugins-stable
claude plugin list                                      # sdd-engineering 1.0.0 and its dependencies, @shark-plugins-stable
```

Switch back to latest:

```bash
claude plugin marketplace remove shark-plugins-stable
claude plugin marketplace add korzunss/shark-software-ai-marketplace
claude plugin install sdd-engineering@shark-plugins
```

Removing a marketplace also deletes the saved options and data of the plugins installed from it. Restart the session (or run `/reload-plugins`) after switching. A project that commits `.claude/settings.json` (section 6) names the channel there: use `"ref": "stable"` in the source and `@shark-plugins-stable` in `enabledPlugins`. Details: [RELEASES.md → Stable channel](RELEASES.md#stable-channel).

## 6. Enable plugins for a whole project

Commit `.claude/settings.json` to the project, so teammates get the marketplace and the plugins when they trust the folder:

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

Rolling it out to every machine through managed settings: [CONSUMERS.md → Managed settings](CONSUMERS.md#managed-settings).

## 7. Add your own plugin to the marketplace

Copy `templates/plugin-template`, add an entry to `.claude-plugin/marketplace.json` and open a pull request. The step-by-step list is in [CONTRIBUTING.md → New plugin](../CONTRIBUTING.md#new-plugin).

Before you open the pull request, you can try the plugin locally without the marketplace:

```bash
claude --plugin-dir ./plugins/my-plugin
```

## Something doesn't work

Start with `/plugin` → **Errors**, then see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
