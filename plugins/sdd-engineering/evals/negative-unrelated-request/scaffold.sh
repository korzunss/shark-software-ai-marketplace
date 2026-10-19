#!/usr/bin/env bash
# Fixture: a tiny Node project in a git repo with one small module to edit.
set -euo pipefail

mkdir -p src
cat > package.json <<'EOF'
{
  "name": "demo-shop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF
cat > src/cart.js <<'EOF'
export function cartTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.qty;
  }
  return total;
}
EOF

git init --quiet
git add .
git -c user.name=eval -c user.email=eval@example.com commit --quiet --message "initial commit"
