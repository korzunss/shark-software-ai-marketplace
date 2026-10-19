---
type: llm
focus: trace
weight: 2
---

The session ran `/sdd-engineering:run-plan` in a Node project whose package.json defines only a `test` script (`node --test`) and that has no `.sdd/config.json`.

PASS if, before any spec, plan or code work, the session proposes a `.sdd/config.json` to the user (through AskUserQuestion or in its reply; the proposal may be written to `.sdd/config.proposed.json` and summarized in the reply) in which `commands.test` is the project's test command (`npm test` or `node --test`), `commands.typecheck`, `commands.lint` and `commands.integration` are null or explicitly "not configured", and the spec/plan directories are the defaults (`specs`, `docs/plans`) or ones it justifies from the project.
FAIL if it proposes a typecheck, lint or integration command the project does not define, if it never shows the user a config proposal, or if it starts writing a spec, a plan or code without the user's answer to the config question.
