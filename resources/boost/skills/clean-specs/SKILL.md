---
name: clean-specs
description: "Command-only — invoke with `/clean-specs`; never activates on its own. Removes spec files under the project's spec directories whose work is fully implemented and on the base branch, so the folders hold only live work. Fully implemented = every task checkbox checked AND the work proven on the base branch — by the implementation being present there, or by a merged PR. A spec still in an open/draft PR is NOT done and is kept."
argument-hint: "[optional: a single spec path or issue key to check just that one]"
disable-model-invocation: true
metadata:
  schema-required: "^1"
---

# Clean Specs

Removes spec files under the project's spec directories — <!--boost:conv path="spec.directories" mode="inline"-->specs/<!--boost:conv:end-->, following the <!--boost:conv path="spec.filename_pattern" mode="inline"-->specs/{slug}.md<!--boost:conv:end--> convention and including subdirectories such as `specs/cleanup/` — whose feature is **fully implemented and shipped to the base branch**, leaving only specs for work still in progress or in review. Companion to `write-spec` (creates them) and `implement-spec` (works through them).

## Definition — "Fully Implemented" (the deletion bar)

A spec is deleted **only when both hold**:

1. **Fully checked off** — the spec has task checkboxes and **every** `- [ ]` is `- [x]` (zero unchecked tasks remain).
2. **The work is proven on the base branch** — proven, not assumed. Two proofs are accepted, and **either one** is enough:
   - **Rung A** — the implementation the spec asked for is *present on `origin/<base>`* and was *absent when the spec was written*. This needs no PR at all, so it works in a project that commits straight to the base branch and in a project whose specs carry no issue key.
   - **Rung C** — a PR for the spec is **merged**, its merge commit is an **ancestor of the base branch**, and the implementation is still present there.

**PR stage is not implemented.** A spec whose only PR is open/draft, or whose merged PR has not yet reached the base branch, is *live work* — keep it. This is the load-bearing rule: reaching a PR is not the bar; reaching the base branch is. An open PR outranks both rungs.

Anything that fails either test, or that cannot be evaluated, is **kept and reported with a reason** — never deleted on a guess.

### Three verdicts, and what each one authorizes

| Verdict | Meaning | What may act on it |
|---|---|---|
| `DELETE-ELIGIBLE` | The skill has proof, **and** the deletion is recoverable — a tracked spec, removed through a reviewable PR a revert undoes. | One batch confirmation covering the group. |
| `PROPOSED` | An **untracked** spec — the deletion cannot be taken back — with either a positive rung or a positive **degraded Rung A** (its conditions 1 and 2, the baseline unavailable). Never a home for missing, indeterminate, or failed evidence; that is `KEEP`. | A per-file confirmation, one file at a time, with the evidence shown. |
| `KEEP` | Live work, or the evidence could not be evaluated. | Nothing. It is reported with its reason. |

Ambiguity always resolves downward: `DELETE-ELIGIBLE` → `PROPOSED` → `KEEP`.

## Base branch

The "shipped" baseline is the project's base branch: <!--boost:conv path="github.default_base_branch" mode="inline"-->main<!--boost:conv:end-->. If the project integrates work on a different branch (e.g. `develop`), substitute it in the `origin/<base>` references below.

## When to Use

- The spec folders have accumulated specs for features that already shipped.
- After a batch of PRs merged and their specs were not removed at PR time.
- After work that went straight to the base branch with no PR — the case only Rung A can prove.
- User asks to "clean up implemented specs" / "prune the specs folder".
- With an argument (a spec path or issue key): evaluate just that one spec.

Not for: writing specs (`write-spec`), implementing them (`implement-spec`), or deleting a spec whose PR is still open — the `pull-requests` skill owns the at-PR-creation removal for the standard flow (see *Relationship to `pull-requests`* below).

## Procedure

Default to a **dry-run report first**. Delete only after showing the user which specs qualify and getting a go-ahead.

### Step 0 — Refresh the base baseline

`origin/<base>` is the source of truth for "shipped", so fetch before any ancestor or presence check:

```bash
git fetch origin <base>
```

### Step 1 — Enumerate candidate specs, per directory

