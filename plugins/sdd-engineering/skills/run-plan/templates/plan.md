<!--
Development Plan template, as the sdd-engineering agents expect it.
- Pass 1 (decisions-only draft) writes: the header, Spec traceability (Covered by = pending) or
  Goal & acceptance criteria, Requirements review, Decisions needed (last row = execution mode),
  Risks & open questions, then the line "Steps: pending decisions" and the marker. Index cell: draft (decisions).
- Pass 2 (or a single pass) replaces "Steps: pending decisions" with Prerequisites … Red-flags check,
  sets Decisions needed to "None open — see *Decisions recorded*", moves the Requirements review
  below the marker, and turns the index cell into draft.
- Everything above the implementer-brief:end marker line is what an implementer reads: self-sufficient, under ~20,000 characters.
- The Status:, Execution: lines, Decisions recorded, Handoffs, Follow-ups and Verification log belong to the main session.
Drop this comment when writing a plan.
-->
# Development Plan: <title>
Status: draft
Execution: <multi-agent | single-agent>
<!-- written by the main session from the execution-mode decision; a single pass writes `single-agent` -->
Save as: <plansDir>/NN-kebab-name.md
Spec: <<specsDir>/NNN-name.md | <pkg>/<specsDir>/NNN-name.md | "none (<reason>)">

## Spec traceability
| Spec AC | Covered by |
|---|---|
| AC-1 | S2, <test file> |
<!-- spec plans: one row per spec AC-n, no Goal or AC of your own. With
`Spec: none (<reason>)` replace this table with the next section. -->

## Goal & acceptance criteria
<!-- only when `Spec: none (<reason>)` -->
<1–3 sentences>
- AC1: <observable, checkable outcome>
- AC2: …

## Requirements review
<!-- pass 1 only; pass 2 moves it below the marker as "Requirements review (pass 1, resolved — see *Decisions recorded*)" -->
### Clarifying questions
<!-- TQ1…: technical only, each with a default so the user can answer "yes" (`TQ1 | <question> | default: <…>`), or "None." -->
### Spec gaps
<!-- GAP1…: a missing product decision, a contradiction with a project constraint, an infeasible or ambiguous requirement; each names the spec section (or "request") and goes to spec-creator, or "None." -->
### Recommendations
<!-- REC1…: a better approach, a smaller scope, lower risk, reuse of existing code; each ends `→ decision Dn` (technical) or `→ GAPn` (user-visible), or "None." -->

## Decisions needed
| # | Decision | Options | Recommendation | Steps affected |
|---|---|---|---|---|
| D1 | <what the user must decide> | A: … · B: … | A — <one-line why> | S3, S7 |
| Dn | Execution mode | multi-agent · single-agent | <rule result> — <why> | all |
<!-- technical only; a product question is a GAPn. The last row is always the execution mode (mode rule in
run-plan's pipeline.md: any migration, shared-contract change or trust boundary → multi-agent; else ≤1 package
and ≤5 steps → single-agent; else multi-agent; state what you counted). "None open — see *Decisions recorded*" after pass 2. -->

## Decisions recorded
<!-- main session only: `- <date> · <ids> → <answer> · user "<quote>"` -->

## Prerequisites
<!-- optional: new dependencies (the implementer does not install), services that must be running, a spec to read -->

## Step groups
| Group | Steps | Package / layer | Runs after | Handoff to the next group |
|---|---|---|---|---|
| G1 | S1–S3 | <package + layer> | — | <new exports / signatures / fixtures> |

## Steps
### S1 — <imperative title>  [Contract]   <!-- label only on the contract step -->
- **Files:** `path/to/file` (create | modify) — the step's owned paths
- **Change:** <what, concretely — function/type/field names>
- **Layer / why here:** <which rule decides the placement>
- **Skills to apply:** `engineering-paved-path:onion-architecture`, `engineering-paved-path:zod`   <!-- namespaced ids; `none` for Markdown-only steps -->
- **Practices:** <the checkable skill rules this step must follow>
- **Known gotchas:** <insights rules-file item → link, or "none">
- **Done when:** `<a command from .sdd/config.json → commands, or the package's own script>` · `<test file>` asserts <behaviour>
<!-- never `grep -c` thresholds; a grep on a Markdown file uses a one-token pattern or the `tr '\n' ' '` form (sdd.sh plan-lint checks it) -->

### S2 — …

## Tests
| Test file | Tier | Covers | Step |
|---|---|---|---|
<!-- tier from .sdd/config.json → testTiers (file-name patterns) -->

## Migrations & contracts
<!-- the migration-generation step and contract fields changed (+ mirror step, if the project mirrors contracts) — or "None." -->

## Out of scope
- <things the implementer must NOT do, even if they look adjacent>

<!-- implementer-brief:end -->

## Context applied
- `<file>` → "<entry title>" — how it shapes the plan (step Sx / risk)

## Skills
| Skill | Loaded | Applied in | Not used — reason |
|---|---|---|---|
<!-- one row per loaded skill — Loaded = `preload` or `on demand (<step>)` -->

## Affected modules
| Package | Module / path | Layer | New / changed |
|---|---|---|---|

## Design notes
<!-- optional: data flow, alternatives, why -->

## Risks & open questions
- <risk> — mitigation or who decides
- <doc vs code disagreements found while planning>
- <external-research questions for research-tools:researcher>

## Handed off
- architecture-reviewer: <spots worth a look>
- security review: <input parsing, auth, secrets, outbound URLs, queries — where>

## Insights to record
- <target insights file> · <section> — <finding> (`path:line`) — or "None."

## Red-flags check
- [ ] Every AC maps to at least one step or test (no-spec plans)
- [ ] Every spec AC-n has a row in *Spec traceability* with a step or test
- [ ] Every step has Files, Practices and a runnable Done when
- [ ] Every existing path was opened; every new one is marked `create`
- [ ] Every assumption is marked; technical choices are in *Decisions needed*, product gaps are GAPn
- [ ] Groups end type-checking; parallel groups share no file
- [ ] No group under 3 files / ~80 lines that could merge with a neighbour
- [ ] The brief above the marker is under ~20,000 characters
- [ ] Pass 1: only the pass-1 sections, ≤ ~6,000 characters, ends with "Steps: pending decisions"
- [ ] Execution mode recommended per the mode rule (or single pass: single-agent)
- [ ] Every step's *Skills to apply* is complete (the implementer reads only those)
- [ ] `sdd.sh plan-lint <plan>` prints `plan-lint: ok`

<!-- main-session sections below. `## Handoffs → G<n>` (or `→ all`) blocks are appended here by
`sdd.sh handoff` (the implementer's Handoff + Skills table) — never write them by hand. -->

## Follow-ups
<!-- `sdd.sh follow-up`: - <date> <id>: <text> -->

## Verification log
<!-- `sdd.sh log` / `sdd.sh agent`: - <date> <text> -->
