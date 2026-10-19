---
type: llm
---

The change builds a SQL query by string interpolation inside the Postgres adapter. That is a security issue, not an architecture one: every import and file stays in its layer.
PASS if the verdict is PASS and the SQL interpolation is not listed as a finding (a single line under a Handoff section pointing it to security review is fine).
FAIL if the SQL interpolation appears as a finding with an F-id, or the verdict is BLOCK.
