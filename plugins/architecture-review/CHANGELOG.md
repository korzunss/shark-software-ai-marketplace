# Changelog

All notable changes to this plugin are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-10-19

### Changed

- `architecture-reviewer` preloads only `onion-architecture`; the stack skills (`frontend-architecture`, `next-best-practices`, `fastify-best-practices`, `zod`, `typescript-expert`) load through the `Skill` tool only when the code in scope uses that stack, and `engineering-insights` is no longer preloaded. Enforcement commands, exceptions and dependency-cruiser instructions that duplicated `onion-architecture` now point to the skill. Checks `A1…A12`, the CRITICAL catalog, the output format and the verdict rules are unchanged.

## [1.0.0] - 2026-10-19

### Added

- `architecture-reviewer` agent: read-only review of a diff or module against generic boundary checks `A1…A12`, findings `F1…` with a *For fix mode* list, skeptic pass and a PASS/BLOCK verdict.
