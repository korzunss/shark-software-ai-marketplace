# sdd-engineering evals

Behavior evals for `/sdd-engineering:run-plan`, run with [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). Each case is a directory with a `prompt.md` (run limits and the prompt), a `case.yaml` (the fixture script) and `graders/`.

| Case | Tag | What it proves |
|---|---|---|
| `smoke-intake-proposes-config` | smoke | Without `.sdd/config.json`, intake proposes a config built only from commands the project defines, and stops at that question before any spec, plan or code work |
| `smoke-seeded-config-starts-spec` | smoke | With `.sdd/config.json`, intake asks nothing, creates the spec and plan indexes in the **configured** folders, and hands the request to `sdd-engineering:spec-creator` |
| `negative-unrelated-request` | negative | A one-line rename is done directly: no SDD agent, no `.sdd/`, `specs/` or `docs/plans/` files |
| `negative-draft-plan-no-implement` | negative | `--resume` on a draft plan stops at the approval gate: no implementer, no source edits, the plan stays `draft` |

Every case loads `sdd-engineering` together with its four dependency plugins (`plugins:` in `prompt.md`), because an eval run loads only the plugins it is given. Each case also has a `plugins-loaded` guard: it fails when the session reports a plugin error, so the negative graders can never pass on a session that ran without the plugin.

## Run

From the repository root, through the eval wrapper (`scripts/run-evals.mjs`). It copies `sdd-engineering` and its dependencies into a temporary directory, enables them there as a real install does (`engineering-paved-path` ships with `"defaultEnabled": false`, and an eval run enables nothing on its own), and runs `claude plugin eval` against that copy. The source tree is never modified.

```bash
npm run evals -- sdd-engineering \
  --allow-tools Write Edit \
  --ablation none \
  --model sonnet \
  --no-publish \
  --max-cost-usd 10
```

- The wrapper always passes `--scaffold` (each case's `scaffold.sh` builds a small Node project in a git repo inside the run's empty workspace; the scripts are ours), `--trust-plugin` and `--allow-tools Bash` (`run-plan` drives the pipeline through `sdd.sh`).
- `--allow-tools Write Edit`: `run-plan` writes the config proposal and the indexes. Bash runs under Claude Code's OS sandbox, confined to the run's workspace.
- `--ablation none`: `run-plan` is invoked by its slash command, which does not exist without the plugin, so a no-plugin baseline arm measures nothing useful here.
- Smoke only: add `--tag smoke`. One case: `--case <name>`. Fewer runs: `--runs 1`.

Results go to `evals/results/<timestamp>/` (`aggregate-result.json`, `report.html`), which is git-ignored.

Running `claude plugin eval` directly, without the wrapper, leaves `engineering-paved-path` disabled: `sdd-engineering` then fails to load with `dependency-unsatisfied`, and the `plugins-loaded` guard turns that into a failing score.

## Cost

Every run is a real model session on your account, and `smoke-seeded-config-starts-spec` also starts the `spec-creator` subagent. Use `--max-cost-usd` and start with `--runs 1`.

**Tokens and calls.** Run with `--keep-temp`, then `npm run evals:metrics -- <results dir>/aggregate-result.json --md` for per-case medians of cost, latency, tokens, API calls and tool calls.

**macOS: real git required.** Every `sdd.sh` step needs git. Inside the eval sandbox the `/usr/bin/git` Xcode shim fails, so install git with Homebrew first ([TROUBLESHOOTING.md](../../../docs/TROUBLESHOOTING.md#common-problems)).
