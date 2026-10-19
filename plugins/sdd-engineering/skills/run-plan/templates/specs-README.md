# <specsDir>/ — feature specifications

A spec says **what** a feature does and **why**: the problem, the scope, and EARS acceptance criteria (`AC-n`). It never lists implementation steps or files — that is the plan's job (`<plansDir>/`).

**Read the spec before implementing the feature.** It is the statement of intent; the code is only the current attempt at it.

## Written by

The `sdd-engineering:spec-creator` agent, approved by the user, driven by `/sdd-engineering:run-plan`. A feature goes through a spec before it reaches the `implementation-planner`.

## Naming & numbering

One project-wide sequence across this folder and every `<pkg>/<specsDir>/`. The file is `NNN-slug.md` and `Spec ID: SPEC-NN` shares its number. Numbers are never reused. A spec spanning more than one package, or a contract shared between packages, lives here; a single-package spec may live in that package's `<specsDir>/`.

## Lifecycle

| Status | Set by | When |
|--------|--------|------|
| `draft` | `spec-creator` | the spec is written |
| `approved` | main session | after the user's explicit yes, with *Open questions* empty |
| `implemented` | main session | when its plan becomes `done` (after a `complete` verification, or `complete — needs sign-off` once the user has accepted the listed items) |

The main session also updates the Status cell in the index below (through `sdd.sh set-status`, never by hand).

## Changelog rule

Entries are due once the spec leaves `draft`. Format: `date · section · what changed · why · source`. Written by the main session. A change to an `implemented` spec that means new work sends it back to `approved` with a new plan.

## Index

| Spec | Status | Packages |
|------|--------|----------|
