# Entry quality

Contents: the template · good vs bad · one example per section · the rules
file · starting the files · keeping the files lean.

`<log>` and `<rules>` are the resolved file locations (SKILL.md → *Where the
files live*; defaults `INSIGHTS.md` and `insights/gotchas.md`). The examples
below are illustrative: they show the shape of a good entry, not facts about
your project.

## The template

```md
### YYYY-MM-DD — short title, as a symptom or an imperative
**Symptom:** what was observed.
**Cause:** why it happened.
**Rule:** what to do from now on. Omit if there's nothing to generalize.
**Evidence:** `path/to/file.ts:42` · command · error string
```

`Symptom` and `Evidence` are mandatory — they are what makes the entry checkable
later. `Cause` may be "working as designed". Titles are searchable: write the
words someone would `grep` for when they hit it again.

## Good vs bad

The test: **if it would be obvious to anyone reading the code, don't write it.**

| ✗ Noise | ✓ Entry |
|---|---|
| "Validation can drop items." | "Items vanish between the API response and the stored record: `normalizeItems()` silently drops any item without an `id`, and the total is recomputed from the survivors. Inspect the normalizer's debug log before suspecting the client or the transport. — `src/import/normalize.ts`" |
| "Be careful with the test setup." | "A database-backed test without the integration suffix is silently skipped by the CI split (the unit job excludes `*.it.test.*`), so it passes locally and never runs in CI. Any test touching the database must carry that suffix. — `vitest.config.ts`, `.github/workflows/ci.yml`" |
| "Watch out for package managers." | "Running a different package manager than the one that owns the lockfile in that folder rewrites the lockfile and breaks the next install. Check which lockfile the folder has and use the matching tool." |
| "E2E tests are flaky." | "Three end-to-end flows pass in CI and fail locally: they follow the home redirect to the *first* record and assume the seeded demo record is the only one. Run the isolated, freshly seeded e2e script. Do **not** delete the local database volume to 'reset' — it wipes all local data." |

What the good column has that the bad one doesn't: a symptom you can recognize,
the mechanism, a named file or command, and a decision the reader can act on.

## One example per section

- **What Works** — "Swapping an adapter in tests through the DI container with
  the in-memory fakes beats stubbing the module: the container is the only seam
  the services go through."
- **What Doesn't Work** — "Keyword-scanning untrusted user content for prompt
  injection: a denylist only ever catches one phrasing. The guard text appended
  to the system prompt is the defense — don't add parsing next to it."
- **Codebase Patterns** — "Shared contracts change in the shared package first,
  then get copied to the consumer. Editing the consumer's copy alone typechecks
  and breaks at runtime."
- **Tool & Library Notes** — "The migration generator writes both the migration
  and its journal entry; hand-editing generated migration files desyncs them."
- **Recurring Errors & Fixes** — "`relation \"…\" does not exist` on a fresh
  checkout: the app never migrates on boot. Run the migrate command, then the
  seed command (idempotent)."
- **Session Notes** — "YYYY-MM-DD — Added server-sent progress events to the
  jobs module. Learned that the shared error handler must be registered before
  module plugins or stream errors serialize as JSON and break the stream."
- **Open Questions** — "Does the batch import path need its own validation pass,
  or does the single-item validator already cover it? Unverified."

## The rules file

`<pkg>/<rules>` lists the rules of one package that are **still in force** — a
curated index over the log, not a second log. It exists for readers who need
the rules, not the history: the start-of-task read, a planner's *Known gotchas*,
a reviewer's criteria.

Template (used when creating the file):

```md
# <pkg> — current gotchas

Last reconciled with <log>: YYYY-MM-DD

<Two-line intro: curated index of rules still in force; full write-ups live in
`<log>` (append-only); items are added, corrected and removed by the
`engineering-paved-path:engineering-insights` skill.>

## <Topic>
- **<the rule, 1–2 sentences>** — spot it: <the symptom you would see> — [INSIGHTS: YYYY-MM-DD — <entry title>](<relative path to log>#<anchor>)
```

- **Topics**, only those that have items, in a stable order. A reasonable
  default: DB & migrations · Contracts · Tests · Security · Tooling · UI ·
  Domain invariants. Use the project's own topics if it has them.
- **No content without a source.** Every item links to a log entry. A rule with
  no entry behind it goes into the log first.
- **About 15 items.** Past that, merge items that share a mechanism, or drop the
  ones the code now enforces on its own (a type, a lint, a test that fails).
- **Rules, not stories.** The item says what to do and how to recognise the
  trap; the why stays behind the link.

| ✗ Item | ✓ Item |
|---|---|
| "Be careful with migrations — see INSIGHTS." | "**When one table both drops and adds a column, generate the migration twice (drop first, then adds)** — spot it: the generator prints nothing and never exits — [INSIGHTS: YYYY-MM-DD — …](../INSIGHTS.md#…)" |
| A paragraph retelling the incident | One rule, one symptom, one link |

## Starting the files

When a project has no log yet and the first finding clears the gate, create
`<pkg>/<log>` with this skeleton (Write is fine here: the file is new), then
append the entry with Edit as SKILL.md Step 5 describes:

```md
# <pkg> — insights

Append-only log of non-obvious findings: symptom → cause → rule → evidence.
Maintained by the `engineering-paved-path:engineering-insights` skill. The
rules still in force are distilled into `<rules>`.

## What Works

_Nothing yet._

## What Doesn't Work

_Nothing yet._

## Codebase Patterns

_Nothing yet._

## Tool & Library Notes

_Nothing yet._

## Recurring Errors & Fixes

_Nothing yet._

## Session Notes

_Nothing yet._

## Open Questions

_Nothing yet._
```

If the entry carries a `**Rule:**` line, create `<pkg>/<rules>` from the
template above in the same pass. To use non-default locations, set
`insights.log` / `insights.rules` in `.sdd/config.json`, or name the files in
the project's `CLAUDE.md` / `AGENTS.md`.

## Keeping the files lean

- **Append-only.** Corrections are new, dated entries that name what changed. The
  old entry stays — knowing a rule *used to* hold is itself information.
  (This is about the log. The rules file is edited in place — see SKILL.md
  Step 5b.)
- **Conflicts get resolved, not accumulated.** Two entries that contradict each
  other are worse than neither: append a third that states which one holds now.
- **Promotion.** A rule everyone must follow becomes one line under `Gotchas` in
  that package's `CLAUDE.md` / `AGENTS.md`; the full write-up stays in the log.
- **Size.** Past roughly 200 entries in one file, signal drops. Prune on a
  quarterly pass: drop what the code no longer permits, merge duplicates, and
  delete Session Notes whose lesson was already promoted.
- **Reconcile the rules file on the same pass.** After pruning, walk `<rules>`:
  every link must still resolve to an entry, and every item must still hold in
  the code. Remove or reword the rest, and update the `Last reconciled` date.
- **These files are a draft under review.** They're committed and diffable on
  purpose — a wrong summary is caught in the PR, not months later.
