# plugin-template

Template for a new plugin. It lives outside `plugins/`, so it is not part of the catalog.

## How to use it

```bash
cp -R templates/plugin-template plugins/my-plugin
```

Then:

1. Replace `plugin-template` with `my-plugin` in `.claude-plugin/plugin.json` and in this README. The folder name, `name` in `plugin.json` and `name` in the catalog entry must be identical. Change `homepage` from `…/tree/main/templates/plugin-template` to `…/tree/main/plugins/my-plugin`, and keep `$schema` for editor autocomplete.
2. Delete the components you do not need: `agents/`, `hooks/`, `scripts/`, `.mcp.json`. The template hook runs after every `Write`/`Edit`, so do not leave it in by accident.
3. Rename `skills/example-skill/` and the `name` field in its frontmatter (they must match).
4. Keep `CHANGELOG.md` with an empty `## [Unreleased]` section and a `## [0.1.0]` section for the first version.
5. Add an entry to `.claude-plugin/marketplace.json` (alphabetical order) and a row to the catalog table in the root `README.md`.
6. Check it: `npm run validate`.

## Patterns to keep

- Reference plugin files through `${CLAUDE_PLUGIN_ROOT}`, quoted in shell-form hook commands.
- Keep state and caches in `${CLAUDE_PLUGIN_DATA}`.
- Put scripts in `scripts/` (not `bin/`), executable, with LF line endings.
- Pass secrets only through `${ENV_VAR}` or `userConfig` with `"sensitive": true`.

Full rules: [docs/PLUGIN-GUIDELINES.md](../../docs/PLUGIN-GUIDELINES.md).

## Install

```bash
claude plugin install plugin-template@shark-plugins
```

## Configuration

| Variable | Purpose |
|---|---|
| `EXAMPLE_API_TOKEN` | Token for the `example-api` MCP server |
