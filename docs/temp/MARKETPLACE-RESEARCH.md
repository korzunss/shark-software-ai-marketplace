# Marketplace Research: Claude Code plugin marketplace

Research for the `shark-software-ai-marketplace` repository. It collects:

1. The official Claude Code documentation on plugin marketplaces.
2. Practices and pitfalls from open sources: Anthropic repositories, community marketplaces, `anthropics/claude-code` issues.
3. An analysis of the structure proposed in the course.
4. Conclusions and the target repository structure, with explanations.

> As of October 2026, verified on Claude Code **2.1.301**. Some fields only work starting from specific CLI versions (marked below). The marker **[unverified]** means the statement is not confirmed by the official documentation or by my own check.

---

## Contents

- [0. Sources](#0-sources)
- [1. Official documentation](#1-official-documentation)
  - [1.1 Directory structure](#11-directory-structure)
  - [1.2 marketplace.json](#12-marketplacejson)
  - [1.3 Reserved names and naming rules](#13-reserved-names-and-naming-rules)
  - [1.4 Plugin entries in plugins](#14-plugin-entries-in-plugins)
  - [1.5 Strict mode and component overrides](#15-strict-mode-and-component-overrides)
  - [1.6 Plugin source types](#16-plugin-source-types)
  - [1.7 plugin.json](#17-pluginjson)
  - [1.8 Variables and copying to the cache](#18-variables-and-copying-to-the-cache)
  - [1.9 Installation, scopes, team setup](#19-installation-scopes-team-setup)
  - [1.10 Enterprise / managed settings](#110-enterprise--managed-settings)
  - [1.11 Auto-update](#111-auto-update)
  - [1.12 Validation, local testing, debugging](#112-validation-local-testing-debugging)
  - [1.13 Private repositories and authentication](#113-private-repositories-and-authentication)
  - [1.14 Versioning and update detection](#114-versioning-and-update-detection)
  - [1.15 Caveats from the documentation](#115-caveats-from-the-documentation)
- [2. Open sources and best practices](#2-open-sources-and-best-practices)
  - [2.1 How well-known marketplaces are organized](#21-how-well-known-marketplaces-are-organized)
  - [2.2 CI lessons from Anthropic repositories](#22-ci-lessons-from-anthropic-repositories)
  - [2.3 Pitfalls from issues](#23-pitfalls-from-issues)
  - [2.4 Recommendations for a team marketplace](#24-recommendations-for-a-team-marketplace)
- [3. Analysis of the course structure](#3-analysis-of-the-course-structure)
- [4. Conclusions and decisions](#4-conclusions-and-decisions)
- [5. Target repository structure](#5-target-repository-structure)
- [6. Linter and CI](#6-linter-and-ci)
- [7. Open questions](#7-open-questions)

---

## 0. Sources

### Official documentation (code.claude.com)

- Create a marketplace: https://code.claude.com/docs/en/plugins/create-marketplace
- Marketplace reference: https://code.claude.com/docs/en/plugins/marketplace-reference
- Plugin manifest reference: https://code.claude.com/docs/en/plugins/manifest-reference
- Host and maintain a marketplace: https://code.claude.com/docs/en/plugins/host-marketplace
- Install and manage plugins: https://code.claude.com/docs/en/plugins/install
- Plugin loading reference: https://code.claude.com/docs/en/plugins/loading
- Plugin commands (CLI) reference: https://code.claude.com/docs/en/plugins/cli-reference
- Manage plugins for your organization: https://code.claude.com/docs/en/plugins/org
- Components: https://code.claude.com/docs/en/plugins/components
- Troubleshooting: https://code.claude.com/docs/en/plugins/troubleshooting
- Security: https://code.claude.com/docs/en/plugins/security

### Reference repositories

- `anthropics/claude-plugins-official`: https://github.com/anthropics/claude-plugins-official
- `anthropics/claude-plugins-community`, in particular the reusable action `validate-plugins`: https://github.com/anthropics/claude-plugins-community/blob/main/.github/actions/validate-plugins/README.md
- `anthropics/claude-code`, the `plugins/` directory: https://github.com/anthropics/claude-code/tree/main/plugins
- `anthropics/skills`: https://github.com/anthropics/skills
- `trailofbits/skills-curated`: https://github.com/trailofbits/skills-curated
- `wshobson/agents`: https://github.com/wshobson/agents
- `obra/superpowers-marketplace`: https://github.com/obra/superpowers-marketplace
- `Piebald-AI/claude-code-lsps`: https://github.com/Piebald-AI/claude-code-lsps

### Articles

- Thoughtworks Radar: https://www.thoughtworks.com/radar/tools/claude-code-plugin-marketplace
- DEFRA AI toolkit: https://digital.defra.gov.uk/ai-toolkit/tools/claude-code-marketplace
- https://www.developersdigest.tech/blog/claude-code-plugins-for-teams-2026
- https://gautamkhorana.com/blog/claude-code-plugins-private-marketplace/

---

## 1. Official documentation

### 1.1 Directory structure

A marketplace is a directory or git repository with `.claude-plugin/marketplace.json` at its root. Relative plugin `source` paths are resolved **from the marketplace root** (the directory that contains `.claude-plugin/`), not from `.claude-plugin/` itself.

```text
my-marketplace/
├── .claude-plugin/
│   └── marketplace.json
└── plugins/
    └── my-first-plugin/
        ├── .claude-plugin/
        │   └── plugin.json      # optional manifest
        ├── skills/<name>/SKILL.md
        ├── commands/*.md         # legacy format, the docs recommend skills/
        ├── agents/*.md
        ├── hooks/hooks.json
        ├── monitors/monitors.json
        ├── output-styles/
        ├── themes/
        ├── workflows/
        ├── bin/                  # executables, added to PATH for Bash
        ├── settings.json         # only agent / subagentStatusLine take effect
        ├── .mcp.json
        └── .lsp.json
```

Rules:

- A plugin's `.claude-plugin/` contains **only** `plugin.json`. Everything else goes in the plugin root.
- A plugin without a manifest still loads using the default structure. Its name is then taken from the marketplace entry.
- `CLAUDE.md` in the plugin root is **not loaded**. Instructions must be packaged as a skill.

### 1.2 marketplace.json

Required fields: `name`, `owner` (with `owner.name`), `plugins`.

```json
{
  "name": "my-marketplace",
  "description": "Plugins for my team",
  "owner": {
    "name": "Your Name"
  },
  "plugins": [
    {
      "name": "my-first-plugin",
      "source": "./plugins/my-first-plugin",
      "description": "A greeting plugin to learn the basics"
    }
  ]
}
```

| Field | Description |
|---|---|
| `name` | Required. Letters, digits, `.`, `_`, `-`. Starts with a letter or digit, no `..`. It is the part of the install identifier after `@`. |
| `owner` | Required object. `name` is required, `email` and `url` are not. |
| `plugins` | Required array. Each entry is validated separately, so one broken entry does not break the whole marketplace. |
| `$schema` | Only for editor autocompletion, ignored at load time. Schema: `https://json.schemastore.org/claude-code-marketplace.json`. |
| `description` | Shown to users. If the field is missing, `validate` warns. `metadata.description` also works. |
| `version` | Version of the marketplace manifest. `metadata.version` also works. |
| `metadata.pluginRoot` | Lets you write bare names in `source`, e.g. `"pluginRoot": "./plugins"` turns `"source": "formatter"` into `./plugins/formatter`. Requires v2.1.239+. Paths that contain `/` must still start with `./`. |
| `forceRemoveDeletedPlugins` | `true` removes plugins from users' machines once they are no longer in `plugins`. |
| `allowCrossMarketplaceDependenciesOn` | Array of marketplaces whose plugins may be installed as dependencies. |
| `renames` | Map of "old name → new name", or `null` if the plugin was removed. Entries are only appended; old ones are not changed. |

> ⚠ **Unknown keys are silently ignored at load time.** `claude plugin validate` reports them only as warnings, so a typo in a field name can go unnoticed.

### 1.3 Reserved names and naming rules

**Reserved marketplace names.** This is a non-exhaustive list that I copied from the documentation.

- **Official** (allowed only for sources from `github.com/anthropics/`): `claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`, `agent-skills`, `anthropic-agent-skills`, `life-sciences`, `knowledge-work-plugins`, `claude-for-legal`, `claude-for-financial-services`, `financial-services-plugins`, `first-party-plugins`, `claude-tag-plugins`.
- **Community:** `claude-community`, `claude-plugins-community`, `healthcare`.
- **Directory:** `anthropic-plugin-directory`, `claude-plugin-directory`.
- **Internal:** `inline`, `builtin`, `skills-dir`, `synced`, `claude-plugin-test`.
- `npm`, `pip`, `uv`, `cargo`, `github`, `gh` in any case.
- Anything starting with `claudeai-`.
- Names that imitate official ones (`official-claude-plugins`, `claude-plugins-v2`), any non-ASCII names, variants such as `claude.code.plugins`.
- JS object member names: `constructor`, `toString`, etc.

> ⚠ Reserved names are checked at `marketplace add`, **not at `validate`**. A reserved name can pass validation and then fail when the marketplace is added.

**Plugin names** follow the same character rules. In addition, a plugin name cannot:

- start with `claude-`, `anthropic-`, `anthropics-`, `cc-plugin-`;
- equal `claude`, `anthropic`, `claude-code`, `claude-mods`.

Such names are rejected by `plugin init` and `plugin tag`.

### 1.4 Plugin entries in plugins

Required fields: `name` and `source`. An entry also accepts all `plugin.json` fields.

| Field | Description |
|---|---|
| `name` | The install identifier before `@`. This is what the user types, even if `plugin.json` has a different name. The names must **match** (see 1.15). |
| `source` | A string (relative path) or an object (see 1.6). |
| `description`, `version`, `author`, `homepage`, `repository`, `license`, `keywords` | Display and version fields. For display, values from the entry take precedence over `plugin.json`. |
| `displayName` | Name in the UI. Falls back to `name` if not set. |
| `category`, `tags` | Free-form catalog organization. |
| `strict` | Defaults to `true` (see 1.5). |
| `defaultEnabled` | Defaults to `true`. Overrides the value from `plugin.json`. |
| `dependencies` | Strings (`"name"` or `"name@marketplace"`) or objects. |
| `relevance` | Signals Claude Code uses to suggest the plugin. |
| `metadata` | Arbitrary data, ignored by Claude Code. Requires v2.1.222+. |
| `headers`, `headersHelper` | Only for `archive` sources. `headersHelper` requires `"strict": false`. |

### 1.5 Strict mode and component overrides

Components that can be set in an entry: `commands`, `agents`, `skills`, `hooks`, `outputStyles`, `themes`.

| `strict` | `plugin.json` exists | Entry sets components | Result |
|---|---|---|---|
| any | no | anything | The entry itself is the manifest |
| `true` (default) | yes | anything | Components from the entry are **added** to `plugin.json`. `hooks` from the entry **replace** the manifest's hooks for the same events. |
| `false` | yes | no | `plugin.json` is the manifest |
| `false` | yes | yes | Error: `Plugin <name> has conflicting manifests: both plugin.json and marketplace entry specify components` |

Nuances:

- **`hooks` in an entry** must be an **inline object**. A file path or an array passes validation but never runs, and the plugin shows `not yet supported in a marketplace entry`. File-based hooks go in `hooks/hooks.json` or `plugin.json`.
- **`mcpServers`, `lspServers`, `userConfig` and `channels` in an entry** take effect **only if there is no `plugin.json`**. If a manifest exists, these fields are declared in it.

### 1.6 Plugin source types

| Type | Example | Notes |
|---|---|---|
| Relative path | `"./plugins/my-first-plugin"` | Starts with `./`, no `..`, forward slashes only (a backslash is rejected on macOS/Linux). Does not work in a marketplace that is only reachable via a URL to a file. |
| `github` | `{"source":"github","repo":"owner/repo","ref":"v2.0.0","sha":"<40 chars>"}` | `ref` is a branch or tag, `sha` is a full commit. If both are set, `sha` wins. |
| `url` | `{"source":"url","url":"https://gitlab.example.com/g/formatter.git","ref":"main"}` | Any git URL: `https://`, `http://`, `file://`, `git@`. The `owner/repo` shorthand is not supported. |
| `git-subdir` | `{"source":"git-subdir","url":"https://github.com/your-org/monorepo.git","path":"tools/formatter"}` | Sparse checkout of a single directory. Supports `ref`/`sha`. `url` may be in `owner/repo` form. |
| `npm` | `{"source":"npm","package":"@your-org/formatter","version":"^2.0.0","registry":"https://npm.example.com"}` | Install scripts never run. Git addresses and `file:` are rejected. |
| `archive` | `{"source":"archive","url":"https://artifacts.example.com/formatter-2.0.0.zip","sha256":"<64 hex>"}` | HTTPS only, requires v2.1.224+. There are zip archive limits (256 MiB download, 100k files, etc.). |
| `command` | `{"source":"command","command":"my-tool claude-plugin-path","timeout":120,"mode":"copy"}` | Runs a command on the user's machine that prints the absolute path to the plugin directory. Requires v2.1.229+. The user must approve the command. An administrator can forbid it via `disableCommandPluginSources`. |

**Marketplace sources** are a separate concept. They are used in `marketplace add`, `extraKnownMarketplaces` and allow/block lists. Types: `github`, `git`, `url` (a direct link to `marketplace.json`), `npm` (not implemented for `extraKnownMarketplaces`), `file`, `directory`, `settings` (inline catalog). Only policies use `hostPattern`, `pathPattern`, `skills-dir`, `owner/*`.

### 1.7 plugin.json

The manifest is optional, and if present, only `name` is required in it. All paths start with `./`. Exceptions: `skills` (also accepts `"."`) and `mcpServers` (also accepts an `https://` bundle URL).

```json
{
  "name": "deploy-tools",
  "displayName": "Deploy Tools",
  "version": "1.2.0",
  "description": "Deployment commands, a review agent, and a status monitor",
  "author": { "name": "Example Team", "email": "dev@example.com", "url": "https://example.com" },
  "homepage": "https://example.com/docs/deploy-tools",
  "repository": "https://github.com/example/deploy-tools",
  "license": "MIT",
  "keywords": ["deployment", "ci"],
  "skills": ["./extra-skills/"],
  "commands": {
    "status": { "source": "./commands/status.md", "description": "Show the current deployment status" }
  },
  "agents": ["./agents/reviewer.md"],
  "hooks": "./config/extra-hooks.json",
  "mcpServers": {
    "deploy-api": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"] }
  },
  "userConfig": {
    "api_token": {
      "type": "string",
      "title": "API token",
      "description": "Token for the deployment API",
      "sensitive": true
    }
  }
}
```

**Fields:**

- `name` (required), `displayName`, `version`, `description`;
- `author` (object, `name` required), `homepage` (must be a valid URL), `repository`, `license` (SPDX), `keywords`, `metadata`;
- `defaultEnabled`, `dependencies`, `settings` (only `agent` and `subagentStatusLine` take effect), `userConfig`, `channels`;
- components: `skills`, `commands`, `agents`, `hooks`, `mcpServers`, `lspServers`, `outputStyles`, `workflows`;
- `experimental` (`themes`, `monitors`, `evals`);
- catalog fields that Claude Code ignores at load time: `icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl`, `termsOfServiceUrl`.

**Name:** non-empty, no spaces, `@`, `:`, slashes or control characters, in kebab-case. Components are prefixed with the plugin name: the agent `reviewer` from the plugin `deploy-tools` becomes `deploy-tools:reviewer`.

**How component keys interact with the default directories:**

- **Replace the default directory:** `commands`, `agents`, `outputStyles`, `workflows`, `themes`, `monitors`. If the key is set, the default directory is no longer scanned. To keep it, list it explicitly: `"commands": ["./commands/", "./extras/"]`.
- **Add to the default:** `skills`.
- **Merge with the default file:** `hooks`, `mcpServers`, `lspServers`.

**Path restrictions:** every component path must exist and lie inside the plugin. `..` and symlinks pointing outside the plugin are rejected. The exception is symlinks between plugins of the same marketplace, which are resolved into real files when copied to the cache.

### 1.8 Variables and copying to the cache

| Variable | Value | Used for |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | Absolute path to the installed version: `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` | Scripts and binaries from the plugin. **Changes with every version**, so do not store state here. |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/<id>/`, persists across updates | Installed dependencies, caches, generated files. By default it is deleted when the plugin is removed from its last scope. |
| `${CLAUDE_PROJECT_DIR}` | Project root | Project-local scripts and configs. |

- **Where they are substituted:** `command`/`args` in hooks, `command`/`args`/`env` in MCP, LSP fields, skill/agent/command text in Markdown.
- **Where they are not substituted:** in Bash commands that Claude runs.
- **Quoting:** in the shell form of hooks, the variable must be quoted: `"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/format.sh"`. The exec form (`args`) avoids quoting problems.

**Copying.** On install, a plugin from a marketplace is **copied to the cache**. Files outside the plugin directory are not copied, so `../shared` will not work after installation. Exceptions are plugins loaded in place: `--plugin-dir` and relative plugins from a marketplace added from a local path.

### 1.9 Installation, scopes, team setup

```bash
claude plugin marketplace add your-org/your-marketplace              # GitHub owner/repo
claude plugin marketplace add your-org/plugins#v1.2.0                # pin a tag or branch
claude plugin marketplace add https://gitlab.example.com/g/plugins.git
claude plugin marketplace add https://example.com/marketplace.json   # hosted catalog
claude plugin marketplace add ./my-marketplace                       # local; ./ is required
claude plugin marketplace add your-org/your-marketplace --scope project

claude plugin install my-first-plugin@my-marketplace
claude plugin install formatter@your-org --scope project
claude plugin install deploy-helper --marketplace your-org/plugins   # add + install in one step (v2.1.292+)
```

- In a session, `/plugin install name@marketplace` opens a panel with details and a scope choice instead of installing the plugin right away.
- **Scopes:**
  - **user** (default) — `~/.claude/settings.json`;
  - **project** — `.claude/settings.json`, committed to the repo;
  - **local** — `.claude/settings.local.json`.
- **Updates:** `/plugin marketplace update <name>`, `claude plugin marketplace update [name]`, `claude plugin update <plugin>@<marketplace>`.
- Removing a marketplace removes both its plugins and their entries in `enabledPlugins`.

**Team setup:** working repositories commit `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "your-marketplace": {
      "source": { "source": "github", "repo": "your-org/your-marketplace" }
    }
  },
  "enabledPlugins": {
    "code-formatter@your-marketplace": true
  }
}
```

Limitations of this setup:

- `extraKnownMarketplaces` only works in directories the user **trusts** (trust dialog).
- Plugins with an **external** `source` are not pulled in automatically from repo settings. Each member has to run `claude plugin install <name>@<marketplace> --scope project`. Relative plugins do not need this step.
- If a plugin is enabled but not installed, the message `Plugin "<name>" is enabled in project settings but isn't installed here` appears.

### 1.10 Enterprise / managed settings

- **`extraKnownMarketplaces`** registers the marketplace on every machine. An `autoUpdate: true|false` value here locks the user's toggle in `/plugin`.
- **`enabledPlugins`:** `true` force-enables a plugin, `false` blocks it across all scopes.
- **`strictKnownMarketplaces`** (alias `allowedMarketplaces`) — an allowlist of sources. `[]` blocks everything. Example entries:
  - `{"source":"github","repo":"your-org/*"}`
  - `{"source":"hostPattern","hostPattern":"^git\\.example\\.com$"}`
  - `{"source":"pathPattern","pathPattern":"^/opt/approved/"}`
  - `{"source":"skills-dir"}`
- **`blockedMarketplaces`** accepts the same entry forms and is checked first.
- **`disableSideloadFlags`** forbids `--plugin-dir`, `--plugin-url` and similar flags.
- **`pluginSuggestionMarketplaces`** determines whose `relevance` suggestions may be shown.
- **`DISABLE_AUTOUPDATER=1`** in managed `env` disables plugin auto-update. Combined with `FORCE_AUTOUPDATE_PLUGINS=1`, plugins update but Claude Code itself does not.
- Allowlist matching is **exact**: ref, the `.git` suffix, ssh vs https — everything matters. Prefer `owner/*` or `hostPattern`.
- With server-managed settings, plugin keys from files or MDM are ignored unless `managedSourcesBehavior: "merge"` is set.

### 1.11 Auto-update

- **Enabled by default only for official marketplaces.** For all others, including ours, it is **disabled**. There is no field in `marketplace.json` to enable it.
- A user enables it in `/plugin` → **Marketplaces** → **Enable auto-update**, an administrator via `autoUpdate` in managed `extraKnownMarketplaces`.
- The update check runs after the first message in an interactive session, with a random delay of up to 10 minutes.
- A running session keeps the old versions until `/reload-plugins`.
- Old version directories in the cache are deleted 14 days after an update.

### 1.12 Validation, local testing, debugging

```bash
claude plugin validate ./my-marketplace                    # marketplace root or marketplace.json
claude plugin validate ./my-marketplace/plugins/my-plugin
claude plugin validate ./my-plugin --strict                # warnings → errors (for CI)
claude plugin validate ./my-plugin --json                  # machine-readable report
```

- **Exit codes:** `0` — passed (including with warnings), `1` — error, `2` — the validator itself failed.
- If a directory contains both `marketplace.json` and `plugin.json`, both are validated (v2.1.289+).
- In a session, `/plugin validate <path>` prints the same report.
- **Validation does NOT check:**
  - `..` in a path to a directory that does not exist (it fails only at install time);
  - remote `github`/`url` sources (they are downloaded only at install time);
  - hooks specified in an entry as a file path (the plugin fails at load time);
  - reserved marketplace names.

**Local testing loop:**

1. Put the plugin in `my-marketplace/plugins/`.
2. Run `validate`, then `claude plugin marketplace add ./my-marketplace`.
3. `claude plugin install my-first-plugin@my-marketplace`.
4. Check with `claude plugin list` and `claude plugin details <name>`.
5. Edit the files. A local marketplace with relative paths picks up changes in the next session or after `/reload-plugins`; no version bump is needed.
6. Start over: `claude plugin marketplace remove my-marketplace`.

**Debugging:**

- `claude --debug` writes a log to `~/.claude/debug/`.
- The **Errors** tab in `/plugin`.
- `claude plugin list`, `claude plugin details <name>`.
- `claude -p --output-format stream-json --verbose`: the `init` event contains the list of loaded plugins.
- State is stored in `~/.claude/plugins/` (`known_marketplaces.json`, `installed_plugins.json`, `cache/`, `marketplaces/`).

### 1.13 Private repositories and authentication

- **Claude Code has no git token of its own**, and `marketplace.json` has no field for a token. Claude Code runs `git` non-interactively with whatever credentials already exist on the machine.
- **HTTPS:** credential helpers work — `gh auth login` + `gh auth setup-git`, macOS Keychain, `git-credential-store`. Password prompts are disabled, so an unauthenticated host simply fails.
- **SSH:** a key without a passphrase (or via ssh-agent), and the host must be in `known_hosts`.
- **The `owner/repo` shorthand** first tries `ssh -T git@github.com`: if it succeeds, it uses SSH, otherwise HTTPS. The variable `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` skips this check.
- **`GITHUB_TOKEN` / `GH_TOKEN` in the environment does NOT by itself authenticate the background update check.** The token only works via a credential helper (e.g. `gh`, which reads these variables).
- **CI:** export a token with read access as `GH_TOKEN` and run `gh auth setup-git`. The default GitHub Actions token only has access to its own repository.
- For people without an account on the git host: `archive` with `sha256`, public `url`/`git-subdir`, or a `directory` marketplace on a shared drive.
- `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` keeps the existing copy if the background check failed to authenticate.
- **Organization sync via claude.ai** (Team/Enterprise) uses the organization's GitHub/GitLab connection, not users' credentials. It requires a private or internal repository on github.com or gitlab.com.

### 1.14 Versioning and update detection

Version resolution order (for all types except `command`):

1. `version` in `plugin.json`.
2. `version` in the marketplace entry. If both are set, `plugin.json` wins and `validate` warns.
3. If there is no version anywhere, it is computed from the source:
   - `github`, `url`, `git-subdir` — the first 12 characters of the commit SHA;
   - `archive` — the first 12 characters of the sha256;
   - a relative path in a git marketplace — the commit SHA of the corresponding directory;
   - a local directory outside git and `npm` — `unknown`, meaning updates are not detected.

The computed version is the **update signal** and also the directory name in the cache. Therefore:

- **If `version` is pinned**, users stay on the cached copy until the version string changes, even after new commits.
- **If there is no `version` anywhere**, every new commit becomes a new version.
- **stable/beta channels** are two marketplaces with different `ref`s. Their version strings must differ (or no version is set), otherwise a ref that moved without a version change leaves users on the cache.
- Version ranges in `dependencies` are resolved against git tags of the form `<plugin>--v<version>`.

### 1.15 Caveats from the documentation

- **The name in the entry must match the name in `plugin.json`.** Otherwise installing by the manifest name fails with `Plugin "<manifest-name>" not found in marketplace`.
- **Relative paths do not work in a marketplace that is only reachable via a URL to a file**, because only `marketplace.json` is downloaded.
- **Paths are resolved from the marketplace root.** `..` in `source` fails validation.
- **Unknown keys are silently ignored.**
- **The version must either be bumped or not set at all.** New commits without a change to a pinned version do not reach users.
- **Do not set `version` in both places.**
- **`hooks` in an entry** — inline object only.
- **`mcpServers` and `lspServers` in an entry** only take effect without `plugin.json`.
- **Renaming** breaks `enabledPlugins` and `/plugin install` for everyone. Use `displayName` to change the label and `renames` for a real rename. Users who installed the plugin from git or a URL need to run `/plugin install` once after a rename.
- **Removing a plugin from `plugins`** does not remove it from users' machines unless `forceRemoveDeletedPlugins: true` is set.
- **There is no deprecated status and no audience segmentation.** Everyone sees the whole catalog. Different audiences need separate marketplaces.
- **Git LFS:** cloning does not download LFS content; files arrive as pointer files.
- **Symlinks** pointing outside the marketplace are skipped during copying; symlinks inside the marketplace are resolved into real files.
- **Reserved names** are checked at `add`, not at `validate`.
- **Command sources** are re-run once per session, and the user has to approve a changed command. The regular auto-update pass does not update them.
- **Background auto-update from a private repo** can silently fail if the credential helper wants interactive input. The existing copy then stays in place.

---

## 2. Open sources and best practices

### 2.1 How well-known marketplaces are organized

**`anthropics/claude-plugins-official`**

- **Structure:** `.claude-plugin/marketplace.json`, `plugins/` (Anthropic plugins), `external_plugins/` (partners and community), `.github/`, `LICENSE` (Apache-2.0), `README.md`. There is no CONTRIBUTING file: external submissions go through a form, and PRs from forks are closed automatically.
- **Sources:** of ~315 entries, 164 are of type `url`, 98 are `git-subdir`, 53 are relative paths. External entries are pinned via `ref` + a 40-character `sha`.
- **Renaming:** `renames` is used. The README states explicitly that `name` is an immutable slug and `displayName` is for changing the label.
- **CI:**
  - `validate-plugins.yml` (required check);
  - `validate-frontmatter.yml` (SKILL.md, agents, commands);
  - `validate-licenses.yml`;
  - `scan-plugins.yml` (policy scan of changed entries using Claude, with a verdict cache);
  - `check-mcp-urls.yml` (nightly check that MCP URLs are alive);
  - `bump-plugin-shas.yml` (nightly update of external plugin SHAs, one PR per plugin);
  - `close-external-prs.yml`.

**`anthropics/claude-plugins-community` — reusable action `validate-plugins`**

- Built to be plugged into any marketplace. It installs a fresh `@anthropic-ai/claude-code` and uses `claude plugin validate` as the schema check, so there is no need to keep a JSON Schema in the repo.
- **Additional rules I1–I11:**
  - alphabetical sorting;
  - no duplicates;
  - description between 10 and 2000 characters;
  - https only;
  - mandatory SHA pin for external entries;
  - the vendored path exists and contains `plugin.json`;
  - no shell metacharacters;
  - etc.
- Parses `.mcp.json`, `hooks/hooks.json`, `.lsp.json` as JSON. Has a nightly "drift" mode for deleted or force-pushed upstream repositories.
- The README recommends pinning the action to a SHA and `claude-cli-version` to a specific version rather than `latest`.

**`anthropics/claude-code`:** a monorepo `plugins/<name>/` with relative paths and `$schema: https://json.schemastore.org/claude-code-marketplace.json`.

**`anthropics/skills`:** a skills-only marketplace. Each entry has `"source": "./"`, `"strict": false` and a `skills` array, with no `plugin.json`. The root contains `skills/`, `spec/`, **`template/`** and `THIRD_PARTY_NOTICES.md`.

**`trailofbits/skills-curated`**

- A security-reviewed allowlist. Quote from the README: *"Published skills have been found with backdoors and malicious hooks… we read every line of hooks and scripts."*
- CODEOWNERS with an owner for each plugin, pre-commit hooks, `validate.yml`, `lint.yml`, `security-scan.yml` (only for changed `plugins/*` or by label).
- Actions pinned to SHAs with `persist-credentials: false`.
- A separate list of allowed third-party marketplaces is maintained.

**`wshobson/agents`** (~41k stars): a monorepo with 94 plugins in `plugins/`, plus AGENTS.md, ARCHITECTURE.md, CONTRIBUTING, LICENSE, Makefile, `evals/`. `validate.yml` parses the JSON of all manifests and hooks and checks that every `./plugins/*` exists and has a `plugin.json`.

**`obra/superpowers-marketplace`:** catalog only (marketplace.json, README, LICENSE). Each plugin lives in its own repo and is referenced as a `url` source, with the version set in the entry.

**`Piebald-AI/claude-code-lsps`:** flat structure, one directory per plugin at the root.

**Two approaches to structure:**

1. **Monorepo with relative paths.** The simplest option: the version can be taken from the SHA, and project scope works without a separate `install`.
2. **Catalog plus external repos** (`github`/`url`/`git-subdir` with `sha`). Fits when plugins have different owners and release cycles. Downsides: the project `.claude/settings.json` does not install them by itself, and before installation `/plugin` shows only the fields from the entry.

None of the reference repositories formally maintains a **changelog** **[did not check every repository]**. Anthropic relies on nightly SHA-bump PRs; wshobson and obra keep SemVer in the entry or the manifest.

### 2.2 CI lessons from Anthropic repositories

From the comments in `validate-plugins.yml`:

- **A required check with a path filter** does not report on PRs that do not touch those paths, and such PRs hang forever in the "Expected — Waiting" state. That is why required checks are run on every PR.
- **`*` in a path filter does not cross `/`**, so `plugins/*/...` has to be spelled out level by level.
- **PRs opened with `GITHUB_TOKEN` do not trigger `pull_request` workflows.** A workflow that bumps versions has to invoke the required checks itself.

### 2.3 Pitfalls from issues

**Versions, cache, updates**

- Stale cache and duplicate skills after an update: [#14218](https://github.com/anthropics/claude-code/issues/14218), [#36569](https://github.com/anthropics/claude-code/issues/36569), [#15672](https://github.com/anthropics/claude-code/issues/15672).
- `plugin update` does not refresh the marketplace clone: [#37252](https://github.com/anthropics/claude-code/issues/37252), [#29071](https://github.com/anthropics/claude-code/issues/29071).
- **Open:** private git marketplaces do not refresh the cache on update — [#90420](https://github.com/anthropics/claude-code/issues/90420).
- **Open:** truncated version directory after an update — [#94547](https://github.com/anthropics/claude-code/issues/94547).
- **Open:** disabled update button — [#45810](https://github.com/anthropics/claude-code/issues/45810).
- Updates of npm sources are not detected because the version is `unknown`: [#33253](https://github.com/anthropics/claude-code/issues/33253).
- Auto-update for third-party marketplaces: [#26744](https://github.com/anthropics/claude-code/issues/26744), [#10265](https://github.com/anthropics/claude-code/issues/10265).

**Paths and Windows**

- `${CLAUDE_PLUGIN_ROOT}` used to not be substituted in Markdown: [#9354](https://github.com/anthropics/claude-code/issues/9354). Now fixed.
- Mixed separators in `CLAUDE_PLUGIN_ROOT` on Windows: [#18527](https://github.com/anthropics/claude-code/issues/18527).
- CRLF in hook scripts: [#25711](https://github.com/anthropics/claude-code/issues/25711). The fix is `.gitattributes` with `eol=lf` (this is my conclusion, not the documentation).
- Locating `/bin/bash`: [#18610](https://github.com/anthropics/claude-code/issues/18610). Bare `npx` fails with ENOENT: [#58510](https://github.com/anthropics/claude-code/issues/58510). git is not found: [#42135](https://github.com/anthropics/claude-code/issues/42135).
- Organization sync via claude.ai rejects plugins with a `bin/` directory at the root, so `scripts/` is better **[from a single source, not from the official documentation]**.

**Names and collisions**

- A user can register only one marketplace with a given name.
- If two plugins with the same manifest name come from different marketplaces, both show as enabled, but hooks are registered for only one of them.
- A `--plugin-dir` copy silently overrides an installed plugin with the same name: [#32619](https://github.com/anthropics/claude-code/issues/32619).
- A skill from a plugin can shadow a built-in command: [#78235](https://github.com/anthropics/claude-code/issues/78235).

**Skills do not load**

- [#15178](https://github.com/anthropics/claude-code/issues/15178) (open), [#48963](https://github.com/anthropics/claude-code/issues/48963), [#35641](https://github.com/anthropics/claude-code/issues/35641), [#72046](https://github.com/anthropics/claude-code/issues/72046).
- "Unknown skill" for skills from private marketplaces: [#62485](https://github.com/anthropics/claude-code/issues/62485).
- Hooks in SKILL.md frontmatter do not fire inside plugins: [#17688](https://github.com/anthropics/claude-code/issues/17688).

**Authentication**

- The `GITHUB_TOKEN` story: [#9756](https://github.com/anthropics/claude-code/issues/9756).
- No fallback to HTTPS when installing in a session: [#26588](https://github.com/anthropics/claude-code/issues/26588) (open).
- Organization sync rejects public repos: [#81800](https://github.com/anthropics/claude-code/issues/81800).

**Project scope**

- Cloud sandbox environments do not process `extraKnownMarketplaces` from the repo: [#78119](https://github.com/anthropics/claude-code/issues/78119) (open).
- Enabling a plugin at the project level silently does not work: [#90937](https://github.com/anthropics/claude-code/issues/90937) (open).
- Managed `extraKnownMarketplaces` is ignored: [#16870](https://github.com/anthropics/claude-code/issues/16870) **[whether it still reproduces is unverified, since the documentation describes this feature as supported]**.

### 2.4 Recommendations for a team marketplace

1. **A private monorepo** with plugins in `plugins/<name>/`, relative paths, README, CONTRIBUTING, LICENSE, CODEOWNERS and `.gitattributes`.
2. **A unique kebab-case marketplace name**, not resembling Anthropic's names. The entry name, the `plugin.json` name and the directory name are identical. Do not rename anything without `renames`.
3. **Versioning:** SemVer only in `plugin.json`, with a mandatory version bump checked in CI. The alternative is no version at all, in which case the commit SHA becomes the version.
4. **Setup:** for individual repos — `.claude/settings.json` with `extraKnownMarketplaces` + `enabledPlugins`; for the whole fleet of machines — managed settings with `autoUpdate: true`. If `strictKnownMarketplaces` is used, it must include `{ "source": "skills-dir" }` and the official marketplace.
5. **Small single-purpose plugins.** Mark niche plugins with `defaultEnabled: false`, link groups via `dependencies`. Before force-enabling a plugin for everyone, check with `claude plugin details` how much context it permanently takes up.
6. **CI:**
   - `claude plugin validate --strict` with a pinned CLI version;
   - JSON check for hooks and MCP;
   - frontmatter check;
   - version bump check;
   - shellcheck;
   - **no path filters** for required checks.
7. **Security.** Plugins run with the user's full permissions outside the sandbox. Therefore:
   - CODEOWNERS review for `hooks/**`, `.mcp.json`, `scripts/**`;
   - SHA pin for third-party sources;
   - remote MCP or a lockfile instead of `npx <latest>`;
   - with auto-update, every merge to `main` is effectively a release.
8. **Secrets** never go into the repo. Use `userConfig` with `"sensitive": true` (the value is kept in secure storage and available as `CLAUDE_PLUGIN_OPTION_<KEY>`) or `${ENV_VAR}` in the MCP config.
9. **Two-stage testing:** first a local `marketplace add ./`, then **a real install from the remote git repo on a clean profile**, because that is where copying to the cache happens. Separately check that hooks are executable and contain no absolute paths or paths to the home directory.

---

## 3. Analysis of the course structure

### What the course proposes

```text
dev-digest-ai-marketplace/
├── .claude-plugin/
│   └── marketplace.json           # catalog, plugins: []
├── plugins/
│   └── .gitkeep                   # empty directory for future plugins
├── docs/
│   ├── PLUGIN-GUIDELINES.md       # plugin structure, manifest, dependency requirements
│   ├── SECURITY.md                # permissions, secrets policy, scripts review
│   └── RELEASES.md                # SemVer, tags, update, rollback
├── scripts/
│   └── validate-marketplace.mjs   # custom structural linter (Node, no dependencies)
├── .github/
│   ├── workflows/
│   │   └── validate.yml           # CI on pull_request
│   └── pull_request_template.md   # contributor checklist
├── CODEOWNERS                     # catch-all + room for per-plugin owners
├── CONTRIBUTING.md                # how to change the catalog safely
├── README.md                      # what it is, how to add/install
└── MARKETPLACE-RESEARCH.md
```

CI: `claude plugin validate . --strict` plus a custom dependency-free Node linter. `owner` is a placeholder for now.

### Verified bug: CI will fail from the first commit

An empty `"plugins": []` combined with `--strict` does not pass. Verified on Claude Code 2.1.301:

```text
⚠ Found 2 warnings:
  ❯ plugins: Marketplace has no plugins defined
  ❯ description: No marketplace description provided...
✘ Validation failed (--strict treats warnings as errors)
exit=1
```

Adding `description` removes one warning, but `no plugins` remains. Options:

- **(chosen)** have at least one plugin from the first commit;
- run without `--strict` while the catalog is empty;
- in the custom linter, filter out exactly this warning from the `--json` report.

### Comparison

| Item | Course | My initial proposal | Open sources |
|---|---|---|---|
| `.claude-plugin/marketplace.json` + `plugins/` (monorepo) | ✅ | ✅ | ✅ standard |
| README / CONTRIBUTING / CODEOWNERS | ✅ | ✅ | ✅ Trail of Bits, wshobson |
| `docs/SECURITY.md` | ✅ | only as a practice | ✅ Trail of Bits reads every line of hooks |
| `docs/RELEASES.md` | ✅ | partially | almost nowhere; the course is stronger here |
| `docs/PLUGIN-GUIDELINES.md` | ✅ | in CONTRIBUTING | ✅ |
| PR template | ✅ | ❌ | ✅ |
| `claude plugin validate --strict` in CI | ✅, but fails on an empty catalog | ✅ | ✅ |
| Custom linter | ✅ Node, no dependencies | reusable action from Anthropic | both options occur |
| `description` in the manifest | ❌ | ✅ | required for `--strict` |
| `$schema` | ❌ | ✅ | ✅ `anthropics/claude-code` |
| `.gitattributes` (LF) | ❌ | ✅ | CRLF bugs on Windows |
| Plugin template | ❌ | ❌ | ✅ `anthropics/skills/template/` |
| Consumer documentation (settings, authentication) | unknown | ✅ | the main source of problems in issues |
| Version bump check | unknown | ✅ | without it, updates do not reach users |

### What we take from the course

- Splitting documentation into `docs/`: separate SECURITY, RELEASES, PLUGIN-GUIDELINES.
- A custom dependency-free linter. No need to pull in a third-party action, the rules are under our control, and it covers what `validate` does not catch.
- A PR template with a checklist.
- CODEOWNERS with a catch-all and room for owners of individual plugins.

---

## 4. Conclusions and decisions

1. **Monorepo with relative paths.** The easiest to maintain. Project-scope setup works without a manual `install`, and a local `marketplace add ./` gives an instant development loop. External sources (`github`/`git-subdir` with `sha`) will be added only if needed.
2. **From the first commit the catalog has at least one plugin**, otherwise `validate --strict` fails (verified). Besides, a working example documents the correct structure by itself.
3. **`description` and `$schema`** in `marketplace.json`: the first is required for `--strict`, the second gives autocompletion.
4. **SemVer only in `plugin.json`.** CI checks that when `plugins/X/**` changes, the version of X is bumped. Without this, users with a pinned version will not receive updates, and a version in both places causes a silent conflict.
5. **Catalog entry name = `plugin.json` name = directory name.** Renaming only via `renames`; `displayName` is for cosmetics.
6. **Two-tier validation:** `claude plugin validate --strict` for the schema plus a custom linter for what `validate` does not check. The required check runs on every PR, without path filters. The CLI version is pinned.
7. **Security as a process:** CODEOWNERS with mandatory review for `hooks/`, `.mcp.json` and `scripts/`. Secrets only via `userConfig` (`sensitive: true`) or `${ENV_VAR}`. No `npx @latest`. SHA pin for any third-party sources.
8. **Consumer documentation as a separate file.** Most problems in issues are about authentication to a private repo, the trust dialog and auto-update being disabled by default. The plugin developer and the plugin user are different audiences.
9. **Plugin template outside `plugins/`**, so it does not end up in the catalog. It lowers the barrier to entry and locks in the correct patterns: quoted `${CLAUDE_PLUGIN_ROOT}`, `scripts/` instead of `bin/`, `${ENV_VAR}` in MCP.
10. **`.gitattributes` with LF and no LFS** protects against CRLF bugs on Windows and against pointer files instead of real ones.
11. **Rollback via a new version (roll-forward)**, not by rewriting a tag. Whether the client picks up a decreased version number is **[unverified]**. The version works as a signal string, so it is more reliable to always publish a new one.
12. **A short marketplace name.** The identifier looks like `plugin@<marketplace>`, so a `-marketplace` suffix only makes it longer. The name should be fixed right away: once it is written into `enabledPlugins`, changing it is painful.

---

## 5. Target repository structure

```text
shark-software-ai-marketplace/
├── .claude-plugin/
│   └── marketplace.json              # $schema, name, description, owner, plugins[]
│                                     #   (+ renames and forceRemoveDeletedPlugins fields when needed)
│
├── plugins/
│   └── team-conventions/             # demo/first plugin: without it validate --strict will not pass
│       ├── .claude-plugin/
│       │   └── plugin.json           # name = catalog entry = directory name; version here and only here
│       ├── skills/
│       │   └── code-style/
│       │       └── SKILL.md          # frontmatter: name, description
│       ├── README.md                 # what the plugin does, how to enable it, settings
│       └── CHANGELOG.md              # plugin version history
│
├── templates/
│   └── plugin-template/              # starter to copy (outside plugins/, not part of the catalog)
│       ├── .claude-plugin/plugin.json
│       ├── skills/example-skill/SKILL.md
│       ├── agents/example-agent.md
│       ├── hooks/hooks.json          # example with quoted "${CLAUDE_PLUGIN_ROOT}"
│       ├── scripts/example.sh        # scripts/, not bin/
│       ├── .mcp.json                 # example with ${ENV_VAR} instead of secrets
│       ├── README.md
│       └── CHANGELOG.md
│
├── docs/
│   ├── PLUGIN-GUIDELINES.md          # structure, manifest, names, variables, cache and the ban on ../,
│   │                                 #   plugin size, defaultEnabled, dependencies
│   ├── SECURITY.md                   # permissions, hooks/MCP/scripts review, secrets, sha-pin, no npx @latest
│   ├── RELEASES.md                   # SemVer, <plugin>--v<version> tags, roll-forward, renames,
│   │                                 #   removing plugins, auto-update, stable/beta channels
│   ├── CONSUMERS.md                  # setup: .claude/settings.json, managed settings,
│   │                                 #   authentication to a private repo, Windows
│   ├── TROUBLESHOOTING.md            # Errors tab in /plugin, plugin details, --debug, /reload-plugins, known bugs
│   └── temp/
│       └── MARKETPLACE-RESEARCH.md   # this document
│
├── scripts/
│   └── validate-marketplace.mjs      # custom linter, Node with no dependencies (see section 6)
│
├── .github/
│   ├── workflows/
│   │   └── validate.yml              # on every PR, no paths filter; pinned claude CLI version
│   ├── ISSUE_TEMPLATE/
│   │   ├── new-plugin.md             # request for a new plugin
│   │   └── bug-report.md             # plugin bug (CC version, OS, /plugin Errors output)
│   ├── pull_request_template.md      # checklist: version bumped, CHANGELOG, validate, security review
│   └── CODEOWNERS                    # catch-all + owner of each plugin + mandatory review
│                                     #   for **/hooks/**, **/.mcp.json, **/scripts/**
│
├── .gitattributes                    # *.sh, *.mjs text eol=lf; no LFS
├── .gitignore
├── .editorconfig
├── CONTRIBUTING.md                   # how to add a plugin: copy the template → test locally → PR
├── README.md                         # what this repo is, plugin catalog, quick setup
└── LICENSE                           # internal/proprietary
```

### Why each item exists

| Item | Why | Source |
|---|---|---|
| `.claude-plugin/marketplace.json` | The only required marketplace file | Official documentation |
| `$schema`, `description` in it | Autocompletion; `description` is required for `--strict` | Documentation + my own check |
| `plugins/<name>/` | Monorepo with relative paths: project scope without a manual `install`, fast local loop | Documentation, `anthropics/claude-code`, wshobson |
| Demo plugin `team-conventions` | Without any plugin `validate --strict` fails; at the same time a living example | My own check (the course is wrong here) |
| `plugin.json` with `version` | Update signal; version only here, to avoid a silent conflict | Documentation 1.14 |
| `README.md` + `CHANGELOG.md` in the plugin | The user sees what changed and how to configure it | wshobson; changelog is my addition |
| `templates/plugin-template/` | Lower barrier to entry, correct patterns locked in; outside `plugins/`, so not in the catalog | `anthropics/skills/template/` |
| `docs/PLUGIN-GUIDELINES.md` | Rules for plugin authors | Course |
| `docs/SECURITY.md` | Plugins run with full permissions, and backdoors have been found in public skills | Course, Trail of Bits, security documentation |
| `docs/RELEASES.md` | The least obvious part: version, tags, renaming, auto-update | Course + documentation 1.14/1.15 |
| `docs/CONSUMERS.md` | Most issues are about authentication, the trust dialog and auto-update | Documentation 1.9–1.13, issues |
| `docs/TROUBLESHOOTING.md` | Collects debugging techniques and known bugs in one place | Documentation 1.12, issues 2.3 |
| `scripts/validate-marketplace.mjs` | `validate` misses some problems: names, versions, paths, reserved names, LF | Course + Anthropic's I1–I11 rules |
| `validate.yml` without a paths filter | Otherwise the required check gets stuck in "Expected — Waiting" | `claude-plugins-official` |
| Pinned CLI version in CI | Reproducibility; a new CLI version may add a warning and break `--strict` | README of the `validate-plugins` action |
| `pull_request_template.md` | Makes the checklist mandatory in practice | Course |
| `ISSUE_TEMPLATE/` | Structured requests and bug reports (CC version, OS, Errors output) | My addition |
| `CODEOWNERS` in `.github/` | Owner of each plugin + mandatory review of risky files | Course, Trail of Bits |
| `.gitattributes` | CRLF breaks hooks on Windows; LFS files arrive as pointer files | Issue #25711, documentation |
| `.editorconfig`, `.gitignore` | Hygiene, optional | — |
| `LICENSE` | Explicit legal status even for an internal repo | All reference repositories |

---

## 6. Linter and CI

### What `scripts/validate-marketplace.mjs` checks

That is, what `claude plugin validate` does not catch or reports only as a warning:

1. Every catalog entry has a directory with `plugin.json`, and every plugin directory has a catalog entry.
2. `name` in the entry = `name` in `plugin.json` = directory name. Kebab-case, no reserved prefixes (`claude-`, `anthropic-`, `anthropics-`, `cc-plugin-`).
3. The marketplace name is not on the reserved list (1.3).
4. `version` is set only in `plugin.json`, in SemVer format.
5. **The version is bumped** if the PR changes `plugins/X/**` (compared with `main`), and there is a corresponding CHANGELOG entry.
6. No duplicates, entries sorted alphabetically.
7. Paths start with `./`, with no `..`, absolute paths, `~` or backslashes.
8. `hooks.json`, `.mcp.json`, `.lsp.json` parse correctly as JSON. Hooks are not specified as a file path in a catalog entry.
9. SKILL.md, agents and commands have frontmatter with `name`/`description`.
10. Scripts have the executable bit and LF line endings.
11. No symlinks pointing outside the repo and no LFS files.
12. A simple secret scan (tokens, private keys).
13. Third-party `source`s, if they appear, are pinned to a `sha` and use https only.

### `.github/workflows/validate.yml`

- Trigger: `pull_request` on every PR **without** `paths`, plus `push` to `main`.
- Install `@anthropic-ai/claude-code@<pinned-version>`.
- `claude plugin validate . --strict`
- `claude plugin validate plugins/* --strict` (in a loop over directories).
- `node scripts/validate-marketplace.mjs`.
- `shellcheck` for `plugins/**/scripts/**` and `templates/**/scripts/**`.
- Actions pinned to SHAs, `persist-credentials: false`.

---

## 7. Open questions

1. **Marketplace name.** Proposal: `shark-plugins` (install: `team-conventions@shark-plugins`). Alternative: `shark-software-ai-marketplace`.
2. **First plugin.** `team-conventions` is a placeholder. A real one could be used right away.
3. **Versioning model.** SemVer with a mandatory version bump (recommended) or no `version`, where the SHA is the version.
4. **Real data:** `owner`, `LICENSE`, owners in CODEOWNERS.
5. **What can be dropped** if the structure is too big: `ISSUE_TEMPLATE/`, `.editorconfig`, `TROUBLESHOOTING.md`, per-plugin CHANGELOG.
6. **Rollout:** only via `.claude/settings.json` in projects, or also managed settings with `autoUpdate: true` for the whole team.
