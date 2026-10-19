#!/usr/bin/env bash
# Fixture: a tiny Node project in a git repo, with a committed .sdd/config.json
# that moves specs and plans to non-default folders.
set -euo pipefail

mkdir -p src .sdd
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
cat > src/strings.js <<'EOF'
export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
EOF
cat > .sdd/config.json <<'EOF'
{
  "specsDir": "design/specs",
  "plansDir": "design/plans",
  "packages": ["."],
  "commands": { "typecheck": null, "lint": null, "test": "npm test", "integration": null }
}
EOF

git init --quiet
git add .
git -c user.name=eval -c user.email=eval@example.com commit --quiet --message "initial commit"
