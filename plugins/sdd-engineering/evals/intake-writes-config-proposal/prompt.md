---
description: 1.1.0 behavior. In a headless run without .sdd/config.json, intake writes its proposal to .sdd/config.proposed.json (never .sdd/config.json), shows the summary and stops before any spec work.
tags: [behavior]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review", "../../../security-review"]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion, Agent, Bash, Write]
---

/sdd-engineering:run-plan "Add a slugify(text) helper to src/strings.js: lowercase, trim, and join words with dashes."
