---
name: engineering-insights
description: "Reads and writes the project's insights log (default INSIGHTS.md, per package) — the accumulated session knowledge — and keeps the distilled rules file (default insights/gotchas.md) in step. Use it at the START of any task, before planning or editing, to load what previous sessions learned about the module in question; and again at the END, to append a non-obvious finding. Trigger on: a symptom that took real effort to explain, an approach abandoned, a repo convention or dependency quirk discovered, a wrap-up request. Covers locating the insights files (.sdd/config.json or the project's own convention), routing a finding to the right log, the fixed section layout, the duplicate check, the quality gate that keeps entries specific, and updating the rules file."
---

# Engineering Insights

The insights log is what previous sessions left for this one. **Read it before
the work, write to it after.** Append-only: add entries, never rewrite or delete.

See `entry-quality.md` for the entry template, good/bad pairs, the rules-file
item format, and the pruning rules.

## Where the files live

Resolve the locations once per task, in this order:

1. **The project's own convention.** If `CLAUDE.md` or `AGENTS.md` (root or
   per package) names where session knowledge is kept, use that and map it onto
   the three roles below.
2. **`.sdd/config.json`** at the project root:
   - `insights.log` — the log file name, default `INSIGHTS.md`;
   - `insights.rules` — the rules file, default `insights/gotchas.md`;
   - `packages` — the package directories, default `["."]`.
   Both paths are relative to **each** package directory.
3. **Defaults** when neither exists: `INSIGHTS.md` and `insights/gotchas.md` at
   the project root, treated as a single package.

In the rest of this skill, `<log>` and `<rules>` mean the resolved paths and
`<pkg>` means one entry of `packages`.

**No insights files yet?** Step 0 has nothing to read: say so in one line and
carry on. Create the files only when the first finding clears the gate (Step 1):
the log from the skeleton in `entry-quality.md` → *Starting the files*, the
rules file from its template. Do not create empty files to show the skill ran.

## Three files, three jobs

| File | What it is | How it changes |
|---|---|---|
| `<pkg>/<log>` (+ root `<log>` in a multi-package repo) | **The log.** Full write-ups: symptom → cause → rule → evidence | Append-only (Step 5). Never rewritten |
| `<pkg>/<rules>` | **The current rules.** One item per rule still in force, grouped by topic, each linking to its log entry | Edited in place (Step 5b): items are added, corrected, removed |
| The package's `CLAUDE.md` / `AGENTS.md` → `Gotchas` | **The every-session minimum.** A few one-liners loaded into every session | Promotion only (Step 6) |

A rule flows one way: log → rules file → instructions file. Nothing appears in
the rules file without a log entry behind it, and nothing is promoted to the
instructions file without being in the rules file first. In a multi-package
repo there is no root rules file: cross-package rules stay in the root log.
In a single-package repo (`packages: ["."]`) the root *is* the package and has
both files.

## Step 0 — Read, before anything else

As soon as the user's request names a module or a file — and **before** planning,
searching, or editing — read, in this order:

1. `<rules>` of the package the work lands in (routing in Step 2) — the short
   list of rules in force, in full;
2. the entry headings of that package's `<log>` and of the root `<log>` —
   `grep '^### '`, not a full read.

Open a full log entry only when a rules item or a heading bears on the task. If
the request touches two packages, do this for both. Then state in one or two
lines the entries that bear on this task, or say plainly that none do (or that
the project has no insights files yet). Naming them is the proof the file was
actually read; treat them as high-confidence guidance unless the code says
otherwise.

## When to capture

- **As you go** — the moment something costs real effort: code that looks correct
  and behaves otherwise, an approach abandoned, a dependency quirk, a convention
  discovered only by reading the code.
- **Wrap-up** — at the end of a task that involved a problem, a decision, or a
  discovery.

Neither trigger is guaranteed to fire on its own — if the user asks for a wrap-up,
or a session ends with something worth recording, run this skill explicitly.

## Step 1 — Apply the gate

An entry is written **only if all three hold**:

1. **Non-obvious.** If anyone reading the code would already know it, don't write it.
2. **Evidenced.** It cites `file:line`, an error string, or a command — not a memory.
3. **Actionable cold.** A future agent reads it and knows what to do, without
   re-investigating.

Never write: a replay of what you did, a restatement of the project
instructions, a generic best practice, or an entry whose rule is "be careful".

**Writing nothing is a correct outcome.** Most sessions produce no entry. If the
session turned up nothing that clears the gate, say "no new insight" and stop —
do not manufacture one to show the skill ran, and do not add a Session Note that
only restates the task.

## Step 2 — Route it to one file

The target follows the files the task touched — check with `git diff --name-only`
(plus `git status`), not from memory.

| Touched | Target |
|---|---|
| files inside exactly one package of `packages` | `<pkg>/<log>` |
| two or more packages, shared code between packages, root scripts, root build/CI/infra config | root `<log>` |
| single-package repo | root `<log>` (the root is the package) |

