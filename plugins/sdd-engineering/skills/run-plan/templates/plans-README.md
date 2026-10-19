# <plansDir>/ — Development Plans

A Development Plan says **how** a change will be built: which files, in which layer, in which order, under which skills, and how each step is known to be done. It is written by the `sdd-engineering:implementation-planner` agent, approved by the user, executed by the `implementer`, and checked item by item by the `plan-verifier` — all driven by `/sdd-engineering:run-plan`.

Plans are committed on purpose: here a plan stays readable for the implementer, the verifier, the PR reviewer and the next session — and it records what was decided and why.

## Plan or spec?

| | `<specsDir>/` | `<plansDir>/` |
|---|---|---|
| Answers | **what** and **why** — the problem, scope, acceptance | **how** — steps, files, layers, skills, checks |
| Written by | `spec-creator`, approved by the user | `implementation-planner`, approved by the user |
| Lifetime | describes the feature for as long as it exists | a record of one piece of work |

A plan that implements a spec names it in its `Spec:` line; a plan without one says `Spec: none (<reason>)` (bug fix, reviewer follow-up, no-behaviour-change refactor, tooling).

## Naming

`NN-kebab-name.md` — `NN` is the next free two-digit number in this folder (`01-…`, `02-…`). The number is the order plans were created in, nothing more.

## Lifecycle

```md
# Development Plan: <title>
Status: draft
Execution: <multi-agent | single-agent>
Spec: <<specsDir>/NNN-name.md or "none (<reason>)">
```

| Status | Meaning |
|---|---|
| `draft` | Written by the implementation-planner; may still carry open decisions. **Not executable.** A pass-1 draft ends with `Steps: pending decisions` and its index cell reads `draft (decisions)`. |
| `approved` | The user explicitly approved it (a correction is not an approval) and every open decision is resolved. |
| `in-progress` | An implementer is working on it. |
| `done` | Verified by the `plan-verifier` with result `complete` — or `complete — needs sign-off` **and** the user has accepted every listed item. |
| `abandoned` | Stopped. Say why in one line under the status. |

Only the main session changes `Status:` and this index (through `sdd.sh set-status`). It also owns *Decisions recorded*, `## Handoffs → G<n>`, `## Follow-ups` and `## Verification log` in each plan. Execution mode: any migration, shared-contract change or trust boundary → `multi-agent`; else ≤1 package and ≤5 steps → `single-agent`; else `multi-agent`; the user may override. Changing an approved plan (new files or steps, a changed decision) sends it back to `draft` for a new approval.

## Index

| Plan | Status | Spec | Packages |
|------|--------|------|----------|