The project may hold specs in **more than one directory**. Resolve the list in this order:

1. `spec.directories` when configured — an ordered list, swept in order.
2. Otherwise the single directory derived from `spec.filename_pattern`: the literal path prefix before the first `{…}` placeholder (`specs/` by default; a configured `docs/specs/{issue_key}-{slug}.md` → `docs/specs/`).

Sweep **every** configured directory and report each one separately:

- **An empty sweep is reported, not silent.** "0 specs found under `specs/`" is information; a blank report is not. A silent clean sweep of a directory that holds nothing reads exactly like success and hides the specs living somewhere else.
- **A configured directory that does not exist is a loud warning**, not a skipped line. It usually means the configuration drifted from where the project actually keeps its specs.

Enumerate every `.md` file under each directory, tracked or not — specs may live in subdirectories, which a bare `*.md` glob would miss. Enumerate NUL-delimited **and consume the stream NUL-delimited**: piping `-print0` output through anything line-oriented (`$(…)`, `for`, `while read` without `-d ''`) throws the guarantee away at the first filename containing a newline.

```bash
# One pass per directory. `find` returns tracked and untracked files alike, so a
# single pass enumerates everything — no second `git ls-files` pass to merge or
# dedupe, and no associative array (bash 3.2, still the default shell on macOS,
# has none).
while IFS= read -r -d '' SPEC; do
  # …Steps 2–4 for "$SPEC"…
done < <(find "$DIR" -type f -name '*.md' -print0)
```

Then classify **each file** — never the directory it sits in. A directory can hold both tracked and untracked Markdown, and the classification decides which deletion path the file may ever take:

```bash
git ls-files --error-unmatch -- "$SPEC" >/dev/null 2>&1
case $? in
  0) echo TRACKED ;;
  1) echo UNTRACKED ;;
  *) echo CLASSIFY_FAILED ;;   # KEEP and stop — never rm on a git error
esac
```

Branch on the **exit status**, not on truthiness: a `&& TRACKED || UNTRACKED` chain routes any nonzero exit — a broken index, an interrupted call — into the irreversible path. Only status `1` means untracked; anything else stops the run for that file.

A `.gitkeep` is not a `.md` file, so it is excluded automatically. For a single spec named in the argument (path or issue key), evaluate just that one. For each spec, run Steps 2–4.

### Step 2 — Checkoff test

Count unchecked task boxes:

```bash
grep -cE '^[[:space:]]*- \[ \]' "$SPEC" || true
```

- `> 0` unchecked → **KEEP**, reason `"in progress — N unchecked task(s)"`. Stop evaluating this spec.
- `0` unchecked **and** the file has at least one checked box (`- [x]` / `- [X]`, matched case-insensitively — `grep -cE '^[[:space:]]*- \[[xX]\]' "$SPEC"` is `> 0`) → checkoff **passes**, continue to Step 3.
- **Zero checkboxes of any kind** (`grep -cE '^[[:space:]]*- \[[ xX]\]' "$SPEC"` is `0`) → checkoff is indeterminate. **KEEP**, reason `"no task checkboxes — manual review"`. Some small/research specs land here on purpose: surface them, don't auto-delete.

Treat a phase explicitly marked `Priority: LOW` / `Future` / `Deferred` as still-open work: if its boxes are unchecked, the spec is in progress. Do not special-case deferred phases into "done".

Checkoff is **necessary, never sufficient**: a checked box is the claim of whoever did the work, not evidence the work is on the base branch. Step 4 is where the evidence comes from.

### Step 3 — Resolve the issue key, if there is one

Specs are optionally issue-backed (the `spec.filename_pattern` may carry an `{issue_key}`). Parse the key from the filename per the project's key style (a Jira-style `ABC-1234`, or a bare GitHub number).

- **A key is present** → both rungs are available. Continue to Step 4.
- **No key** (a keyless `specs/{slug}.md`) → **Rung C is unavailable**; there is no key to map a PR to. This is *not* a stop: the spec continues to Step 4 and is judged on **Rung A**, which needs no PR. Note the missing key in the report so the reader knows which proof was used.

### Step 4 — Prove the work is on the base branch

