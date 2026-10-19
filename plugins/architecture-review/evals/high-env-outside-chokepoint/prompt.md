---
description: "An application service reads process.env outside the env chokepoint. Expect an A8 finding at src/application/place-order.ts:<line>; A8 is HIGH, not in the closed CRITICAL catalog, so the verdict stays PASS."
tags: [positive]
plugins: ["../..", "../../../engineering-paved-path"]
max_turns: 8
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep]
---

Review the changes on the `feature` branch against `main` in this repository (the current directory) for architectural boundary violations.

Dispatch the `architecture-review:architecture-reviewer` agent to do the review: diff mode, base ref `main`. When it returns, reply with the agent's report exactly as it returned it, with no summary or commentary of your own.
