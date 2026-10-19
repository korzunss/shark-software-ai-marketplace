#!/usr/bin/env bash
# Onion edge checks for ONE backend module, plus the repo-wide adapter, client and env checks.
#
#   check-module.sh <module-dir> [options]
#
# <module-dir>  the module folder, relative to --root (e.g. src/modules/billing).
#
# Options (defaults follow the reference layout in layer-map.md):
#   --root <dir>        project root that paths are relative to (default: git top level, else cwd).
#                       Point it at a draft or a worktree laid out like the project to check that.
#   --src <dir>         backend source root (default: two levels above <module-dir>).
#   --adapters <dir>    adapters folder (default: <src>/adapters).
#   --env-allow <re>    extended regex, matched against paths relative to <src>, of the files
#                       allowed to read process.env (default: platform/config, config,
#                       db/migrate, db/seed, adapters/secrets/*).
#   --clients <re>      extended regex of SDK client constructors
#                       (default: simpleGit(, new Octokit|OpenAI|Anthropic|S3Client|Stripe|PrismaClient().
#   --db <re>           extended regex of schema / ORM imports
#                       (default: db/schema, drizzle-orm, 'pg', 'postgres', @prisma/client).
#   -h, --help          show this help.
#
# Comment lines and *.test.* / *.spec.* files are skipped. Exit 1 when any check has hits,
# 2 on a usage error. A hit is a lead, not a verdict: check it against the project's
# documented exceptions and `git show HEAD:<file>` before you report it.
set -u

usage() { sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; }

mod=""
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
src=""
adapters=""
env_allow='^(platform/config|config|db/(migrate|seed)|adapters/secrets/[^:]*)\.[cm]?tsx?$'
clients='simpleGit\(|new (Octokit|OpenAI|Anthropic|S3Client|Stripe|PrismaClient)\('
db_re="db/schema|drizzle-orm|from '(pg|postgres)'|@prisma/client"

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --root) root="${2:?--root needs a value}"; shift 2 ;;
    --src) src="${2:?--src needs a value}"; shift 2 ;;
    --adapters) adapters="${2:?--adapters needs a value}"; shift 2 ;;
    --env-allow) env_allow="${2:?--env-allow needs a value}"; shift 2 ;;
    --clients) clients="${2:?--clients needs a value}"; shift 2 ;;
    --db) db_re="${2:?--db needs a value}"; shift 2 ;;
    -*) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
    *) if [ -z "$mod" ]; then mod="$1"; shift; else echo "unexpected argument: $1" >&2; exit 2; fi ;;
  esac
done
[ -z "$mod" ] && { usage >&2; exit 2; }

root="${root%/}"
mod="${mod%/}"
[ -z "$src" ] && src="$(dirname "$(dirname "$mod")")"
src="${src%/}"
[ -z "$adapters" ] && adapters="$src/adapters"
adapters="${adapters%/}"

dir="$root/$mod"
[ -d "$dir" ] || { echo "no module folder: $dir" >&2; exit 2; }
[ -d "$root/$src" ] || { echo "no source root: $root/$src" >&2; exit 2; }
aname="$(basename "$adapters")"

hits=0
# grep_code <pattern> <paths...>: matches outside comment lines and tests, paths relative to root.
grep_code() {
  local pat="$1"; shift
  grep -rnaE --include='*.ts' --include='*.tsx' --include='*.mts' --include='*.cts' "$pat" "$@" 2>/dev/null \
    | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' \
    | grep -vE '\.(test|spec)\.[cm]?tsx?:' \
    | sed "s#^$root/##"
}
report() {
  local rule="$1" out="$2" line
  if [ -n "$out" ]; then
    echo "[$rule]"
    while IFS= read -r line; do echo "  $line"; done <<< "$out"
    hits=1
  else
    echo "[$rule] ok"
  fi
}
# strip_src: turn "<src>/path:line:text" into "path" (relative to src) for allow-list matching.
outside_allow() {
  while IFS= read -r line; do
    rel="${line#"$src"/}"
    file="${rel%%:*}"
    printf '%s\n' "$file" | grep -qE "$env_allow" || printf '%s\n' "$line"
  done
}

imp="(from|import\\(|require\\() *['\"]"

# Module files except the repository, which is the one place the schema belongs.
non_repo=$(find "$dir" \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.cts' \) \
  ! -name '*.test.*' ! -name '*.spec.*' ! -name 'repository*' ! -name '*.repo.*' ! -path '*/repository/*')

echo "module: $mod   src: $src   adapters: $adapters"

report "services-depend-on-ports / routes-are-thin" \
  "$(grep_code "${imp}[^'\"]*(^|/)${aname}/" "$dir")"
# shellcheck disable=SC2086  # word splitting of the file list is intended
report "db-confined-to-repositories" \
  "$( [ -n "$non_repo" ] && grep_code "$db_re" $non_repo )"
report "no-cross-module-internals (keep only 'import type' from <other>/types)" \
  "$(grep_code "${imp}\\.\\./[a-z0-9-]+/" "$dir" | grep -vE "import type .*from '\\.\\./[a-z0-9-]+/types(\\.js)?'")"
report "env-at-chokepoints" \
  "$(grep_code "process\\.env" "$dir")"
report "one-adapter-per-system (SDK client or raw fetch in a module)" \
  "$(grep_code "${clients}|(^|[^.[:alnum:]_])fetch\\(" "$dir")"

# Repo-wide: these catch a new adapter that the module wires in.
if [ -d "$root/$adapters" ]; then
  report "adapters-dont-know-modules" \
    "$(grep_code "${imp}[^'\"]*(^|/)modules/" "$root/$adapters")"
else
  echo "[adapters-dont-know-modules] skipped: no adapters folder at $adapters"
fi

client_hits="$(grep_code "$clients" "$root/$src")"
outside_adapters="$(printf '%s\n' "$client_hits" | grep -v "^$adapters/" | grep -v '^$')"
# The same constructor in more than one file is a second client for the same system.
dupes="$(printf '%s\n' "$client_hits" | grep -v '^$' | while IFS= read -r line; do
    file="${line%%:*}"
    ctor="$(printf '%s\n' "$line" | grep -oE "$clients" | head -n 1)"
    printf '%s\t%s\n' "$ctor" "$file"
  done | sort -u | awk -F'\t' '{ n[$1]++; f[$1] = f[$1] "\n" $1 " in " $2 } END { for (c in n) if (n[c] > 1) printf "%s", f[c] }' | grep -v '^$')"
report "one-adapter-per-system (client constructed outside $adapters)" "$outside_adapters"
report "one-adapter-per-system (same client constructed in more than one file)" "$dupes"

report "env-at-chokepoints (repo-wide, outside --env-allow)" \
  "$(grep_code "process\\.env" "$root/$src" | outside_allow)"

exit $hits
