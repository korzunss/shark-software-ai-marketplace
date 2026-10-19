# Troubleshooting

Reference: [Plugin troubleshooting](https://code.claude.com/docs/en/plugins/troubleshooting).

## Where to look first

1. `/plugin` → **Errors** tab.
2. `claude plugin list`: is the plugin installed and enabled?
3. `claude plugin details <name>`: version, components, how much context it uses.
4. `claude --debug`: a log in `~/.claude/debug/`, including conflict and override messages.
5. `claude -p --output-format stream-json --verbose "hi"`: the `init` event lists the loaded plugins.

Plugin state lives in `~/.claude/plugins/`: `known_marketplaces.json`, `installed_plugins.json`, `cache/`, `marketplaces/`.

## Common problems

| Symptom | Cause | What to do |
|---|---|---|
| `marketplace add` fails without asking for a password | No git authentication: Claude Code never prompts | `gh auth login && gh auth setup-git`; without an SSH key set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` ([CONSUMERS.md](CONSUMERS.md#authentication)) |
| `Plugin "<x>" not found in marketplace` | The name does not match the catalog entry | `claude plugin install <name>@shark-plugins`, using the name from the README catalog |
| Changes to a plugin do not arrive | The `version` was not bumped, or auto-update is off | Bump the version (CI catches it); `claude plugin marketplace update shark-plugins` → `claude plugin update <name>@shark-plugins` |
| Update installed, behavior unchanged | The session keeps the loaded version | `/reload-plugins` or a new session |
| A private marketplace does not refresh its cache | Known bug [#90420](https://github.com/anthropics/claude-code/issues/90420) | `claude plugin marketplace remove shark-plugins` and add it again |
| A skill does not show up in `/` | Missing frontmatter, `name` does not match the folder, or the skill is shadowed ([#15178](https://github.com/anthropics/claude-code/issues/15178)) | Errors tab, `/reload-plugins`; run `node scripts/validate-marketplace.mjs` |
| A hook does not fire | Script not executable, CRLF, unquoted `${CLAUDE_PLUGIN_ROOT}`, or hooks given as a path in the catalog entry | The linter catches all of these; on Windows check line endings |
| A script cannot find `../…` | The plugin was copied to the cache; files outside it are not there | Move the file into the plugin and reference it through `${CLAUDE_PLUGIN_ROOT}` |
| Plugin state disappears after an update | State was stored in `${CLAUDE_PLUGIN_ROOT}`, which changes with the version | Store it in `${CLAUDE_PLUGIN_DATA}` |
| Plugin files are odd text "pointer" files | The files are in Git LFS | Do not use LFS (CI catches it) |
| `enabled in project settings but isn't installed here` | A plugin with an external source is not installed | `claude plugin install <name>@shark-plugins --scope project` |
| The project marketplace is not picked up | The folder trust dialog was not accepted | Open the project in Claude Code and trust the folder |
| A `--plugin-dir` plugin "overrides" the installed one | A local copy with the same name takes precedence ([#32619](https://github.com/anthropics/claude-code/issues/32619)) | Run without `--plugin-dir` |
| Identical hooks from two plugins, only one works | Two plugins with the same `name` from different marketplaces | Keep plugin names unique |
| `release.mjs tag` refuses to run | Not on `main`, or a CHANGELOG section is missing | Tag from an up-to-date `main`; normally the release workflow does it |
| `rollback.mjs`: tag not found | Tags are not fetched locally | `git fetch --tags`, or pass a commit to `--to` |

## Starting over

```bash
claude plugin uninstall <name>@shark-plugins
claude plugin marketplace remove shark-plugins
claude plugin marketplace add korzunss/shark-software-ai-marketplace
claude plugin install <name>@shark-plugins
```

Removing a marketplace also removes all of its plugins and their `enabledPlugins` entries.

## Reporting a bug

Open an issue from the "Plugin bug" template with your Claude Code version, OS and the Errors tab output. Remove tokens from logs first.
