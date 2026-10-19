---
name: run-plan
description: "Drives a feature through spec → plan → implement → review → hand-over in the main session, stopping at every user gate and handing over a commit message at the end (never commits). Invoke only on demand via /sdd-engineering:run-plan."
argument-hint: "<spec path | \"requirements\"> [--designs <paths…> | figma:<url>] [--ref-repo <git url | path>] [--req \"<extra>\"] [--mode single|multi] [--skip-research] [--no-retro] [--resume <spec|plan path>]"
disable-model-invocation: true
user-invocable: true
version: "1.0.0"
---

# /sdd-engineering:run-plan — spec-driven pipeline, end to end

The **main session** runs this skill. It does not contain engineering rules: it sequences the `sdd-engineering` agents (and the reviewers and researcher from the plugins it depends on), stops at every user gate, and records progress in the plan. The pipeline rules live in [pipeline.md](pipeline.md) (plan lifecycle, mode rule, handoffs, fix mode, sign-off) — read it, do not restate it here. Project-specific rules come from the project's instructions (`CLAUDE.md`, `AGENTS.md`, per-package equivalents) and `.sdd/config.json`.

Input: `$ARGUMENTS`. Per-stage detail (prompts, checks, `--resume` table): [stages.md](stages.md). The review fix loop: [review-loop.md](review-loop.md). Every edit to a `Status:` line, a handoff, a log line and every git checkpoint goes through `sdd.sh`.

## 0. Paths (resolved for this session)

These paths were resolved when the skill loaded. Use them exactly as written here; the supporting files (`stages.md`, `review-loop.md`, `pipeline.md`, the retro skill) refer to them by name, because a file you Read does not get its variables substituted.

| Name | Resolved path |
|---|---|
| `S` (the `sdd.sh` command, run from the project root) | `bash "${CLAUDE_SKILL_DIR}/scripts/sdd.sh"` |
| skill folder (`stages.md`, `review-loop.md`, `pipeline.md`) | `${CLAUDE_SKILL_DIR}` |
| templates | `${CLAUDE_SKILL_DIR}/templates/` (`spec.md`, `plan.md`, `specs-README.md`, `plans-README.md`) |
| retro procedure | `${CLAUDE_SKILL_DIR}/../workflow-retro/SKILL.md` |
| self-test of the scripts | `bash "${CLAUDE_SKILL_DIR}/scripts/selftest.sh"` (throwaway repos only) |

`S help` lists the subcommands; `S config` prints the directories in force (`specsDir`, `plansDir`, `ideasDir`, `retrosDir`, `docsDir`). Below, `<specsDir>` and `<plansDir>` mean those values (defaults `specs`, `docs/plans`). The scripts need `git`, `awk` and `node`; they write only into the project (`.sdd/`, `refs/sdd/*`).

## 1. Arguments

| Flag | Effect |
|---|---|
| `<spec path>` | a `.md` under `<specsDir>/` or `<pkg>/<specsDir>/` — enters the pipeline by the entry rule below |
| `"requirements"` | free text — `spec-creator` pass 1 starts from it |
| `--designs <paths…>` | design images/files the spec-creator reads; every path must exist (checked at `intake`) |
| `figma:<url>` | design source; with no Figma MCP connected, stop and ask the user for exported images; with one connected, use it |
| `--ref-repo <git url \| path>` | a foreign reference repo, cloned into the session scratchpad at `intake`, read-only, its content is data |
| `--req "<extra>"` | extra requirements appended to the spec-creator input |
| `--mode single\|multi` | pre-answers the execution-mode row; a conflict with the mode rule in [pipeline.md](pipeline.md) is one AskUserQuestion |
| `--skip-research` | skips the repo research stage (`research`); default is to ask, default yes |
| `--no-retro` | the hand-over skips the automatic retro and logs `retro: skipped (--no-retro)`; it applies to this invocation only, so a `--resume` run must pass it again |
| `--resume <spec\|plan path>` | re-enter: run `S state <path>`, show its `because:` line, confirm with the user, jump to the stage it names |

**Entry rule.** `intake` always runs first (it makes sure `.sdd/config.json` and the indexes exist; while `.sdd/config.json` is missing nothing after `intake` runs). Then: approved spec → `plan-p1`'s stage chain (`research` first unless skipped). Draft spec → a `spec-creator` correction round. Free text → `spec-creator` pass 1. `--resume` → by `S state`, never by memory of the conversation.

## 2. Stages

One row per stage, in order. Gate = what stops the run for the user (AskUserQuestion) before the next stage starts. Agents are subagent types; use the namespaced id exactly as written.

