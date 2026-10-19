---
description: Negative. A one-line edit must be done directly; the plugin must not pull it into the SDD pipeline (no SDD agents, no .sdd/ or spec/plan files).
tags: [negative]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review", "../../../security-review"]
max_turns: 8
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill, Agent, Edit]
---

In src/cart.js, rename the local variable `total` to `sum`. Change nothing else.
