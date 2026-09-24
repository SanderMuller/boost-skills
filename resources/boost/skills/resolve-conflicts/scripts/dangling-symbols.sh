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
#   -- <pathspec>...  Limit where stale REFERENCES are searched for (e.g. -- src/ app/).
#                     Default: the whole repo. The "is it still declared somewhere" check
#                     stays repo-wide either way. Generated bundles (*.map, *.min.js),
#                     Markdown (*.md) and PHPStan baselines (*baseline*.neon) are skipped
#                     by both.
#
# Exit codes: 0 = nothing dangling, 1 = dangling references found, 2 = usage error.
#
# Results are candidates, not verdicts — short or generic names over-match, and a
# name may legitimately exist in an unrelated namespace. The test suite and static
# analysis remain the authoritative check; this is the fast pre-filter that runs
# even when the merge reported no conflict.

set -uo pipefail

# Every sort and comm below must agree on collation, or comm silently mis-compares two
# lists that are each sorted — by different rules — and reports nonsense.
export LC_ALL=C

# Keep in sync with the --keywords default documented in the header above.
KEYWORDS='function|class|interface|trait|const|enum|type'
BASE=''
OURS=''
PATHSPEC=()

die() { printf 'dangling-symbols: %s\n' "$1" >&2; exit 2; }

# Generated bundles and their source maps are megabytes of vendored text that dominate the
# scan, and they are excluded from BOTH passes. A stale reference inside one is not yours
# to fix, and a build output still carrying a declaration the source dropped would mark
# that name as declared — reporting a clean sweep over a tree whose source is broken.
# Markdown and PHPStan baselines are text, not code, and fail the same two ways: prose
# naming a symbol reads as a reference, and a baseline message such as "Call to function
# foo()" reads as a declaration of foo. Other .neon files stay in: configuration there
# names real classes.
EXCLUDES=(':(exclude)*.map' ':(exclude)*.min.js' ':(exclude)*.md' ':(exclude)*baseline*.neon')

# git grep answers 0 for a match and 1 for none; anything higher is a real failure.
# Treating those alike is how this script would answer "no dangling references" because
# it could not run — the one wrong answer it must never give.
#
# Writes to a file rather than stdout for two reasons: command substitution drops the NUL
# bytes the -z form depends on, and die() inside a pipeline would exit only that subshell,
# leaving the caller reading an empty result as a clean sweep. Call it at top level.
grep_tree() {
    local destination=$1 status
    shift

    git grep --no-color "$@" >> "$destination"
    status=$?
    [ "$status" -le 1 ] || die "git grep failed (exit $status)"
}

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

# PHP lines that match the declaration pattern without declaring the name after the
# keyword: `use function f;` and `use const C;` import a name, and a typed constant
# (`const int LIMIT = 1`, PHP 8.3) puts its type where the name is read from. The first
# are dropped; the type is removed so the constant's own name is extracted.
php_forms() {
    grep -vE '^[-+]?[[:space:]]*use[[:space:]]+(function|const)[[:space:]]' \
        | sed -E 's/const +[?A-Za-z0-9_\\()]+( *[|&] *[?A-Za-z0-9_\\()]+)* +([A-Za-z_][A-Za-z0-9_]* *=)/const \2/g'
}

