---
type: regex
target: last_message
match: not_contains
pattern: '\|\s*\**F\d+\**\s*\|[^\n]*(inject|interpolat|SQL|query string)'
flags: i
---
