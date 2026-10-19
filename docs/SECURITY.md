# Security

Claude Code plugins run **with the user's full privileges and outside the sandbox**:

- hooks run arbitrary commands on every event;
- MCP servers get network access and access to data;
- scripts can read everything the user can.

Backdoors and malicious hooks have already been found in public marketplaces (see [trailofbits/skills-curated](https://github.com/trailofbits/skills-curated)). That is why every line of executable code is reviewed.

Reference: [Plugin security](https://code.claude.com/docs/en/plugins/security).

## Review

- **Code owner review from [CODEOWNERS](../.github/CODEOWNERS) is mandatory** for `**/hooks/**`, `**/scripts/**`, `**/bin/**`, `**/.mcp.json`, `**/.lsp.json`, `/.claude-plugin/`, `/.github/` and `/scripts/`. These rules come last in CODEOWNERS, so they override the plugin owner.
- Branch protection on `main` must have **Require review from Code Owners** and the `Validate` check required.
- The reviewer **reads every line** of hooks and scripts and checks:
  - whether there are network calls (`curl`, `wget`, `nc`, HTTP clients) and whether they are justified;
  - that nothing reads or writes outside the project and `${CLAUDE_PLUGIN_DATA}`: `~/.ssh`, `~/.aws`, `.env`, shell history, keychain;
  - that no code is downloaded and executed on the fly (`curl … | sh`, `eval`, `base64 -d | sh`);
  - that there is no obfuscated, minified or binary code without sources;
  - that hook matchers are narrow (`Write|Edit`, not `.*`) and hooks do not block work without reason.
- Remember auto-update: reviewed files change on users' machines automatically. **A merge to `main` is a release.**

## Secrets

- **Never commit secrets.** CI scans for common tokens (AWS, GitHub, Anthropic, OpenAI, Slack, private keys), but that is a safety net, not a guarantee.
- Pass user tokens through:
  - `userConfig` with `"sensitive": true`: the value is kept in secure storage and exposed as `CLAUDE_PLUGIN_OPTION_<KEY>`;

    ```json
    "userConfig": {
      "api_token": { "type": "string", "title": "API token", "description": "…", "sensitive": true }
    }
    ```

  - environment variables in the MCP config: `"Authorization": "Bearer ${MY_API_TOKEN}"`.
- `.env` and `.claude/settings.local.json` are in `.gitignore`.
- If a secret did reach the repo, **revoke it immediately**. Removing it from history does not help: clones already exist.

## MCP servers

- Prefer **remote (http) MCP servers** with a known owner.
- Do not start servers with `npx <package>` or `npx <package>@latest`: that runs fresh, unreviewed code on every start. Pin an exact version, or better, vendor the server into the plugin with a lockfile (npm `package-lock.json` or `bun.lock`; Claude Code skips yarn and pnpm lockfiles).
- Claude Code does not run npm install scripts for plugin dependencies. Do not rely on `postinstall`.

## External plugin sources

- By default every plugin lives in this repo (`./plugins/<name>`).
- An external source (`github`, `url`, `git-subdir`) is allowed only after a security review and **[CI]** only pinned to a 40-character `sha` over https. Updating the `sha` is a separate pull request with a review of the upstream diff.
- `npm` and `command` sources need a separate justification: the linter warns about them.

## Supply chain of this repository

- GitHub Actions are pinned to commit SHAs. The validation workflow has `permissions: contents: read` and `persist-credentials: false`. The release workflow alone gets `contents: write`, to push tags and create GitHub releases.
- The Claude Code CLI version in CI is pinned and bumped in a separate pull request.

## Reporting a problem

Report a suspected vulnerability or malicious code in a plugin directly to the repository owner (`@korzunss`), not in a public issue. Then disable the plugin right away (see [RELEASES.md](RELEASES.md#emergency-disable)) and roll it back.
