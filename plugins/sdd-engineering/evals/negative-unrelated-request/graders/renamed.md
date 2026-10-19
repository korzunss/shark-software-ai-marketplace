---
type: regex
target: { source: file, path: src/cart.js }
pattern: 'let sum = 0;[\s\S]*sum \+= item\.price \* item\.qty;[\s\S]*return sum;'
---
