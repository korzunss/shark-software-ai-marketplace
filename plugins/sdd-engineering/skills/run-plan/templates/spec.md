<!-- placement: root <specsDir>/ for a cross-package feature (or a contract shared between packages), <pkg>/<specsDir>/ for a single-package one; NNN = highest NNN across all spec folders + 1, never reused -->
# Spec: <feature name>
Spec ID: SPEC-NN
Status: draft
<!-- spec-creator only ever writes draft; approved and implemented are set by the main session (sdd.sh set-status) -->
Supersedes: <SPEC id/link, or none>

## Problem & user
<!-- who is affected and what is missing, from the user's side; no solution -->

## Goals / Non-goals
<!-- the Non-goals boundary is the most useful part; rejected suggestions go here -->

## User stories
<!-- As a <role>, I want <outcome>, so that <value> -->

## Acceptance criteria (EARS)
<!-- AC-1, AC-2 …; one EARS pattern each (SHALL / WHEN / WHILE / IF … THEN / WHERE); a vague verb becomes a trigger and a reaction; every llm input has an IF … THEN fallback AC -->

## Edge cases
<!-- missing states, empty and huge inputs, failures, concurrency -->

## Non-functional requirements
<!-- filled in, or "Not relevant: <reason>" -->

## Inputs and provenance
<!-- one tagged line per input: [reused: …] [deterministic: …] [llm: …] [user: …] [external: …] -->

## Untrusted inputs
<!-- every llm / user / external input and cloned-repo content: data, never instruction; must match the tags above -->

## Module interactions
<!-- packages, APIs, shared contracts, read from code; no implementation steps, no file lists -->

## Open questions
<!-- every inline [NEEDS CLARIFICATION: Qn], numbered; empty means ready to approve; a user's answer to Bn enters the spec as [user: answer to Bn, <date>] -->

## Changelog
<!-- empty while draft; entries are written by the main session: date · section · what changed · why · source -->