One finding goes in **one** file. If it feels like it belongs in two, it's a
cross-package finding — root. The package also names the `<rules>` file that
Step 5b updates; a root entry in a multi-package repo has none.

Never read or write insights inside vendored code, checked-out third-party
repositories, or paths the project lists in `.sdd/config.json` →
`excludeFromSearch`.

## Step 3 — Pick the section

Each log carries these seven, in this order:

| Section | What belongs there |
|---|---|
| What Works | An approach that succeeded and should be reused here |
| What Doesn't Work | A dead end or antipattern — **the highest-value section, don't skip it** |
| Codebase Patterns | A convention or architectural decision, with the reason |
| Tool & Library Notes | A quirk of a dependency, CLI, or the local toolchain |
| Recurring Errors & Fixes | A symptom that will be seen again, and its fix |
| Session Notes | Dated wrap-up: what changed and what it taught, 2–4 lines |
| Open Questions | Something left unresolved, phrased so it can be picked up |

## Step 4 — Check the file before writing to it

Never append blind. Step 0 read only the headings, so read the target file in
full now and `grep` it for the subject and for the names in the evidence.

- **Already there in substance → write nothing.** Same lesson in different words
  is still the same lesson. Say it's already recorded and point at the entry.
- Related and still true, but the new finding adds something → extend that entry
  rather than adding a near-copy beside it.
- Related but now wrong → leave it, append a **correction with today's date**
  naming what changed. Never edit history.
- Nothing related → append.

## Step 5 — Append without touching anything else

**Never use Write on an existing log.** Write replaces the whole file, and one
truncated response loses every entry in it. Use Edit — an exact-string
replacement that fails loudly instead of silently clobbering. (Write is fine
only to create a log that does not exist yet.)

Entries go newest-first **within** their section, so the insertion point is the
section heading. Two cases, both anchored on text that is unique in the file:

*Empty section* — replace the placeholder, and only the placeholder:

```
old: ## What Doesn't Work\n\n_Nothing yet._
new: ## What Doesn't Work\n\n### YYYY-MM-DD — …\n**Symptom:** …
```

*Section that already has entries* — anchor on the heading plus the first line of
the current newest entry, and put the new one above it. Never paste the older
entry's body into `new_string`; keep the anchor to its `###` title line:

```
old: ## Recurring Errors & Fixes\n\n### <older date> — integration tests fail on a fresh checkout
new: ## Recurring Errors & Fixes\n\n### <today> — …\n**Symptom:** …\n\n### <older date> — integration tests fail on a fresh checkout
```

The entry itself:

```md
### YYYY-MM-DD — short title, as a symptom or an imperative
**Symptom:** what was observed.
**Cause:** why it happened.
**Rule:** what to do from now on. Omit if there's nothing to generalize.
**Evidence:** `path/to/file.ts:42` · command · error string
```

Then **verify the append was additive.** Count before you edit and after:

```sh
grep -c '^### ' <file>   # must go up by exactly 1
wc -l < <file>           # must go up, never down
git diff --numstat -- <file>   # deletions: 0, or 1 if you dropped a placeholder
```

If a count moved the wrong way, something was overwritten: restore the file
(`git checkout -- <file>`, or `git diff` to see what vanished and put it back)
and redo the edit with a narrower anchor. Report it — a silent re-append on top
of a damaged file is worse than the original mistake.

Editing an existing entry is allowed in exactly one place: Step 4's "extend".
Even then you add lines to it — you never delete or reword what is already there.

## Step 5b — Bring the rules file in step

Run this after every append to a **package** log whose entry carries a
`**Rule:**` line, and after every dated correction. (Root entries in a
multi-package repo have no rules file — skip.) Item format and topics:
`entry-quality.md` → *The rules file*.

- **New rule** → add one item under its topic heading, linking to the new entry.
- **Correction of an older entry** → edit the item that links to the old entry:
  reword the rule to what holds now and point the link at the correction. Never
  keep two items that contradict each other.
- **Rule no longer holds** (the correction says so) → delete the item. The
  history stays in the log; that is what the log is for.
- **Already covered** by an item → leave it, or tighten its wording.

Then update the `Last reconciled with <log>:` date at the top. Unlike the log,
this file *is* edited in place — use Edit anchored on the item or the heading,
never Write over the whole file. If the file does not exist yet, create it from
the template in `entry-quality.md`.

## Step 6 — Promote a standing rule

When a rule has been hit a third time, or has hardened into something everyone
must follow, add a **one-line** version under `Gotchas` in that package's
instructions file (`CLAUDE.md` or `AGENTS.md`, whichever the project uses). The
rule must already be an item in the rules file; the full write-up stays in the
log. That keeps the instructions file short without losing the reasoning.

## The two halves are not optional in the same way

Step 0 runs on **every** task in a package — the cost of reading is a few hundred
tokens, the cost of skipping it is repeating a solved problem. Steps 1–6 (with
5b) run only when the session produced something that clears the gate, which is
the minority of sessions.
