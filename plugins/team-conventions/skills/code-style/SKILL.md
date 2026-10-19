---
name: code-style
description: Team code-style, commit and pull-request conventions for Shark Software repositories. Use when writing or reviewing code, writing a commit message, or preparing a pull request description in a Shark Software project.
---

# Shark Software code conventions

> Starter content. Replace these rules with the team's agreed conventions and bump the plugin version.

## Code

- Match the style of the surrounding code first: naming, formatting, comment density, idioms.
- Follow the repository's formatter and linter configuration; never reformat unrelated code.
- Keep changes focused: one logical change per commit and per pull request.
- Prefer clear names over comments; comment the *why*, not the *what*.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <imperative summary, ≤ 72 chars>

<optional body: what and why>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`.

## Pull requests

A pull request description contains:

1. **What** changed, in one or two sentences.
2. **Why** — the problem or ticket it addresses.
3. **How it was tested** — commands run, screenshots for UI changes.
4. **Risks / follow-ups**, if any.