# Declaration names on lines matching $1 ('^-' removed, '^+' added) of a diff on stdin.
names() {
    grep -E "$1" \
        | php_forms \
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
DIFF_THEIRS=$(git diff --no-color --no-ext-diff --no-textconv "$OURS...$BASE" -- "${EXCLUDES[@]}") \
    || die "git diff $OURS...$BASE failed"
DIFF_OURS=$(git diff --no-color --no-ext-diff --no-textconv "$BASE...$OURS" -- "${EXCLUDES[@]}") \
    || die "git diff $BASE...$OURS failed"

workdir=$(mktemp -d) || die "cannot create a temporary directory"
trap 'rm -rf "$workdir"' EXIT

# Only regex-safe names reach the alternation pattern built below. names() extracts
# exactly this character class today, so nothing is dropped; the filter is here so a
# future --keywords change cannot inject a metacharacter into that pattern.
removed_from_diff "$DIFF_THEIRS" > "$workdir/removed-by-base"
removed_from_diff "$DIFF_OURS" > "$workdir/removed-by-ours"

awk '/^[A-Za-z_][A-Za-z0-9_]*$/' "$workdir/removed-by-base" "$workdir/removed-by-ours" \
    | sort -u > "$workdir/candidates"

# A name is only dangling if NOTHING declares it any more. Without this, every
# renamed local — `for (const request of …)` reads as a removed `const request` —
# reports the hundreds of files that merely use the word, and a sweep that cries
# wolf gets ignored, which is the same as not running it.
#
# One pass collecting every declared name, rather than one grep per candidate: the
# per-candidate form re-scans the whole repository once per name, which took 18 minutes
# for the several hundred candidates one real merge produced.
#
# Deliberately repo-wide, ignoring PATHSPEC: the pathspec narrows where you look for
# stale REFERENCES, but a declaration living outside it is still a declaration, and
# scoping this check would report it as removed.
#
# -w (whole word) is load-bearing: without it `myfunction foo` reads as a declaration of
# `foo`, so a name nothing declares looks declared.
# Whole lines, not -o: an import line carries the same shape as a declaration —
# `import type MoneyAmount from './money'` reads as a declaration of the very alias the
# other side removed, so the rename it is meant to catch would report clean. The names
# come out of the surviving lines below.
# `[?(]?` keeps a nullable or DNF typed constant (`const ?int LIMIT`), which php_forms
# then reduces to its name.
grep_tree "$workdir/declarations" -hwE "(${KEYWORDS}) +[?(]?[A-Za-z_][A-Za-z0-9_]*" -- "${EXCLUDES[@]}"

grep -vE '^[[:space:]]*import[[:space:]]' "$workdir/declarations" \
    | php_forms \
    | grep -oE "(${KEYWORDS}) +[A-Za-z_][A-Za-z0-9_]*" \
    | awk '{print $NF}' \
    | sort -u > "$workdir/declared"

comm -23 "$workdir/candidates" "$workdir/declared" > "$workdir/dangling"

# References: one alternation pass per chunk of names, rather than one grep per name.
# -o prints the matched name, so a single pass reports which symbol each file hit.
# Chunked because the pattern grows with the symbol count, well inside ARG_MAX at this
# size but bounded on purpose.
#
# -w, never a `\b` regex: `\b` is a GNU extension that matches nothing under
# `grep.patternType=extended` (and on platforms whose regex lib lacks it), which would
# report a clean sweep on a broken merge. -w is a git option, immune to that config.
#
# -z separates the filename with a NUL, so a path holding a colon still parses.
# Splitting `path:line:match` on colons cannot do that. The record terminator is still a
# newline, so a path holding one is not covered.
#
found=0
if [ -s "$workdir/dangling" ]; then
    : > "$workdir/references"

    while IFS= read -r chunk; do
        [ -n "$chunk" ] || continue

        if [ ${#PATHSPEC[@]} -gt 0 ]; then
            grep_tree "$workdir/references" -znwoE "(${chunk})" -- "${PATHSPEC[@]}" "${EXCLUDES[@]}"
        else
            grep_tree "$workdir/references" -znwoE "(${chunk})" -- "${EXCLUDES[@]}"
        fi
    done < <(xargs -n 200 < "$workdir/dangling" | tr ' ' '|')

    # NUL is translated first: the awk macOS ships terminates a string at \0, so a NUL
    # field separator silently becomes the empty one and every record splits per character.
    tr '\0' '\001' < "$workdir/references" \
        | awk 'BEGIN { FS = "\001" } NF == 3 { print $3 "\001" $1 }' \
        | sort -u > "$workdir/hits"

    if [ -s "$workdir/hits" ]; then
        found=1
        awk -F'\001' '
            $1 != previous { printf "DANGLING  %s\n", $1; previous = $1 }
            { printf "          %s\n", $2 }
        ' "$workdir/hits"
    fi
fi

if [ "$found" -eq 0 ]; then
    printf 'No dangling references. (ours=%s base=%s)\n' "$OURS" "$BASE"
fi

exit "$found"
