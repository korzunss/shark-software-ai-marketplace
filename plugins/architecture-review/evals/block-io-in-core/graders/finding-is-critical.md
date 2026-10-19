---
type: llm
---

PASS if the report lists a CRITICAL finding saying the domain core (src/domain/order.ts) performs file-system I/O (node:fs readFileSync), which breaks the pure-core rule, and the verdict is BLOCK.
FAIL if that violation is missing, is not CRITICAL, or the verdict is PASS.
