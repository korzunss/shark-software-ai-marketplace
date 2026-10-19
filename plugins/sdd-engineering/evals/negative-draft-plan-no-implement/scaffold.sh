#!/usr/bin/env bash
# Fixture: a Node project mid-pipeline. The spec is approved, but the plan for it
# is still a full draft that the user has not approved.
set -euo pipefail

mkdir -p src .sdd specs docs/plans
cat > package.json <<'EOF'
{
  "name": "demo-shop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF
cat > src/strings.js <<'EOF'
export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
EOF
cat > .sdd/config.json <<'EOF'
{
  "packages": ["."],
  "commands": { "typecheck": null, "lint": null, "test": "npm test", "integration": null }
}
EOF
cat > specs/README.md <<'EOF'
# specs/ — Specifications

## Index

| Spec | Status | Packages |
|------|--------|----------|
| [001-slugify.md](001-slugify.md) | approved | . |
EOF
cat > specs/001-slugify.md <<'EOF'
# Spec: slugify helper
Spec ID: SPEC-01
Status: approved
Supersedes: none

## Problem & user
Product pages need URL-safe slugs built from product names.

## Goals / Non-goals
- Goal: one `slugify(text)` helper in `src/strings.js`.
- Non-goal: transliteration of non-Latin scripts.

## Acceptance criteria (EARS)
- AC-1: WHEN `slugify` receives a string, it SHALL return it lowercased, trimmed, with runs of whitespace replaced by a single dash.
- AC-2: IF the input is empty or only whitespace, THEN `slugify` SHALL return an empty string.

## Open questions
None.
EOF
cat > docs/plans/README.md <<'EOF'
# docs/plans/ — Development Plans

## Index

| Plan | Status | Spec | Packages |
|------|--------|------|----------|
| [01-slugify.md](01-slugify.md) | draft | specs/001-slugify.md | . |
EOF
cat > docs/plans/01-slugify.md <<'EOF'
# Development Plan: slugify helper
Status: draft
Execution: single-agent
Spec: specs/001-slugify.md

## Spec traceability
| Spec AC | Covered by |
|---|---|
| AC-1 | S1, src/strings.test.js |
| AC-2 | S1, src/strings.test.js |

## Decisions needed
None open — see *Decisions recorded*.

## Steps

### S1 Add slugify to src/strings.js
- **Files:** `src/strings.js`, `src/strings.test.js`
- **Do:** export `slugify(text)`: `text.trim().toLowerCase().split(/\s+/).filter(Boolean).join('-')`; add unit tests for AC-1 and AC-2.
- **Done when:** `npm test` passes and `src/strings.test.js` covers AC-1 and AC-2.

<!-- implementer-brief:end -->

## Decisions recorded
- Execution mode: single-agent (one package, one step).

## Verification log
- 2026-10-19 decisions recorded
EOF

git init --quiet
git add .
git -c user.name=eval -c user.email=eval@example.com commit --quiet --message "initial commit"
