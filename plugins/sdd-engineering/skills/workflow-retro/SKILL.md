---
name: workflow-retro
description: "Main-session process retro for one finished plan: what happened, cost, what worked, what did not, proposed corrections filed as plan follow-ups. Invoke on demand via /sdd-engineering:workflow-retro <plan path>, or automatically at the /sdd-engineering:run-plan hand-over."
argument-hint: "<plan path>"
disable-model-invocation: true
user-invocable: true
version: "1.0.0"
---

# /sdd-engineering:workflow-retro — per-plan process retro

Input: `$ARGUMENTS` (the plan path, under `<plansDir>/`).

## 1. Scope and boundaries

- The **main session** writes the retro inline: no subagent, no new agent. One plan, process only (how the pipeline ran), never the product code.
- It runs on demand, or automatically at the `/sdd-engineering:run-plan` hand-over when the plan's `metrics:` line reports ≥1 flag. An **auto run** is that run-plan case: the main session Reads this file and follows §2–§3 (no Skill-tool call), and it never asks a question.
- Never writes the project's insights files (`.sdd/config.json` → `insights`), specs, agents, code, the plan's `Status:` or any other plan; never commits. Lessons worth an insights entry are listed as *insight candidates* for the `engineering-paved-path:engineering-insights` skill (its gate and routing apply).
- A mechanical failure is proposed as a guard (`sdd.sh`, its selftest, an agent template), not as a reminder to be careful.

## 2. Inputs and budget

- About 30k tokens for the whole run; the retro file is at most about 10k characters.
- Directories come from `.sdd/config.json` (`S config` prints them): `<plansDir>` (default `docs/plans`), `<retrosDir>` (default `docs/retros`).
- Read the plan **by section only**: `sed -n '/^## <heading>/,/^## /p' <plan>` for *Decisions recorded*, *Step groups*, *Follow-ups* and *Verification log*, plus its first 6 lines. Then, if it exists, `ls <plansDir>/assets/<plan basename>/` and at most the first 40 lines of each report there.
- Never read the whole plan, the spec body, code or transcripts.
- The only cost source is `sdd.sh`: `usage-scan`, `flags` and `cost`. No own arithmetic, no dollar prices, no in-context `subagent_tokens`.

## 3. Procedure

`S` below is the run-plan skill's `sdd.sh`, run from the project root:

- invoked as `/sdd-engineering:workflow-retro`: `bash "${CLAUDE_SKILL_DIR}/../run-plan/scripts/sdd.sh"` (resolved when this skill loaded; use it as written);
- in an auto run (this file was Read, so the line above is not resolved): the same `S` the run-plan session already uses.

In an auto run, check the step 6 path **before step 1**: if the file exists, run `S log <plan> "retro: skipped (exists)"` and stop — no scan, no reads, no `retro-fact:` lines, no question.

1. `S usage-scan`
2. `S flags <plan>`
3. `S cost <plan>` — quote the outputs of 1–3 verbatim.
4. Read the plan sections of §2.
5. A fact known only from the conversation is first logged with `S log <plan> "retro-fact: <fact>"` (`S state` skips `retro-fact:` lines), then cited as that log line.
6. The path is `<retrosDir>/<plan basename>` (e.g. `docs/retros/07-export.md` for `docs/plans/07-export.md`). If it exists, ask (AskUserQuestion): overwrite or stop. (An auto run already checked this before step 1.)
7. Write the file from the §4 template with the Write tool (create `<retrosDir>/` if needed); drop the HTML comments from the result.
8. File each `P<n>`: `S follow-up <plan> "retro P<n>: <change> — <where>"`.
9. `S log <plan> "retro: <path>"` — `S state` skips `retro:` lines, so a `done` plan keeps its stage.
10. Reply with the path, the `P<n>` ids and the insight candidates. In an auto run, the reply goes into the run-plan hand-over instead of a separate message.

## 4. Output template

The comments inside the fence are part of the template: they carry the caps and rules.

~~~md
# Plan NN — workflow retro (<title>)

Date: <YYYY-MM-DD> · Execution: <mode> · Sources: <plan path>, `sdd.sh usage-scan` / `flags` / `cost` (run <date>), <asset reports read>
<!-- cite: every claim ends with its source — a Verification-log date and prefix (a `retro-fact:` line included), a `path:line`, or an `sdd.sh` output line; no source, no claim -->
<!-- n/a: a metric or count that cannot be sourced from the `sdd.sh` outputs or a cited line is written `n/a`, never estimated, rounded from memory or inferred -->

## 1. What happened
| Phase | Rounds | Outcome |
|---|---|---|
<!-- cap: at most 8 rows; counts come from `agent:`, `review iteration`, `plan approved` log lines -->

## 2. Cost
<`sdd.sh cost` output, verbatim> · <`flag:` / `repeat:` lines of `sdd.sh flags`, verbatim>
<!-- cap: no figure that is not in those outputs; main-session tokens are not included — say so -->
<!-- busy: busy time and the critical path are first_ts→last_ts spans, so an agent resumed after a long gap counts its idle time — call them an upper bound, never working time -->

## 3. What worked
<!-- cap: at most 5 bullets -->

## 4. What did not work
<!-- cap: at most 6 numbered items, largest loss first; each names its cost (rounds or stage share) -->
<!-- check: walk all four before writing, each with evidence or "none found": duplicated context (the same plan, spec or files re-read by several agents or resumes; `cost` cache hit and a resumed agent's stage share) · rework and clarifying round-trips (re-approvals, `review iteration`, `fix-loop`, correction rounds, post-`done` reopenings) · scope drift (steps, groups or ACs added after approval) · failure taxonomy (tag every item mechanical / judgement / environment / spec gap) -->
<!-- check: the `unattributed` line of `sdd.sh cost` above 0 is itself an item (unlogged agents) -->
| Checklist | Finding | Source |
|---|---|---|
| duplicated context | <finding or "none found"> | <cite> |
| rework / round-trips | … | … |
| scope drift | … | … |
| failure taxonomy | <counts per tag> | … |

## 5. Proposed corrections
| # | Change | Where | Expected effect | Targets |
|---|---|---|---|---|
<!-- cap: at most 9 rows P1…; Where = an existing file or "new plan"; Targets = item numbers of section 4; a mechanical failure gets a guard; every row is also filed with `sdd.sh follow-up` -->

## 6. Open items
<!-- cap: at most 6 bullets — `repeat:` lines, unfiled follow-ups, insight candidates for engineering-paved-path:engineering-insights (never written here) -->
~~~