**Deletion still has exactly one positive shape** — the work provably on the base branch, un-reverted, with nothing still open. What changed is that two different proofs can establish it. Take the rungs in order; **any one positive rung is enough**, and every rung must return a falsifiable result. Anything indeterminate is **KEEP**.

#### The open-PR veto — evaluated first, outranks every rung

An open or draft PR means unfinished work for this spec, whatever the rungs return: code can already be on the base branch while a follow-up PR is in review.

With an issue key, use the two lookups (title/body search, and branch-name match) exactly as Rung C describes below. **Without a key**, veto by *cited-path overlap* — if any open PR touches a path the spec cites, the spec is live work:

```bash
set -o pipefail
veto_paths() {
  local PRS N
  PRS="$(gh pr list --state open --limit 100 --json number --jq '.[].number')" \
    || { echo VETO_UNEVALUABLE >&2; return 1; }
  [ "$(printf '%s\n' "$PRS" | grep -c .)" -ge 100 ] \
    && { echo VETO_UNEVALUABLE >&2; return 1; }      # truncated — stop, don't continue
  for N in $PRS; do
    gh pr diff "$N" --name-only || { echo VETO_UNEVALUABLE >&2; return 1; }
  done
}
OPEN_PATHS="$(veto_paths)" || { echo KEEP; exit 0; }

# The veto is the OVERLAP, not the enumeration. Compare the open PRs' paths with
# the spec's cited paths; one shared path is enough to keep the spec.
printf '%s\n' "$OPEN_PATHS" | grep -qxF -- "$CITED_PATH" && { echo KEEP; exit 0; }
```

**Enumerating the PRs is not the veto — the overlap is.** Collecting `OPEN_PATHS` and then proceeding to the rungs leaves the veto unused: a keyless spec passes Rung A while an open PR is changing the very path it cites. Compare the two lists, and keep the spec on any shared path.

Every failure path must **return**, not merely print: `VETO_UNEVALUABLE` ends the evaluation of this spec with **KEEP**, reason `"cannot enumerate open PRs — manual review"`. A truncation check that prints a warning and lets the loop run on is not a veto — the run continues with a partial list and the rungs proceed on it. A bare `for N in $(gh …)` loop swallows the failure: `gh` errors, the list comes back empty, the loop body never runs, and the veto silently reads as "no overlapping PR" — a wrong deletion dressed as a clean result. Capture and check the list before the loop, check every `gh pr diff`, and treat a result count equal to the limit as truncated.

#### Rung A — the implementation is present on the base branch

The strongest proof, and the only one that works with no PR and no issue key. The spec names files and symbols; resolve them against `origin/<base>`.

**All three conditions must hold:**

1. every `file:line`-cited path in the spec still exists on the base branch — necessary, never sufficient;
2. **every** symbol the spec says it adds (a class, a method, a test name, a migration) is present there — one absent symbol fails the rung, because a partly-shipped spec is live work;
3. **at least one** of those symbols was **absent at the spec's baseline** — its creation commit's parent. A symbol that already existed proves nothing: the spec asked for something new, so something new has to have appeared.

```bash
# 1 — the cited path is still on the base branch
git cat-file -e "origin/<base>:$CITED_PATH" && echo PRESENT || echo ABSENT

# 2 — the symbol is on the base branch now
git grep -q "$CITED_SYMBOL" origin/<base> -- "$CITED_PATH" && echo NOW_PRESENT || echo ABSENT

# 3 — and it was NOT there when the spec was written.
#     Use the PARENT of the spec's creation commit: a spec committed together
#     with its first slice of implementation would otherwise read as pre-existing.
SPEC_BORN="$(git log --follow --diff-filter=A -1 --format=%H -- "$SPEC")"
BASE_REV="$(git rev-parse --verify -q "${SPEC_BORN}^")" || BASE_REV=""
if [ -z "$SPEC_BORN" ] || [ -z "$BASE_REV" ]; then
  echo NO_BASELINE
else
  git grep -q "$CITED_SYMBOL" "$BASE_REV"; rc=$?
  case $rc in
    0) echo PRE_EXISTING ;;   # not evidence
    1) echo NEW ;;            # the rung's positive result
    *) echo NO_BASELINE ;;    # any other status is an error
  esac
fi
```

