---
description: Smoke. With .sdd/config.json present, intake asks no config question, creates the spec and plan indexes in the configured folders, and hands the request to the spec-creator agent.
tags: [smoke]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review", "../../../security-review"]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion, Agent, Bash, Write]
---

/sdd-engineering:run-plan "Add a slugify(text) helper to src/strings.js: lowercase, trim, and join words with dashes." --skip-research
