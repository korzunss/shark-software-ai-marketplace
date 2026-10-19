# Changelog

All notable changes to this plugin are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-19

### Added

- `security-reviewer` agent: read-only source-to-sink security review of a diff or module, findings `SF1…` with confidence ≥ 0.8, filter and skeptic passes, and a PASS/BLOCK verdict.
- `appsec-review` skill: generic check catalog `X1…X17` (incl. LLM prompt injection and model output), never-report list `NR1…NR13` plus project additions `NRP#`, and the `.sdd/security.md` format for project trust boundaries.
