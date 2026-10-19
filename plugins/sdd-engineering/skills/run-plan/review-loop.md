# /sdd-engineering:run-plan — review and fix loop

Stages `review` and `fix-loop` of [SKILL.md](SKILL.md). `S` stands for the `sdd.sh` command SKILL.md §0 resolved for this session; `NN` is the plan number.

## The wave
Reviewers: `sdd-engineering:plan-verifier` ∥ `architecture-review:architecture-reviewer` ∥ `security-review:security-reviewer` (the last only when a trust boundary is touched), in parallel, each in working-tree mode (nothing is committed, so a `<base>...HEAD` diff would be empty).
1. `S porcelain save <file>` before the wave (it also snapshots HEAD, refs and the stash).
2. Path list: `S delta <prev-tree>` (first wave: the newest `wave-<n>` or `plan-approved` tree). Hand each reviewer the plan path and that list, not pasted diffs.
3. The verifier also gets the `it-suite` result and the brief check: `S brief-diff <plan> <plan-approved tree>` (exit 0 identical; 1 prints the differing lines). `Status:` and `Execution:` lines are ignored; any other brief change is a plan change.
4. `S porcelain check <file>` after the wave (HEAD, refs and stash included); a difference means a reviewer wrote to the tree — stop and show it.
Never checkpoint or edit the tree while the wave runs.

## Triage
Every finding or gap becomes a row. IDs are the reviewers' own (`D3`, `P2`, `SF1`, `F4`).

| ID | Source | Severity / status | Class | Action |
|---|---|---|---|---|
| e.g. `F4` | `architecture-reviewer` | CRITICAL / HIGH | `fix` | implementer fix mode |
| e.g. `D3` | `plan-verifier` | gap | `fix` | implementer fix mode |
| e.g. `F7` | `architecture-reviewer` | needs a file outside every step's *Files* | `plan-change` | plan back to `draft`, `implementation-planner` correction, user approval, new `plan-approved` checkpoint |
| e.g. `F9` | any | ≤1 file, ≤10 lines, file in a step's *Files* | `trivial` | main-session fix per [pipeline.md](pipeline.md) → *Trivial fixes*, log `main-session fix: <id>` |
| e.g. `F2` | any | MEDIUM / informational | `follow-up` | `S follow-up <plan> "<id>: <text>"` → `## Follow-ups` |
| e.g. `V1` | `plan-verifier` | *Needs manual check* / *Needs sign-off* | `sign-off` | shown to the user at `sign-off` |

Classes: `fix` = CRITICAL, HIGH and verifier gaps; `follow-up` = MEDIUM and informational; `sign-off` = *Needs manual check*. A skill listed on a step where it does nothing can only be closed by a plan change.

Log the verifier's result line as `S log <plan> "plan-verifier: <result>"` (`S state` reads it).

## Iteration (cap: 3)
1. Triage; if no `fix`, `plan-change` or `trivial` rows are left, go to `sign-off`.
2. Fix mode: `sdd-engineering:implementer` with the plan path and the gap ids (≤10 lines of report text in any prompt).
3. `S checkpoint <NN> review-<i>`.
4. Re-run **only** the reviewers that reported a `fix` item, with `S delta <previous iteration's tree>`; `plan-verifier` in its delta mode (previous log date + open ids).
5. `S log <plan> "review iteration <i>: fix <n>, plan-change <n>, trivial <n>, follow-up <n>, sign-off <n>, tree <sha>"`.

**Cap.** After iteration 3 with any CRITICAL or HIGH left, stop and show the user the items that did not converge; do not start a fourth iteration without their instruction.