**Fail closed on every error.** `git grep` exits `1` for "no match" and other nonzero statuses for real errors — only `1` may mean `NEW`. `--diff-filter=A` returns nothing on a shallow clone (hence `--follow` for a renamed spec), and a spec added in the repository's root commit has no parent. Each of those is `NO_BASELINE` → **KEEP**, reason `"no baseline to date the spec against — manual review"`. A one-line `[ -n "$X" ] && git grep … || echo NEW` chain turns every one of those errors into the positive result; do not write it that way.

**An untracked spec has no creation commit, and no substitute for one.** An mtime is not a baseline: a copy, a checkout, or a restore carries an old timestamp forward, and a baseline that is too old fails open — every symbol introduced since then reads as `NEW`. So condition 3 is unsatisfiable for an untracked spec, and Rung A runs **degraded**: conditions 1 and 2 only, with no way to date the evidence.

**Degraded Rung A is a named result, not a half-failure.** It returns positive only when conditions 1 and 2 both hold — every cited path present on the base branch, every named symbol present there — and it reports `PROPOSED-DEGRADED (no baseline)` so the missing third condition travels with the verdict. Conditions 1 or 2 failing is still `KEEP`, exactly as for a tracked spec. A degraded rung is never proof, so its ceiling is `PROPOSED`: the paths and every named symbol are present on the base branch, the report says so and says the baseline is missing, and a human decides. An untracked spec **can never reach `DELETE-ELIGIBLE`** — not through Rung A, and not through Rung C either, because `rm` is still `rm`.

**What Rung A is, exactly: a text match, reported as one.** `git grep` proves matching text exists on the base branch — not that it is this spec's implementation. The match can sit in a comment, in documentation, in dead code, or in an unrelated symbol sharing the name. So:

- **The report shows the evidence, not the verdict alone** — the symbol matched, the file it matched in, and the baseline commit it was absent at. The user confirms on something checkable in seconds.
- **A spec that names nothing resolvable is KEEP**, reason `"spec names nothing checkable — manual review"`. That is a useful signal about the spec, not a fault in the sweep.

Rung A is naturally revert-proof: a reverted implementation is an absent symbol, and an absent symbol fails the rung.

> **Do not add a commit-ancestor rung.** "The commit that last touched a cited path is an ancestor of the base branch" looks like a cheap third proof and is not one: any unrelated commit touching the file satisfies it with the spec's work undone, and a revert commit itself becomes the last-touching commit, so the rung passes on code that was taken back out. Both defects can only be closed by inspecting what the commit changed — which is Rung A.

#### Rung C — a merged PR, un-reverted, on the base branch

Available only when the spec has an issue key. List every PR for the key. No single `gh` search reliably covers title, body, **and** branch name, so use two lookups and combine them. Pass an explicit high `--limit` — the default is 30, and the delete guard is only sound if it sees **every** matching PR; if a lookup ever returns the full limit, raise it and re-run rather than trusting a truncated list:

```bash
set -o pipefail
# Title/body match, all states — the merged-shipped proof plus most open PRs.
# `title` and `body` are requested because the classification below turns on
# WHERE the key matched: a title/branch match is proof, a body mention is not.
BY_SEARCH="$(gh pr list --search "<ISSUE-KEY>" --state all --limit 100 \
  --json number,state,title,body,mergedAt,mergeCommit,baseRefName,headRefName,url)" \
  || { echo LOOKUP_FAILED; exit 0; }
# PRs whose BRANCH name carries the key, ALL states — branch conventions embed the
# key there, and GitHub PR search does not reach branch names. `--state all` matters
# in both directions: an open PR here vetoes, and a merged one whose key lives only
# in its branch name is proof that the title/body search cannot see:
BY_BRANCH="$(gh pr list --state all --limit 100 --json number,state,mergeCommit,headRefName,url \
  | jq '[.[] | select(.headRefName | test("<ISSUE-KEY>"))]')" \
  || { echo LOOKUP_FAILED; exit 0; }
for R in "$BY_SEARCH" "$BY_BRANCH"; do
  [ "$(printf '%s' "$R" | jq 'length')" -ge 100 ] && { echo LOOKUP_TRUNCATED; exit 0; }
done
```

