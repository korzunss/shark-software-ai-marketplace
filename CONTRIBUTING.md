# Contributing

Every change reaches `main` through a pull request only. It needs:

- a green `Validate` check;
- a review from the owner in [CODEOWNERS](.github/CODEOWNERS).

Every merge to `main` is effectively a release: once merged, the release workflow tags the new plugin versions, and users with auto-update receive them automatically.

## New plugin

1. **Agree on the idea.** Open an issue from the "New plugin" template, especially if the plugin has hooks, an MCP server or scripts.
2. **Copy the template:**

   ```bash
   cp -R templates/plugin-template plugins/my-plugin
   ```

3. **Rename it.** Replace `plugin-template` with `my-plugin` in `.claude-plugin/plugin.json` and `README.md`. Names are kebab-case, without the `claude-`, `anthropic-` or `cc-plugin-` prefixes. In `plugin.json`, point `homepage` at the new folder: `…/tree/main/plugins/my-plugin` (CI checks it). Keep `$schema`: it gives editors autocomplete for the manifest.
4. **Remove what you do not need:** delete `agents/`, `hooks/`, `scripts/` and `.mcp.json` if unused.
5. **Add a catalog entry** to `.claude-plugin/marketplace.json`, keeping alphabetical order:

   ```json
   {
     "name": "my-plugin",
     "source": "./plugins/my-plugin",
     "description": "What the plugin does (10–2000 characters)",
     "category": "development"
   }
   ```

   **Do not** set `version` in the entry: it lives in `plugin.json` only.
6. **Add a row to the catalog table** in the root `README.md`.
7. **Add an owner** to `.github/CODEOWNERS`, in the "Per-plugin owners" section.
8. **Check locally** (see below) and open a pull request.

A new plugin starts at `0.1.0` and needs no bump.

## Changing an existing plugin

1. Make your changes in `plugins/<name>/`.
2. Describe them under `## [Unreleased]` in `plugins/<name>/CHANGELOG.md`.
3. Bump the version:

   ```bash
   npm run release -- bump <name> patch   # or minor / major, see docs/RELEASES.md#semver
   ```

   This bumps `plugin.json`, turns the Unreleased notes into a dated version section and updates the README catalog. It is safe to re-run on the same branch: the new version is always computed from `main`, so changing `patch` to `minor` does not bump twice.

   CI fails if a plugin changed without a version bump. The rule covers every file of the plugin, README included: without a new version, users do not receive the change.
4. **Do not rename a plugin**: it breaks `enabledPlugins` for every user. See [docs/RELEASES.md](docs/RELEASES.md#renaming-and-removing) for the right way.

## Checking locally

```bash
# Linter (with the version-bump check) + official validator for the catalog, plugins and template
npm run validate

# A real install from your working copy
claude plugin marketplace add ./
claude plugin install my-plugin@shark-plugins
claude plugin details my-plugin
```

A local marketplace picks up changes in the next session or after `/reload-plugins`, with no version bump.

Before merging larger changes, also install **from the git remote** (the PR branch) on a clean profile. That is where the plugin is copied into the cache, and where problems with `../` paths and symlinks show up.

If you change the scripts in `scripts/`, run `npm test` as well.

## What CI checks

- `claude plugin validate --strict` for the catalog, every plugin and the template.
- `scripts/validate-marketplace.mjs`:
  - matching names, reserved names;
  - SemVer, version bumps, CHANGELOG section for the current version, README catalog version;
  - paths, symlinks, Git LFS;
  - frontmatter of skills, agents and commands;
  - valid JSON in hooks, MCP and LSP configs, quoted `${CLAUDE_PLUGIN_ROOT}`;
  - executable scripts, LF line endings;
  - a basic secret scan.
- ShellCheck for `*.sh`.
- `npm test` for the release and rollback scripts.

The full list of rules is in [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md).
