# Cost baseline and one optimization

A fixed eval set, run several times on the same model, before and after **one** change. The question is whether `architecture-reviewer` can get cheaper or faster without missing what it must catch.

All numbers come from `claude plugin eval` results and their traces, summarized with `npm run evals:metrics` (medians per run; ranges are min–max).

## Setup

| | |
|---|---|
| Date | 2026-10-19 |
| Claude Code | 2.1.303 |
| Machine | macOS, Homebrew git 2.56.0 (see [Invalid first attempt](#invalid-first-attempt)) |
| Runner | `npm run evals -- <plugin> --runs <n> --model sonnet --ablation none --keep-temp`, runs sequential (`-j 1`) |
| Models | Main session: `sonnet` (`claude-sonnet-5-5`, fixed with `--model`). `architecture-reviewer` subagent: `opus` (`claude-opus-5-5`, from its frontmatter, unchanged; `--model` does not reach subagents) |
| LLM graders | `haiku`, 3 votes each; their cost (`judgeCostUsd`) is not included below |

## Eval set and quality gate

`plugins/architecture-review/evals/`: one onion-style TypeScript fixture, a clean commit on `main` and one change on `feature`; the agent reviews the diff.

| Case | Kind | Must |
|---|---|---|
| `block-service-imports-adapter` | positive | `BLOCK`, CRITICAL finding at `src/application/place-order.ts:<line>` |
| `block-io-in-core` | positive | `BLOCK`, CRITICAL finding at `src/domain/order.ts:<line>` |
| `high-env-outside-chokepoint` | positive | HIGH A8 finding with `path:line`, verdict `PASS` (no severity inflation) |
| `pass-clean-change` | negative | `PASS`, no invented findings |
| `pass-out-of-scope-sql` | negative | `PASS`; SQL injection in an adapter is security's job |

**Quality gate.** Pass rate 100% on 5 × 5 runs, and **no critical false negatives**: a missed `BLOCK` on either positive CRITICAL case fails the optimization, whatever it saves.

**Decision rule.** The change passes only if the gate stays green and cost or latency drops by more than run-to-run noise. A difference inside the min–max ranges of both runs counts as noise.

## Baseline: `architecture-review` 1.0.0

Commit `70f0c45` (`feat/plugin-evals`). 25 runs, total $8.09.

| Case | Runs | Pass | Cost, $ | Latency, s | Output tok | Cache read | Cache write | API calls | Tool calls |
|---|---|---|---|---|---|---|---|---|---|
| block-io-in-core | 5 | 100% | 0.32 (0.32–0.39) | 49 (46–58) | 4,019 | 199,006 | 45,993 | 6 | 5 |
| block-service-imports-adapter | 5 | 100% | 0.34 (0.33–0.34) | 53 (48–66) | 4,778 | 201,521 | 47,303 | 6 | 5 |
| high-env-outside-chokepoint | 5 | 100% | 0.31 (0.30–0.32) | 43 (39–61) | 3,787 | 197,844 | 45,667 | 6 | 5 |
| pass-clean-change | 5 | 100% | 0.33 (0.32–0.35) | 49 (41–54) | 4,062 | 201,548 | 48,267 | 6 | 5 |
| pass-out-of-scope-sql | 5 | 100% | 0.30 (0.30–0.30) | 43 (39–48) | 3,139 | 198,396 | 45,168 | 6 | 5 |
| **All** | 25 | **100%** | **0.32 (0.30–0.39)** | **48 (39–66)** | 3,912 | 199,235 | 46,406 | 6 | 5 |

Uncached input is 14 tokens per run: everything else is served from or written to the prompt cache. Critical errors: none. Cost by model: opus (the subagent) $6.25, sonnet (main session) $1.83.

Where the cost is: on every dispatch the subagent starts with its 17.8 KB prompt **plus seven preloaded skills** (`skills:` frontmatter, 64.7 KB): `engineering-insights`, `onion-architecture`, `frontend-architecture`, `next-best-practices`, `fastify-best-practices`, `zod`, `typescript-expert`. Most of that is stack guidance that a given diff never needs, and parts of the prompt repeat `onion-architecture`.

## The change: `architecture-review` 1.1.0

One change, as the lab asks: remove duplicated instructions from the agent prompt and keep the details in skills that load on demand. Model and routing are unchanged.

- Preloaded skills: 7 → 1 (`onion-architecture`, which carries the layer map, the A1–A10 checks and the CRITICAL catalog).
- `frontend-architecture`, `next-best-practices`, `fastify-best-practices`, `zod` and `typescript-expert` are loaded through the `Skill` tool only when the diff touches that stack (a table in Step 0 of the prompt). `engineering-insights` is dropped: the reviewer never writes insights, it only returns candidates.
- The prompt's copies of the `onion-architecture` command templates (A5, A6), the exceptions-and-drift section and the dependency-cruiser paragraph are replaced with references to the skill.
- Kept as is: the A1–A12 table, the CRITICAL catalog, the skeptic pass, evidence rules, the report format, PASS/BLOCK, `model: opus`.
- The only tool change: `Skill` added to `tools`, which on-demand loading needs. No routing change: the same agent on the same model handles the same requests.

What the subagent gets at the start: 82.5 KB → 37.7 KB (−54%).

## After: `architecture-review` 1.1.0

Commit `574b7ef` (`feat/architecture-reviewer-lean`, later rebased), same eval set, same flags. 25 runs, total $6.23.

| Case | Runs | Pass | Cost, $ | Latency, s | Output tok | Cache read | Cache write | API calls | Tool calls |
|---|---|---|---|---|---|---|---|---|---|
| block-io-in-core | 5 | 100% | 0.24 (0.24–0.29) | 56 (42–64) | 3,925 | 151,088 | 33,389 | 6 | 5 |
| block-service-imports-adapter | 5 | 100% | 0.26 (0.26–0.27) | 53 (47–63) | 4,658 | 154,406 | 34,785 | 6 | 5 |
| high-env-outside-chokepoint | 5 | 100% | 0.24 (0.24–0.25) | 45 (40–72) | 3,857 | 151,714 | 33,292 | 6 | 5 |
| pass-clean-change | 5 | 100% | 0.26 (0.25–0.27) | 51 (42–60) | 4,009 | 185,698 | 35,133 | 7 | 6 |
| pass-out-of-scope-sql | 5 | 100% | 0.23 (0.22–0.23) | 41 (36–61) | 3,137 | 151,285 | 32,412 | 6 | 5 |
| **All** | 25 | **100%** | **0.25 (0.22–0.29)** | **49 (36–72)** | 3,964 | 151,801 | 33,608 | 6 | 5 |

Critical errors: none. Cost by model: opus $4.42, sonnet $1.80.

## Result

| Metric (median per run) | 1.0.0 | 1.1.0 | Change | Beyond noise? |
|---|---|---|---|---|
| Pass rate | 100% (25/25) | 100% (25/25) | — | gate green |
| Critical false negatives | 0 | 0 | — | gate green |
| Cost | $0.32 | $0.25 | **−22%** | **yes**: in every case the 1.1.0 maximum is below the 1.0.0 minimum |
| Subagent (opus) cost, total of 25 | $6.25 | $4.42 | −29% | yes |
| Main session (sonnet) cost, total of 25 | $1.83 | $1.80 | −2% | no, unchanged as expected |
| Cache write tokens | 46,406 | 33,608 | −28% | yes |
| Cache read tokens | 199,235 | 151,801 | −24% | yes |
| Output tokens | 3,912 | 3,964 | +1% | no |
| API calls / tool calls | 6 / 5 | 6 / 5 | — | no |
| Latency | 48 s (39–66) | 49 s (36–72) | +1 s | **no: within noise** |

**Verdict: the optimization passes on cost.** The quality gate is green, no critical false negatives appeared, and the cost per review fell by about a fifth, all of it in the subagent, where the preloaded context was. **Latency did not improve**: the difference is one second inside overlapping ranges, so it is recorded as no change. A smaller prompt is mostly served from cache, so it saves money (cache writes and reads are billed) more than time; the time goes to the model's own output, which did not change.

Limits of this result:

- The fixture is a TypeScript backend with no React, Next.js, Fastify-schema or Zod changes, so no on-demand `Skill` load was triggered in the 25 runs. The saving on a frontend diff will be smaller, because the agent then loads the skill it needs. These evals do not measure that case.
- 5 runs per case on one machine. Enough to separate a 22% cost drop from noise; not enough to claim a latency change in either direction.
- Grader cost (haiku, $0.01–0.02 per run) is excluded from both sides.

## Reference baseline: `sdd-engineering`

No optimization here; recorded so later changes have something to compare to. Main session `sonnet`; `spec-creator` runs on `opus`.

**1.0.0** (`70f0c45`, 5 runs per case, total $3.68): pass rate 95% (19/20).

| Case | Pass | Cost, $ | Latency, s | API calls | Tool calls |
|---|---|---|---|---|---|
| negative-draft-plan-no-implement | 5/5 | 0.16 (0.16–0.17) | 33 (25–49) | 4 | 6 |
| negative-unrelated-request | 5/5 | 0.07 (0.07–0.07) | 7 (5–15) | 4 | 3 |
| smoke-intake-proposes-config | 5/5 | 0.16 (0.15–0.16) | 26 (19–31) | 4 | 5 |
| smoke-seeded-config-starts-spec | 4/5 | 0.40 (0.16–0.43) | 92 (29–113) | 12 | 20 |

The failed run is environmental, not a false negative: the eval sandbox denied the Bash command that copies the index templates, and the skill stopped and asked instead of working around it, as its rules require.

**1.1.0** (`37a73ab`, 3 runs per case, total $2.73): pass rate 100% (15/15). The new case `intake-writes-config-proposal` fails on 1.0.0 (0/3, $0.14 per run: 1.0.0 never writes `.sdd/config.proposed.json`) and passes on 1.1.0 (3/3, $0.14, 15 s). The other four cases keep their 1.0.0 cost and latency within noise.

## Invalid first attempt

The first baseline (same commit, $12.63) is discarded. On macOS, `/usr/bin/git` is the Xcode `xcrun` shim; the eval sandbox blocks the cache file it writes, so every `git` call failed. The reviewer could not read the diff and twice answered "BLOCK once the diff confirms it" instead of `BLOCK` (92% pass rate), and `sdd.sh` stopped at intake in two cases (45%). After installing Homebrew git, which the sandbox's `PATH` finds first, all runs above were repeated from scratch. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#common-problems).

## Reproduce

```bash
brew install git                     # macOS only
npm run evals -- architecture-review --runs 5 --model sonnet --ablation none --no-publish --keep-temp --max-cost-usd 20
npm run evals:metrics -- plugins/architecture-review/evals/results/<timestamp>/aggregate-result.json --md
```

Total spend for this experiment, including the invalid attempt and pilots: about $35.
