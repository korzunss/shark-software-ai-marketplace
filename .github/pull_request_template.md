## What changed

<!-- One or two sentences: which plugin and what changed in it. -->

## Why

<!-- The problem, task or issue link. -->

## Checklist

- [ ] Changes are described under `## [Unreleased]` in `plugins/<name>/CHANGELOG.md`
- [ ] Ran `npm run release -- bump <name> <major|minor|patch>` (bumps `plugin.json`, the CHANGELOG and the README catalog)
- [ ] `version` is set **only** in `plugin.json`, not in `marketplace.json`
- [ ] Folder name = `name` in `plugin.json` = `name` in the catalog entry; entries are sorted
- [ ] A new plugin is added to the catalog table in `README.md` and to `.github/CODEOWNERS`
- [ ] `npm run validate` passes locally
- [ ] Tested with `claude plugin marketplace add ./` → `claude plugin install <name>@shark-plugins`

### Security (if hooks, MCP, LSP or scripts changed)

- [ ] Every line of hooks and scripts was read; no network calls or file access beyond what is needed
- [ ] No secrets in the repo; tokens only through `${ENV_VAR}` or `userConfig` with `"sensitive": true`
- [ ] MCP servers are not started with `npx <package>@latest`; external sources are pinned to a `sha`
- [ ] `${CLAUDE_PLUGIN_ROOT}` is quoted in shell-form hook commands
