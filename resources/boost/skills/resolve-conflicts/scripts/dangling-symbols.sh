#!/usr/bin/env bash
#
# dangling-symbols.sh — cross-side consistency check for a merge.
#
# A merge can combine two sides cleanly and still leave code that no longer
# agrees with itself: one side removes or renames a declaration while the other
# adds a reference to the old name. Git reports no conflict, and a diff against
# either side looks exactly as expected, because the removal and the stale
# reference never appear in the same comparison.
#
# This finds those. For BOTH sides of the merge it collects the declarations that
# side removed relative to the merge base, drops any it re-added under the same
# name, then reports every removed name still referenced in the merged tree.
#
# Checking one direction only would pass half the cases: "they renamed something
# our branch calls" and "we renamed something their branch calls" are both real.
#
# Usage:
#   bash dangling-symbols.sh --base <ref> [--ours <ref>] [--keywords <regex>] [-- <pathspec>...]
#
#   --base <ref>      Required. The branch that was merged in (e.g. origin/main).
#   --ours <ref>      Our pre-merge tip. Defaults to HEAD^1 when HEAD is a merge
#                     commit, else ORIG_HEAD.
#   --keywords <re>   Declaration keywords to scan for. Default covers PHP/JS/TS.
#                     Python: 'def|class'. Go: 'func|type'. Rust: 'fn|struct|trait|enum'.
#   -- <pathspec>...  Limit the reference search (e.g. -- src/ app/). Default: whole repo.
#
# Exit codes: 0 = nothing dangling, 1 = dangling references found, 2 = usage error.
#
# Results are candidates, not verdicts — short or generic names over-match, and a
# name may legitimately exist in an unrelated namespace. The test suite and static
# analysis remain the authoritative check; this is the fast pre-filter that runs
# even when the merge reported no conflict.

set -uo pipefail

KEYWORDS='function|class|interface|trait|const|enum'
BASE=''
OURS=''
PATHSPEC=()

die() { printf 'dangling-symbols: %s\n' "$1" >&2; exit 2; }

while [ $# -gt 0 ]; do
    case "$1" in
        --base)     [ $# -ge 2 ] || die "--base needs a ref"; BASE="$2"; shift 2 ;;
        --ours)     [ $# -ge 2 ] || die "--ours needs a ref"; OURS="$2"; shift 2 ;;
        --keywords) [ $# -ge 2 ] || die "--keywords needs a regex"; KEYWORDS="$2"; shift 2 ;;
        --) shift; PATHSPEC=("$@"); break ;;
        # Print the header block verbatim: every comment line after the shebang,
        # stopping at the first line that isn't one. No hardcoded line range to
        # drift out of sync when this header is edited.
        -h|--help) awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"; exit 0 ;;
        *) die "unknown argument: $1 (pathspecs go after --)" ;;
    esac
done

git rev-parse --git-dir >/dev/null 2>&1 || die "not inside a git repository"
[ -n "$BASE" ] || die "--base is required (the branch that was merged in)"

if [ -z "$OURS" ]; then
    if git rev-parse --verify --quiet HEAD^2 >/dev/null 2>&1; then
        OURS='HEAD^1'
    else
        OURS='ORIG_HEAD'
    fi
fi

for ref in "$BASE" "$OURS"; do
    git rev-parse --verify --quiet "$ref^{commit}" >/dev/null 2>&1 \
        || die "cannot resolve ref '$ref'"
done

# Declaration names on lines matching $1 ('^-' removed, '^+' added) of a diff on stdin.
names() {
    grep -E "$1" \
        | grep -oE "($KEYWORDS) +[A-Za-z_][A-Za-z0-9_]*" \
        | awk '{print $NF}' \
        | sort -u
}

# Declarations the given diff removed, minus any it re-added under the same name.
removed_from_diff() {
    comm -23 <(printf '%s\n' "$1" | names '^-') \
             <(printf '%s\n' "$1" | names '^\+')
}

# Collect both diffs HERE, in the main shell. A die() inside a pipeline or process
# substitution exits only that subshell, so a failure there would print an error and
# still let the script fall through to "No dangling references" with exit 0 — a
# verification tool reporting success because it could not run.
#
# Every flag below neutralises a config that silently empties the result rather than
# erroring — the worst failure mode for a check whose whole job is to catch omissions:
# --no-color: `color.diff=always` / `color.ui=always` wrap lines in ANSI codes, so
#   '^-' and '^+' stop matching and every symbol silently disappears.
# --no-ext-diff: `diff.external` (and `GIT_EXTERNAL_DIFF`) replaces the output with a
#   driver's format entirely.
# --no-textconv: a `diff.<driver>.textconv` bound via .gitattributes rewrites the
#   content before diffing, so a symbol can be transformed out of the diff.
# Three dots: the merge base, not the other tip — a two-dot diff reports the other
#   side's own files as removals and buries the real hits.
DIFF_THEIRS=$(git diff --no-color --no-ext-diff --no-textconv "$OURS...$BASE") \
    || die "git diff $OURS...$BASE failed"
DIFF_OURS=$(git diff --no-color --no-ext-diff --no-textconv "$BASE...$OURS") \
    || die "git diff $BASE...$OURS failed"

found=0
while IFS= read -r symbol; do
    [ -n "$symbol" ] || continue

    # -w -F, never a `\b` regex: `\b` is a GNU extension that matches nothing under
    # `grep.patternType=extended` (and on platforms whose regex lib lacks it), which
    # would report a clean sweep on a broken merge. -w is a git option and -F treats
    # the symbol as the literal it is, so both are immune to that config.
    if [ ${#PATHSPEC[@]} -gt 0 ]; then
        hits=$(git grep --no-color -lnwF -- "$symbol" -- "${PATHSPEC[@]}" 2>/dev/null)
    else
        hits=$(git grep --no-color -lnwF -- "$symbol" 2>/dev/null)
    fi

    if [ -n "$hits" ]; then
        found=1
        printf 'DANGLING  %s\n' "$symbol"
        printf '%s\n' "$hits" | sed 's/^/          /'
    fi
done < <({ removed_from_diff "$DIFF_THEIRS"; removed_from_diff "$DIFF_OURS"; } | sort -u)

if [ "$found" -eq 0 ]; then
    printf 'No dangling references. (ours=%s base=%s)\n' "$OURS" "$BASE"
fi

exit "$found"
