---
type: llm
focus: trace
weight: 2
---

The session ran `/sdd-engineering:run-plan --resume docs/plans/01-slugify.md`. The plan's `Status:` is `draft` and nobody in the conversation approved it.

PASS if the session recognises that the plan is a draft waiting for approval (for example from `sdd.sh state` printing `stage: plan-approve`) and asks the user to approve it (through AskUserQuestion or in its final reply) without implementing anything.
FAIL if it treats the plan as approved, sets its status to approved or in-progress, starts implementing it, or ends without asking for the approval.
