---
type: llm
---

PASS if the report has a finding that src/application/place-order.ts reads process.env outside the env chokepoint (src/config/env.ts), with severity HIGH (env reads outside chokepoints are not in the closed CRITICAL catalog), and the verdict is PASS.
FAIL if the env read is not reported, if it is reported as CRITICAL, or if the verdict is BLOCK.
