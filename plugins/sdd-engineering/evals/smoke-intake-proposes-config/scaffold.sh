#!/usr/bin/env bash
# Fixture: a tiny Node project in a git repo, with no .sdd/config.json.
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
cat > src/strings.js <<'EOF'
export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
EOF
cat > src/strings.test.js <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capitalize } from './strings.js';

test('capitalize upper-cases the first letter', () => {
  assert.equal(capitalize('shark'), 'Shark');
});
EOF

git init --quiet
git add .
git -c user.name=eval -c user.email=eval@example.com commit --quiet --message "initial commit"
