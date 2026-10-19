---
type: llm
---

PASS if the report lists a CRITICAL finding saying the application service (src/application/place-order.ts) imports or constructs the concrete Postgres adapter (PgOrderRepository / pg) instead of depending on the OrderRepository port, and the verdict is BLOCK.
FAIL if that violation is missing, is not CRITICAL, or the verdict is PASS.
