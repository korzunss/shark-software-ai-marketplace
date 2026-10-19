---
description: Smoke. run-plan starts in a project without .sdd/config.json; intake must propose a config built from what the project defines and stop at the one config question, before any spec work.
tags: [smoke]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review", "../../../security-review"]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion, Agent, Bash, Write]
---

/sdd-engineering:run-plan "Add a slugify(text) helper to src/strings.js: lowercase, trim, and join words with dashes."
