# Pipeline rules: plan → implement → verify

The rules `/sdd-engineering:run-plan` follows and the `sdd-engineering` agents assume. [SKILL.md](SKILL.md) sequences the stages; this file says what each artefact means and who may change it. Directories come from `.sdd/config.json` (`S config` prints them): `<specsDir>` (default `specs`), `<plansDir>` (default `docs/plans`), `<ideasDir>` (default `docs/ideas`). Project-specific constraints (what counts as a contract, which paths are generated or protected, the stack's commands) come from the project's instructions (`CLAUDE.md`, `AGENTS.md`, per-package equivalents) and `.sdd/config.json`.

## Artefacts

| | Spec (`<specsDir>/`) | Plan (`<plansDir>/`) | Idea brief (`<ideasDir>/`) |
|---|---|---|---|
| Answers | **what** and **why** — the problem, scope, acceptance (EARS `AC-n`) | **how** — steps, files, layers, skills, checks | which approach, if any, is worth a spec |
| Written by | `sdd-engineering:spec-creator`, approved by the user | `sdd-engineering:implementation-planner`, approved by the user | `sdd-engineering:brainstormer`, saved by the main session |
| Lifetime | describes the feature for as long as it exists | a record of one piece of work | a record of one decision |
| Template | `templates/spec.md` | `templates/plan.md` | the brainstormer's own output |

A plan that implements a spec names it in its `Spec:` line. A plan never replaces a spec, and a spec never lists implementation steps. A feature plan names an approved spec. Specs and plans are committed on purpose: a plan in a session scratchpad disappears with the session; in the repo it stays readable for the implementer, the verifier, the PR reviewer and the next session — and it records what was decided and why.

**Naming.** Plans: `<plansDir>/NN-kebab-name.md`, `NN` the next free two-digit number. Specs: `NNN-slug.md` with `Spec ID: SPEC-NN` sharing the number, one sequence across `<specsDir>/` and every `<pkg>/<specsDir>/`; numbers are never reused. A spec spanning more than one package (or a contract shared between packages) lives in the root `<specsDir>/`; a single-package spec may live in `<pkg>/<specsDir>/`. Each folder keeps a `README.md` index (created at `intake` from `templates/specs-README.md` / `templates/plans-README.md`).

## Brainstorm (optional)

For a goal with no chosen approach ("should we…"), the read-only `sdd-engineering:brainstormer` returns an idea brief, never a plan. The main session saves **every** brief, `kill` included, verbatim to `<ideasDir>/NN-kebab-name.md` plus its index row, adding only `Status:` and `## Choice recorded`. A correction re-runs `brainstormer` with the brief's path; it returns only the changed sections. *Facts needed* seed the researcher's ≤8 questions, and the brief's path goes to `spec-creator` first (for a feature), then to the `implementation-planner`.

## Spec stage

For every feature, before research and planning: `spec-creator` pass 1 returns ≤8 blocking questions and writes no file; after the user answers, pass 2 writes the spec (`Status: draft`). The main session sets `approved` only on the user's explicit yes with *Open questions* empty, then **asks** whether to run research (default yes), then the `implementation-planner` gets the spec path. A bug fix, verifier/reviewer follow-up, no-behaviour-change refactor or tooling plan skips it with `no spec: <reason>`.

| Spec status | Set by | When |
|---|---|---|
| `draft` | `spec-creator` | the spec is written |
| `approved` | main session | after the user's explicit yes, with *Open questions* empty |
| `implemented` | main session | when its plan becomes `done` |

Changelog entries are due once the spec leaves `draft`, written by the main session: `date · section · what changed · why · source`. A change to an `implemented` spec that means new work sends it back to `approved` with a new plan. A spec with legacy front-matter (`status: draft | active | done`) is kept as is: `active` maps to `approved`, `done` to `implemented` (`sdd.sh set-status` handles both).

## Research

Research before planning is **repo-mode only** (≤8 questions to `research-tools:researcher`). External research runs for the questions pass 1's *Risks & open questions* lists, after the user answers *Decisions needed* and before pass 2, as a separate researcher run.

## Plan lifecycle

| Status | Meaning |
|---|---|
| `draft` | Written by the implementation-planner; may still carry open decisions. **Not executable.** |
| `approved` | The user explicitly approved it (a correction to a draft is not an approval) and every open decision is resolved. |
| `in-progress` | An implementer is working on it. |
| `done` | Verified by the `plan-verifier` with result `complete` — or `complete — needs sign-off` **and** the user has accepted every item on its *Needs sign-off* list. Never on its own. |
| `abandoned` | Stopped. Say why in one line under the status. |

`draft → approved → in-progress → done` (or `abandoned` from any of them). Only the main session changes `Status:`, through `sdd.sh set-status`, which also updates the index row.

**Pass 1.** For every non-trivial plan the `implementation-planner` first writes a decisions-only draft (`Status: draft`, body ending `Steps: pending decisions`, index cell `draft (decisions)` — not a new status value): a requirements review (`TQn` clarifying questions, `GAPn` spec gaps, `RECn` recommendations) and *Decisions needed*, whose last row is the execution mode. It returns only a summary. It skips straight to the full plan only when the prompt says `single pass: <reason>`, and only for a trivial plan (≤1 package, ≤3 files), which gets `Execution: single-agent`. A `GAPn` and any user-visible `RECn` go to `spec-creator` before pass 2 (the main session sets an approved spec back to `draft`, writes the Changelog entry, re-approves).

**Pass 2** resumes the same implementation-planner (fallback: a fresh run with the plan path) once every `TQn` is answered and every `GAPn` closed, and fills in the full template in the **same file**; the index cell becomes plain `draft`. In both passes the planner writes no other file. Later correction rounds edit the plan in place and return only the changed sections.

**Who writes what.** The planner writes the plan and its index row. The `Status:` line, the `Execution:` line, *Decisions recorded*, `## Handoffs → …`, `## Follow-ups` and `## Verification log` belong to the **main session**. The user's answers and corrections are written **into the plan**, not left in the conversation. A correction is not an approval. Nothing is implemented from a `draft`.

**Who reads it.** The `implementer` and the `plan-verifier` get the plan's **path**, never a pasted copy, and both refuse a `draft`. Neither edits the plan.

## Execution mode

`Execution: multi-agent` is the full pipeline: one implementer run per step group (`G1`, then `G2`, …), then `test-writer`, reviewers as their rules require, then `plan-verifier`. `Execution: single-agent` is one implementer run with `all`, then `plan-verifier`; reviewers still run on their own triggers. A plan with no `Execution:` line is `multi-agent`.

**Mode rule**, in this order: any migration, change to a contract shared between packages, or trust boundary → `multi-agent`; else ≤1 package and ≤5 steps → `single-agent`; else `multi-agent`. The planner recommends it (last *Decisions needed* row, stating what it counted); the user may override; the main session records it as the header line.

## Implementation and handoffs

The status moves to `in-progress` when the first implementer run starts. Hand-offs between groups go **into the plan**, not into prompts: the main session appends each implementer's *Handoff to the next group* — and its `## Skills` table, the `plan-verifier`'s source for the `SK` items — under `## Handoffs → G<n>` (`## Handoffs → all` for a single-agent plan) below `<!-- implementer-brief:end -->`, and the next prompt is just the plan path and the group. Never paste more than ~10 lines of one agent's report into another agent's prompt; cite gap ids and paths.

**Full integration run.** Implementers run only the integration tests related to their group (or run). After the last run, in both modes, the main session runs `.sdd/config.json` → `commands.integration` once (or logs "not configured") and hands the plan path — and that run's result — to the `plan-verifier`.

## Review

`security-review:security-reviewer` runs when a trust boundary is touched (or on demand before a PR), in a fresh context with the plan path and the changed paths, in parallel with `architecture-review:architecture-reviewer`; its `SF` findings go to fix mode the same way. A dependency audit that needs the network runs in the main session, not the agent.

## Fix mode and plan changes

Gaps from the verifier or either reviewer go back to the `implementer` in **fix mode** (plan path + gap ids).

**Changing an approved plan.** A change that adds files or steps, or changes a recorded decision, sends the plan back to `draft`: the implementation-planner edits the changed sections in the file and lists them, and the user approves again (a new `plan-approved` checkpoint). A clarification that stays inside the approved steps' *Files* and decisions does not. The same rule covers fix mode: a gap the implementer can close only by touching a file outside every step's *Files* comes back as a *Suggested plan change*, not as a fix.

**Trivial fixes skip the implementer.** A gap or approved plan change that touches ≤1 file and ≤10 lines, where that file is already in some step's *Files* and the change is not a contract, migration, vendored-code or lock-file edit (nor a path in `.sdd/config.json` → `protectedPaths`), is applied by the main session. It runs that step's Done-when and logs the change in the plan's Verification log as `main-session fix: <id>`; the next plan-verifier run checks it like any other change.

**Re-verification is a delta.** After fix mode, call `plan-verifier` in delta mode (previous result + open gap ids); a full pass runs once per wave of implementation, not after every fix.

## Sign-off and close

The `plan-verifier` result is `complete`, `complete — needs sign-off`, or gaps. *Needs manual check* / *Needs sign-off* items are shown to the user, who accepts or declines each (declined → fix mode or a follow-up). Only then does the main session set the plan to `done` and the spec to `implemented`, with a spec Changelog line.
