# architecture-review evals

Behavior evals for the `architecture-reviewer` agent, run with [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals).

Each case builds the same small onion-style TypeScript service (`_fixture/orders-repo.sh`): a clean commit on `main` and one change on the checked-out `feature` branch. The prompt asks the main session to dispatch `architecture-review:architecture-reviewer` in diff mode against `main` and return its report verbatim. Graders check the report.

| Case | Kind | The `feature` change | Expected |
|---|---|---|---|
| `block-service-imports-adapter` | positive | the place-order use case imports and constructs `PgOrderRepository` | `BLOCK`, CRITICAL finding at `src/application/place-order.ts:<line>` |
| `block-io-in-core` | positive | the domain core reads a file with `node:fs` | `BLOCK`, CRITICAL finding at `src/domain/order.ts:<line>` |
| `high-env-outside-chokepoint` | positive | a use case reads `process.env` outside `src/config/env.ts` | HIGH A8 finding at `src/application/place-order.ts:<line>`; verdict stays `PASS` (A8 is not in the closed CRITICAL catalog) |
| `pass-clean-change` | negative | a cancel-order use case that keeps every boundary | `PASS`, no findings |
| `pass-out-of-scope-sql` | negative | SQL built by string interpolation inside the adapter | `PASS`; the injection is security's job, at most a *Handoff* line |

Tags: `positive`, `negative`, `smoke` (one of each kind).

## Run

```bash
npm run evals -- architecture-review --ablation none --no-publish            # every case, 3 runs each
npm run evals -- architecture-review --case pass-clean-change --runs 1 --ablation none --no-publish
npm run evals -- architecture-review --tag smoke --runs 1 --ablation none --no-publish
```

`scripts/run-evals.mjs` wraps `claude plugin eval`: it loads the plugin together with `engineering-paved-path` (whose `defaultEnabled: false` would otherwise keep it out of the eval sandbox, so the agent's preloaded skills would be missing), runs the fixture scripts (`--scaffold`), grants `Bash` for the agent's read-only `git` and `rg` calls, and writes results to `evals/results/<timestamp>/` (git-ignored). Other options go to `claude plugin eval` unchanged.

**Cost.** Every run is a real model call on your account. The agent runs on the model in its frontmatter (`opus`) whatever `--model` says: `--model` changes only the main session that dispatches it. A pilot run cost about $0.40–0.55 and took about 70 s. Use `--ablation none`: a no-plugin arm cannot dispatch the agent at all, so it only doubles the bill. Set `--max-cost-usd` for longer runs.

**Tokens.** `aggregate-result.json` has cost and duration per run but no token counts. For tokens and API/tool calls, pass `--keep-temp` and run `npm run evals:metrics -- <results dir>/aggregate-result.json --md`: it reads the `result` line of each run's `tracePath` (`modelUsage` per model, including the subagent) and prints medians per case.

**macOS: real git required.** The cases review a git diff. Inside the eval sandbox the `/usr/bin/git` Xcode shim fails, so install git with Homebrew first ([TROUBLESHOOTING.md](../../../docs/TROUBLESHOOTING.md#common-problems)).