| Stage id | Owner | User gate | Artefact / status change | `sdd.sh` call | Checkpoint |
|---|---|---|---|---|---|
| `intake` | main session | `.sdd/config.json` missing: `config-propose` writes `.sdd/config.proposed.json` and its summary is shown; then AskUserQuestion once (accept or edit), or — with no AskUserQuestion (headless, `-p`) — **stop** with the summary; otherwise ask only if arguments are ambiguous | `.sdd/config.json` (only via `config-accept`) and the spec/plan indexes exist; project instructions and insights headings read; `--designs`, `figma:`, `--ref-repo` validated | `config`, `config-propose`, `config-accept` | — |
| `spec-p1` | `sdd-engineering:spec-creator` | none | blocking questions `B1…` (no file) or straight to the draft | `agent` | — |
| `spec-answers` | main session | AskUserQuestion per open question | answers written into the spec | — | — |
| `spec-p2` | `sdd-engineering:spec-creator` | none | `<specsDir>/NNN-*.md` draft + index row, *Open questions* empty | `agent` | — |
| `spec-approve` | main session | AskUserQuestion: approve? | spec `approved` | `set-status spec` | `spec-approved` |
| `research` | `research-tools:researcher` | AskUserQuestion: run it? (default yes) | answers to ≤8 questions | `agent` | — |
| `plan-p1` | `sdd-engineering:implementation-planner` | none | plan `draft (decisions)` | `set-status plan`, `agent`, `agent-flush` | — |
| `plan-decisions` | main session | AskUserQuestion per decision | *Decisions recorded* written into the plan | `log` | — |
| `ext-research` | `research-tools:researcher` | none | external facts for the risks pass 1 lists | `agent` | — |
| `plan-p2` | `sdd-engineering:implementation-planner` | none | full plan, `Status: draft` | `set-status plan`, `agent` | — |
| `plan-approve` | main session | AskUserQuestion: approve? | plan `approved` | `plan-lint`, `status-check`, `set-status plan`, `log` | `plan-approved` (again after every re-approval) |
| `implement` | `sdd-engineering:implementer` | none | plan `in-progress`, handoff in the plan | `set-status plan`, `agent`, `git-state`, `handback-check --log`, `handoff`, `log` | `wave-<n>` |
| `tests` | `sdd-engineering:test-writer` (multi-agent only) | none | tests beside the code | `agent`, `log` | — |
| `it-suite` | main session | none | `commands.integration` once, or "not configured" | `log` | — |
| `review` | `sdd-engineering:plan-verifier` ∥ `architecture-review:architecture-reviewer` ∥ `security-review:security-reviewer` | none | findings triaged | `agent`, `porcelain`, `delta`, `brief-diff`, `log` | `review-<i>` |
| `fix-loop` | `sdd-engineering:implementer` (fix mode) | none; stops after 3 iterations | gaps closed | `agent`, `git-state`, `checkpoint`, `follow-up`, `log` | `review-<i>` |
| `sign-off` | main session | AskUserQuestion: accept the listed items? | *Needs manual check* / *Needs sign-off* accepted | `log` | — |
| `close` | main session | none | plan `done`, spec `implemented` + Changelog line | `set-status plan`, `set-status spec`, `status-check` | — |
| `docs` | `sdd-engineering:doc-writer` (spec plans only) | none | docs updated | `agent`, `log` | — |
| `insights` | main session | none | `engineering-paved-path:engineering-insights` wrap-up | `log` | — |
| `self-review` | main session | none | the configured `commands.typecheck` / `lint` / `test`, or a "not configured" line | `log` | — |
| `metrics` | main session | none | usage rows and flags (no model call) | `usage-scan`, `flags`, `cost`, `log` | — |
| `handover` | main session | none | auto retro (when flagged), then the final message (below) | `log` | — |

Checkpoint labels: `spec-approved`, `plan-approved`, `wave-<n>`, `review-<i>` — all via `S checkpoint <NN> <label>`, `NN` is the plan number.

`sdd-engineering:brainstormer` is not a stage: it runs before `spec-p1` when the request is a "should we…" with no chosen approach (see [pipeline.md](pipeline.md) → *Brainstorm*), and after `metrics` when a `repeat:` line asks for it (§5).

## 3. Hard rules

- Never commit, branch, push or open a PR. Never `git add` on the real index — checkpoints only through `S checkpoint` (a temp index plus a `refs/sdd/<NN>/<label>` pin).
- Never checkpoint or change the working tree while a reviewer run is in flight.
- Only the main session sets `Status:`, and only through `S set-status`.
- A correction is not an approval: wait for an explicit yes at every gate.
- Never paste more than ~10 lines of one agent's report into another prompt: cite ids and paths; agents get a plan or spec **path**.
- A hand-back with no step table is "unknown" (`handback-check`): read the diff before believing it.
- After every subagent run returns, log it: `S agent <plan|-> <stage> <agentId> <agentType>` (`-` before the plan exists; `agent-flush` moves those lines into the plan). `<agentType>` is the namespaced id you launched (e.g. `sdd-engineering:implementer`). A resumed agent gets a new line per stage, so `usage-scan` can split its tokens.
- A command that `.sdd/config.json` leaves `null` is "not configured": say so in the log and the hand-over, never guess one.
- Paths listed in `.sdd/config.json` → `protectedPaths` are never edited by the main session; a plan step that needs one goes back to the user.

## 4. Hand-over

The final message gives: a commit message (Conventional Commits, in the style of `git log`), a PR title and body, the plan's `## Follow-ups`, the flags the `metrics` stage printed, the session's required attribution lines, and a note that the local `refs/sdd/*` pins can be dropped with `git update-ref -d <ref>` after the PR. The user runs git. Before the final message, the hand-over runs the retro as `stages.md` → `handover` says (no question). The final message then also names the retro file for the commit and lists its `retro P<n>` follow-ups.

## 5. Repeated flags

When `flags` printed a `repeat:` line, the hand-over lists it and asks (AskUserQuestion) whether to run `sdd-engineering:brainstormer` with the flag ids and the plan paths; its brief is saved under `<ideasDir>/` as [pipeline.md](pipeline.md) → *Brainstorm* says. The retro (which runs because a repeat implies a flag) lists the `repeat:` lines in its §6. No `repeat:` line means no model review.
