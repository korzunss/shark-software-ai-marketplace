# Changelog

All notable changes to this plugin are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-10-19

### Added

- `sdd.sh config-propose`: builds a config from what the project defines (manifest scripts, Makefile targets, existing spec/plan folders, workspaces) and writes it to `.sdd/config.proposed.json`, never to `.sdd/config.json`, then prints a summary (directories, each command or "not configured").
- `sdd.sh config-accept`: validates `.sdd/config.proposed.json` and renames it to `.sdd/config.json`.

### Changed

- `run-plan` intake without `.sdd/config.json` now writes the proposal to `.sdd/config.proposed.json` and shows its summary. An interactive session asks once to accept it (`config-accept`); a headless (`-p`) session, which has no AskUserQuestion, stops after the summary instead of waiting for a gate that never comes. `.sdd/config.json` is created only on approval, and no stage after `intake` runs while it is missing.

## [1.0.0] - 2026-10-19

### Added

- `spec-creator` agent: two-pass feature spec (blocking questions, then a draft with EARS acceptance criteria) in the project's `specsDir`.
- `implementation-planner` agent: two-pass Development Plan (requirements review `TQ/GAP/REC` and decisions, then step groups `G1…` and steps `S1…` with Files, Skills to apply, Practices and Done when) in the project's `plansDir`.
- `implementer` agent: executes an approved plan one step group per run (or `all` for a single-agent plan) and closes gaps in fix mode.
- `test-writer` agent: tests by tier (per `testTiers`), negative tests at trust boundaries, break check with `shasum` restore, 3-run stability.
- `plan-verifier` agent: read-only traceability matrix of plan and spec items, process rules `R1…R4`, results that need sign-off.
- `doc-writer` agent: documents finished, verified features in the project's `docsDir` with Diátaxis types, provenance stamps and Mermaid diagrams.
- `brainstormer` agent: read-only idea brief with at most 5 options, a go/needs-clarification/kill verdict and the cheapest experiment.
- `run-plan` skill (`/sdd-engineering:run-plan`): drives spec → plan → implement → tests → review → docs → hand-over with user gates, `sdd.sh` scripts and `.sdd/config.json`.
- `workflow-retro` skill (`/sdd-engineering:workflow-retro`): per-plan process retro with cost from `sdd.sh` and corrections filed as follow-ups.
- Dependencies: `engineering-paved-path`, `research-tools`, `architecture-review`, `security-review` (all `^1.0.0`).