`gh pr list` auto-detects the repository from the git remote. Capture each lookup's exit status: `LOOKUP_FAILED` or `LOOKUP_TRUNCATED` is **KEEP**, reason `"can't reliably enumerate PRs for this key — manual review"` — a lookup that errored must never read as "no PR found". Combine both results — an open PR from *either* lookup keeps the spec. Keep track of **which field matched**: the classification below is only sound if a title/branch match can be told apart from a body mention, which is why `title` and `body` are in the `--json` list. If the project's conventions don't reliably put the key in the title, body, **or** branch name, enumeration is weak proof: treat an ambiguous or empty result as **KEEP**, reason `"can't reliably enumerate PRs for this key — manual review"`. Classify from the combined result:

- **Any OPEN/DRAFT PR exists** (`state == "OPEN"`, which also covers drafts) → **KEEP**, reason `"in PR/review stage — not on the base branch yet"`. This holds even if another PR for the key already merged.
- **No merged PR** (no PRs, or only CLOSED-unmerged ones for a superseded attempt) → Rung C returns nothing. Fall back to Rung A; if that is also negative, **KEEP**, reason `"no merged PR and no implementation found — cannot confirm shipped"`.
- **A MERGED PR exists** (and no open PR) → it is proof **only if it is unambiguously this spec's PR**: the key is in its **title or head-branch name**, not merely mentioned in the body — "related to <key>" on an unrelated PR is not proof. A body-mention-only match → **KEEP**, reason `"only a body-mention merged PR — manual review"`. For a genuine title/branch match, confirm the merge commit reached the base branch:

  ```bash
  git merge-base --is-ancestor <mergeCommit.oid> origin/<base> && echo ON_BASE || echo NOT_YET
  ```

  - `NOT_YET` (merged elsewhere but not on the base branch) → **KEEP**, reason `"merged but not on the base branch yet"`.
  - `ON_BASE` → **not yet a positive result.** `--is-ancestor` proves the merge commit is in history, not that the implementation still lives on the base: a later revert keeps the merge commit reachable yet removes the code, and a `Revert "…"` title match only catches a revert that used the standard title. **Run Rung A's presence check (condition 2) against `origin/<base>` before returning positive.** If the implementation is no longer present → **KEEP**, reason `"merged then removed — manual review"`. When unsure, keep.

  If several PRs merged (multi-phase spec), require **each** merged PR's commit to be an ancestor of `origin/<base>`, and the implementation present; if any is `NOT_YET` or gone, keep.

### Step 5 — Report

Print the results **grouped by directory, then by tracked/untracked**, so the reader can see which locations were swept and which deletions are recoverable. This is the default output — stop here unless the user asked to delete outright.

For each directory: the count found (including `0`), and how those files split between tracked and untracked — the classification is per file, so a single directory can appear in both groups. Then, within it:

- **Delete-eligible** (tracked only) — one line per spec: filename, the rung that proved it, and its evidence — the symbol matched and where, or the merged PR number(s).
- **Proposed** — an **untracked** spec with a positive rung, or a positive degraded Rung A (marked `PROPOSED-DEGRADED (no baseline)`). `PROPOSED` is not a bucket for weak evidence: a spec whose evidence was missing, indeterminate, or produced by a failed command is **KEEP**, exactly as it would be if it were tracked. The only thing `PROPOSED` adds over `DELETE-ELIGIBLE` is that the deletion cannot be undone, so it is answered per file. One line per spec, with the same evidence shown.
- **Kept** — one line per spec: filename + the specific reason from Steps 2–4.

Ask the user to confirm before deleting. If the argument scoped a single spec, just report that one's verdict.

### Step 6 — Delete (only after confirmation)

**Re-verify eligibility against fresh state first.** The dry-run report may be minutes or hours old, and an open/draft PR could have appeared since — deleting on a stale decision is itself a wrong deletion. Re-run Step 0 (fetch the base) and Steps 2–4 for every spec about to be deleted, and drop any no longer eligible. Only the survivors proceed.

