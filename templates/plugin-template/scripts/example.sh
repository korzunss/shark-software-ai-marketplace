#!/usr/bin/env bash
# Example hook script. Claude Code passes the hook event as JSON on stdin.
# Keep state in "${CLAUDE_PLUGIN_DATA}", never in "${CLAUDE_PLUGIN_ROOT}":
# the root directory changes with every plugin version.
set -euo pipefail

event="$(cat)"
: "${event}"

exit 0
