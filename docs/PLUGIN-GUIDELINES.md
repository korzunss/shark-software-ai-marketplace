# Plugin guidelines

The rules come from the official Claude Code documentation ([manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference), [marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)) and the [research](temp/MARKETPLACE-RESEARCH.md). **[CI]** marks a rule that `scripts/validate-marketplace.mjs` or `claude plugin validate` enforces.

## Plugin layout

```text
plugins/<name>/
├── .claude-plugin/
│   └── plugin.json        # the only file in .claude-plugin/
├── skills/<skill>/SKILL.md
├── agents/*.md
├── commands/*.md          # legacy format; prefer skills/ for new work
├── hooks/hooks.json
├── scripts/               # executable scripts for hooks/MCP
├── .mcp.json
├── .lsp.json
├── README.md              # required
└── CHANGELOG.md           # required
```

- **[CI]** `.claude-plugin/` contains only `plugin.json`; all components sit at the plugin root.
- **[CI]** `README.md` and `CHANGELOG.md` are required.
- A `CLAUDE.md` at the plugin root is **not loaded**. Put instructions in a skill.
- Use `scripts/`, not `bin/`, for scripts: organization sync through claude.ai rejects a top-level `bin/`.

## Names

- **[CI]** Folder name = `name` in `plugin.json` = `name` in the `marketplace.json` entry. If they differ, installing by name fails with `not found in marketplace`.
- **[CI]** Names are kebab-case, without the `claude-`, `anthropic-`, `anthropics-` or `cc-plugin-` prefixes, and are not `claude`, `anthropic`, `claude-code` or `claude-mods`.
- **[CI]** Catalog entries are sorted alphabetically, with no duplicates.
- The name is a permanent id. Use `displayName` to change the label shown in the UI. For renames see [RELEASES.md](RELEASES.md#renaming-and-removing).
- Components are namespaced by the plugin name: the `code-style` skill in the `team-conventions` plugin is invoked as `team-conventions:code-style`.

## plugin.json

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "What the plugin does",
  "author": { "name": "Shark Software" },
  "homepage": "https://github.com/korzunss/shark-software-ai-marketplace/tree/main/plugins/my-plugin",
  "repository": "https://github.com/korzunss/shark-software-ai-marketplace"
}
```

- **[CI]** `version` (SemVer) and `description` are required.
- `$schema` gives editors autocomplete and inline errors. The SchemaStore schema lags behind the docs (it lacks `displayName`, `defaultEnabled` and a few other fields, without flagging them), so `claude plugin validate` remains the authority.
- **[CI]** `homepage`, when it links into this repo, points at the plugin's own folder. `repository` is the same for every plugin in this monorepo.
- **[CI]** `version` is set **only** here, never in the catalog entry. If it is set in both places, `plugin.json` silently wins.
- **[CI]** Every path starts with `./`, contains no `..` or backslashes, and exists.
- The `commands`, `agents`, `outputStyles` and `workflows` keys **replace** the default folder. To keep the default folder, list it explicitly: `"commands": ["./commands/", "./extra/"]`.
- The `skills` key **adds to** the default folder; `hooks`, `mcpServers` and `lspServers` **merge** with the default files.
- Unknown keys are silently ignored at load time; `validate --strict` in CI catches them. Do not invent fields.

## Catalog entry in marketplace.json

- **[CI]** `name`, `source` (`./plugins/<name>`) and a `description` of 10–2000 characters are required.
- **[CI]** `hooks` in an entry may only be an inline object: a file path passes validation but never runs. Keep hooks in `hooks/hooks.json`.
- `mcpServers` and `lspServers` in an entry apply only when the plugin has no `plugin.json`. Ours always do, so declare them in the plugin.
- **[CI]** External sources (`github`, `url`, `git-subdir`) are pinned to a 40-character `sha` and use https only. They are added only after a security review.

## Skills, agents, commands

- **[CI]** `skills/<dir>/SKILL.md` has frontmatter with `name` (equal to `<dir>`) and `description`.
- **[CI]** Agents have `name` and `description`; commands have `description`.
- `description` decides when a skill triggers. Say both **what** the skill does and **when** to use it.
- One plugin, one job. An always-on plugin permanently uses context; check how much with `claude plugin details <name>`. Mark niche plugins `defaultEnabled: false` and group related plugins through `dependencies`.

## Paths and variables

On install, a plugin is **copied** to `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`.

| Variable | What it is | How to use it |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | Folder of the installed version | Plugin files. Changes with every version, so **never store state here** |
| `${CLAUDE_PLUGIN_DATA}` | Persistent plugin folder | Caches, dependencies, generated files |
| `${CLAUDE_PROJECT_DIR}` | Project root | Project configs |

- Files outside the plugin folder (`../shared`) are **not copied** and will not exist after install.
- **[CI]** Symlinks pointing outside the marketplace are not allowed: they are skipped when the plugin is copied.
- **[CI]** Quote the variable in shell-form hook commands: `"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/x.sh"`. Otherwise paths with spaces break. The exec form (`args`) needs no quotes.
- **[CI]** User-specific absolute paths (`/Users/…`, `/home/…`, `~/…`, `C:\…`) are not allowed in JSON configs.
- The variables are not substituted in Bash commands that Claude itself runs.

## Scripts

- **[CI]** Scripts are executable (`chmod +x` and `git update-index --chmod=+x <file>`) and have a shebang.
- **[CI]** Line endings are LF (see `.gitattributes`); CRLF breaks hooks on Windows.
- **[CI]** ShellCheck runs on `*.sh`.
- Do not assume global tools without checking: on Windows a bare `npx` or `/bin/bash` may be missing.

## Files

- **[CI]** No Git LFS: installs would receive pointer files instead of the content.
- **[CI]** No secrets (see [SECURITY.md](SECURITY.md)).
