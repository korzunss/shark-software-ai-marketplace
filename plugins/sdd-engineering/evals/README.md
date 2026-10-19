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

From the repository root, with the repository root as the target. A case may only load plugins below the target directory, so targeting `plugins/sdd-engineering` itself would refuse the dependency entries:

```bash
claude plugin eval . --eval-dir plugins/sdd-engineering/evals \
  --scaffold \
  --allow-tools Bash Write Edit \
  --ablation none \
  --model sonnet \
  --no-publish \
  --max-cost-usd 10
```

- `--scaffold` runs each case's `scaffold.sh`, which builds a small Node project in a git repo inside the run's empty workspace. The scripts are ours; review them before running someone else's.
- `--allow-tools Bash Write Edit`: `run-plan` drives the pipeline through `sdd.sh` (Bash) and writes the config and indexes (Write). Bash runs under Claude Code's OS sandbox, confined to the run's workspace.
- `--ablation none`: `run-plan` is invoked by its slash command, which does not exist without the plugin, so a no-plugin baseline arm measures nothing useful here.
- Smoke only: add `--tag smoke`. One case: `--case <name>`. Fewer runs: `--runs 1`.

Results go to `evals/results/<timestamp>/` (`aggregate-result.json`, `report.html`), which is git-ignored.

## Known blocker: `engineering-paved-path` is disabled in the eval sandbox

`engineering-paved-path` ships with `"defaultEnabled": false`, and an eval run enables nothing on its own (`claude plugin eval` prints "nothing in the eval sandbox enables it"). `sdd-engineering` then fails to load with `dependency-unsatisfied: Dependency "engineering-paved-path" is disabled`, and `/sdd-engineering:run-plan` does not exist in the run. The `plugins-loaded` guard turns that into a failing score.

A normal install is not affected: installing `sdd-engineering` writes `"engineering-paved-path@shark-plugins": true` to `enabledPlugins`. Until `defaultEnabled` is dropped from `engineering-paved-path` (or the eval runner gains a way to enable a plugin), these cases cannot pass.

## Cost

Every run is a real model session on your account, and `smoke-seeded-config-starts-spec` also starts the `spec-creator` subagent. Use `--max-cost-usd` and start with `--runs 1`.