The two groups then take **different paths, and never share a confirmation** — one "yes" must not cover both, because their consequences differ.

#### 6a — Tracked specs: a reviewable PR

Removing tracked files is a change to the base branch, so it ships via a PR like any other change — never delete straight on a protected branch.

1. Branch from an up-to-date base (name it per the project's branch conventions — a keyless housekeeping change, so the project's no-issue/`chore` pattern where one exists; the Step 5 confirmation is the go-ahead).
2. `git rm -- "$SPEC"` for each surviving spec.
3. Commit with a message that names the housekeeping (e.g. `Remove specs for features shipped to <base>`).
4. Create the PR via the **`pull-requests`** skill (never a direct `gh pr create`). It is a docs-only change with no behavioural effect — low risk — and the PR body lists the removed specs and the evidence that shipped each.

For a single-spec argument the user may prefer to just `git rm` it inside an existing related branch — follow their lead, but the code still only reaches the base branch through a PR.

#### 6b — Untracked specs: irreversible, so ask per file

An untracked spec is in no index. `git rm` does not apply, there is nothing to commit, and **git cannot restore it** — no revert, no reflog, no checkout. `rm` is final.

Confirm **one file at a time**, stating plainly that the deletion cannot be undone, naming the file, and showing the evidence line from Step 5. Then, immediately before each `rm`, every candidate must still satisfy all of:

- it is a **regular file** (not a symlink, directory, or device) ending in `.md`;
- its resolved real path is **inside the repository root** and **inside a configured directory** — reject anything absolute, containing `..`, or reaching outside through a symlink. `spec.directories` holds arbitrary strings from a project's config, and `rm` does not forgive;
- it has the **same content hash** as when it was confirmed. Record `shasum -a 256 -- "$SPEC"` (or `sha256sum`) for each confirmed file and re-check it at deletion time. A mismatch means the file changed between the question and the answer → **keep it**, and say why. A check that runs only before the confirmation leaves the whole confirmation window open.

Then `rm -- "$SPEC"`. Pass `--` before every path in every command, so a filename starting with a dash is never read as a flag.

## Relationship to `pull-requests`

The `pull-requests` skill removes a spec **when its PR is created**, on the assumption the PR captures everything. `clean-specs` is the **post-merge** net for specs that survived that step — manual implementations, work committed straight to the base branch with no PR at all, specs deliberately kept through review, or older specs from before that step existed. The two do not conflict: if a spec was already deleted at PR time, `clean-specs` simply never sees it. `clean-specs` never deletes a spec whose PR is still open — that case is exactly what its "PR stage is not implemented" rule protects.

## Guardrails

- **A verdict is a proposal, not a certainty.** Rung A is a text match: it proves matching text is on the base branch and was not there when the spec was written, not that the text is this spec's implementation. Rung C infers shipped-state from PR metadata. Both are imperfect, so the real safety net is the layering: report-first, evidence shown, explicit confirmation, and — for tracked specs — removal through a reviewable PR that a revert undoes. Lean **KEEP** on any ambiguity: a kept spec costs a follow-up sweep; a wrongly-deleted one costs lost work.
- **Recoverability decides the verdict ceiling.** A tracked spec can reach `DELETE-ELIGIBLE`. An untracked spec cannot — it has no baseline to date its evidence against and no way back after `rm`, so it tops out at `PROPOSED` and is answered one file at a time.
- **Every failed command means KEEP.** An unrunnable check is not a passed check. A `gh` that errors, a `git grep` that returns a status other than `0` or `1`, a spec with no resolvable baseline — each is an indeterminate result, and indeterminate is always KEEP.
- **Never delete on an unproven assumption.** Both tests must pass with evidence (all boxes checked; a rung positive with its own falsifiable check).
- **Report before deleting** by default. The dry-run is the safe mode; deletion is opt-in per run.
- **`origin/<base>` must be freshly fetched** (Step 0) or the presence and ancestor checks read a stale baseline and can wrongly mark in-flight work as shipped.
- **Don't touch `.gitkeep`** — it keeps an empty spec folder in git.
