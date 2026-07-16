---
name: clean-specs
description: "Command-only — invoke with `/clean-specs`; never activates on its own. Removes spec files under the project's specs directory whose work is fully implemented and merged to the base branch, so the folder holds only live work. Fully implemented = every task checkbox checked AND the code is on the base branch; a spec still in an open/draft PR is NOT done and is kept."
argument-hint: "[optional: a single spec path or issue key to check just that one]"
disable-model-invocation: true
metadata:
  schema-required: "^1"
---

# Clean Specs

Removes spec files under the project's specs directory — the <!--boost:conv path="spec.filename_pattern" mode="inline"-->specs/{slug}.md<!--boost:conv:end--> convention, including subdirectories such as `specs/cleanup/` — whose feature is **fully implemented and shipped to the base branch**, leaving only specs for work still in progress or in review. Companion to `write-spec` (creates them) and `implement-spec` (works through them).

## Definition — "Fully Implemented" (the deletion bar)

A spec is deleted **only when both hold**:

1. **Fully checked off** — the spec has task checkboxes and **every** `- [ ]` is `- [x]` (zero unchecked tasks remain).
2. **Code is on the base branch** — a PR for the spec is **merged** and its merge commit is an **ancestor of the base branch** (`origin/<base>`).

**PR stage is not implemented.** A spec whose only PR is open/draft, or whose merged PR has not yet reached the base branch, is *live work* — keep it. This is the load-bearing rule: reaching a PR is not the bar; reaching the base branch is.

Anything that fails either test, or that cannot be evaluated, is **kept and reported with a reason** — never deleted on a guess.

## Base branch

The "shipped" baseline is the project's base branch: <!--boost:conv path="github.default_base_branch" mode="inline"-->main<!--boost:conv:end-->. If the project integrates work on a different branch (e.g. `develop`), substitute it in the `origin/<base>` references below.

## When to Use

- The specs folder has accumulated specs for features that already shipped.
- After a batch of PRs merged and their specs were not removed at PR time.
- User asks to "clean up implemented specs" / "prune the specs folder".
- With an argument (a spec path or issue key): evaluate just that one spec.

Not for: writing specs (`write-spec`), implementing them (`implement-spec`), or deleting a spec whose PR is still open — the `pull-requests` skill owns the at-PR-creation removal for the standard flow (see *Relationship to `pull-requests`* below).

## Procedure

Default to a **dry-run report first**. Delete only after showing the user which specs qualify and getting a go-ahead.

### Step 0 — Refresh the base baseline

`origin/<base>` is the source of truth for "shipped", so fetch before any ancestor check:

```bash
git fetch origin <base>
```

### Step 1 — Enumerate candidate specs

Derive the specs directory from the project's `spec.filename_pattern` — the literal path prefix before the first `{…}` placeholder (`specs/` by default; a configured `docs/specs/{issue_key}-{slug}.md` → `docs/specs/`). The commands below use `specs/`; substitute the resolved directory if the project configured a different one.

List **tracked** spec files recursively — specs may live in subdirectories, which a bare `specs/*.md` glob would miss:

```bash
git ls-files 'specs/*.md' 'specs/**/*.md'
```

`git ls-files` (not `ls`) is deliberate: it returns only tracked files, so an untracked local draft is never treated as a deletion candidate, and it reaches subdirectories. A `specs/.gitkeep` is not a `.md` file, so it is excluded automatically. For a single spec named in the argument (path or issue key), evaluate just that one. For each spec, run Steps 2–4.

### Step 2 — Checkoff test

Count unchecked task boxes:

```bash
grep -cE '^\s*- \[ \]' "$SPEC" || true
```

- `> 0` unchecked → **KEEP**, reason `"in progress — N unchecked task(s)"`. Stop evaluating this spec.
- `0` unchecked **and** the file has at least one checked box (`- [x]` / `- [X]`, matched case-insensitively — `grep -cE '^\s*- \[[xX]\]' "$SPEC"` is `> 0`) → checkoff **passes**, continue to Step 3.
- **Zero checkboxes of any kind** (`grep -cE '^\s*- \[[ xX]\]' "$SPEC"` is `0`) → checkoff is indeterminate. **KEEP**, reason `"no task checkboxes — manual review"`. Some small/research specs land here on purpose: surface them, don't auto-delete.

Treat a phase explicitly marked `Priority: LOW` / `Future` / `Deferred` as still-open work: if its boxes are unchecked, the spec is in progress. Do not special-case deferred phases into "done".

### Step 3 — Resolve the issue key

Specs are optionally issue-backed (the `spec.filename_pattern` may carry an `{issue_key}`). Parse the key from the filename per the project's key style (a Jira-style `ABC-1234`, or a bare GitHub number).

- **No key** (a keyless `specs/{slug}.md`) → there is no PR title to map it to, so shipping can't be proven by key. **KEEP**, reason `"no issue key in filename — manual review"`. Stop.

### Step 4 — Shipped-to-base test

List every PR for the key. No single `gh` search reliably covers title, body, **and** branch name, so use two lookups and combine them. Pass an explicit high `--limit` — the default is 30, and the delete guard is only sound if it sees **every** matching PR; if a lookup ever returns the full limit, raise it and re-run rather than trusting a truncated list:

```bash
# Title/body match, all states — the merged-shipped proof plus most open PRs:
gh pr list --search "<ISSUE-KEY>" --state all --limit 100 \
  --json number,state,mergedAt,mergeCommit,baseRefName,headRefName,url
# Open PRs whose BRANCH name carries the key — branch conventions embed it there,
# and GitHub PR search does not reach branch names:
gh pr list --state open --limit 100 --json number,headRefName,url \
  | jq '[.[] | select(.headRefName | test("<ISSUE-KEY>"))]'
```

`gh pr list` auto-detects the repository from the git remote. Combine both results — an open PR from *either* lookup keeps the spec. Missing an open PR is exactly what turns a false "shipped" into a wrong deletion, so if the project's conventions don't reliably put the key in the title, body, **or** branch name, enumeration is weak proof: treat an ambiguous or empty result as **KEEP**, reason `"can't reliably enumerate PRs for this key — manual review"`, rather than risk deleting live work. Classify from the combined result. **Deletion has exactly one positive path — merged and on the base branch with nothing still open; every other outcome keeps the spec.**

- **Any OPEN/DRAFT PR exists** (`state == "OPEN"`, which also covers drafts — from *either* lookup, title/body or branch-name) → still in review. **KEEP**, reason `"in PR/review stage — not on the base branch yet"`. This holds even if another PR for the key already merged: an open PR means unfinished work for this spec.
- **No merged PR** (no PRs, or only CLOSED-unmerged ones for a superseded/abandoned attempt) → cannot confirm the code shipped. **KEEP**, reason `"no merged PR — cannot confirm shipped"`.
- **A MERGED PR exists** (and no open PR) → it is shipped proof **only if it is unambiguously this spec's PR**: the key is in its **title or head-branch name**, not merely mentioned in the body — "related to <key>" / "blocked by <key>" on an unrelated PR is not proof. A body-mention-only match → **KEEP**, reason `"only a body-mention merged PR — manual review"`. For a genuine title/branch match, confirm its merge commit actually reached the base branch (a PR merged into a staging or stacked branch is not proof it is on the base):

  ```bash
  git merge-base --is-ancestor <mergeCommit.oid> origin/<base> && echo ON_BASE || echo NOT_YET
  ```

  - `ON_BASE` and no open PR → **DELETE-ELIGIBLE** — *unless the work was later reverted.* `--is-ancestor` proves the merge commit is in history, not that the implementation still lives on the base: a later revert keeps the merge commit reachable yet removes the code. If a `Revert "…"` of that PR also landed on the base (or the spec's touched files no longer contain the implementation), → **KEEP**, reason `"merged then reverted — manual review"`. When unsure whether a revert landed, keep.
  - `NOT_YET` (merged elsewhere but not on the base branch) → **KEEP**, reason `"merged but not on the base branch yet"`.

  If several PRs merged (multi-phase spec), require **each** merged PR's commit to be an ancestor of `origin/<base>` and un-reverted; if any is `NOT_YET` or reverted, keep.

### Step 5 — Report

Print two groups. This is the default output — stop here unless the user asked to delete outright.

- **Delete-eligible** — one line per spec: filename, issue key, merged PR number(s). These passed both tests.
- **Kept** — one line per spec: filename + the specific reason from Steps 2–4.

Ask the user to confirm before deleting. If the argument scoped a single spec, just report that one's verdict.

### Step 6 — Delete (only after confirmation)

Removing tracked files is a change to the base branch, so it ships via a PR like any other change — never delete straight on a protected branch.

1. **Re-verify eligibility against fresh state first.** The dry-run report may be minutes or hours old, and an open/draft PR could have appeared since — deleting on a stale decision is itself a wrong deletion. Re-run Step 0 (fetch the base) and Steps 2–4 for every spec about to be deleted, and drop any no longer DELETE-ELIGIBLE. Only the survivors proceed.
2. Branch from an up-to-date base (name it per the project's branch conventions — a keyless housekeeping change, so the project's no-issue/`chore` pattern where one exists; the Step 5 confirmation is the go-ahead).
3. `git rm` each surviving delete-eligible spec.
4. Commit with a message that names the housekeeping (e.g. `Remove specs for features shipped to <base>`).
5. Create the PR via the **`pull-requests`** skill (never a direct `gh pr create`). It is a docs-only change with no behavioural effect — low risk — and the PR body lists the removed specs and the merged PR that shipped each.

For a single-spec argument the user may prefer to just `git rm` it inside an existing related branch — follow their lead, but the code still only reaches the base branch through a PR.

## Relationship to `pull-requests`

The `pull-requests` skill removes a spec **when its PR is created**, on the assumption the PR captures everything. `clean-specs` is the **post-merge** net for specs that survived that step — manual implementations, specs deliberately kept through review, or older specs from before that step existed. The two do not conflict: if a spec was already deleted at PR time, `clean-specs` simply never sees it. `clean-specs` never deletes a spec whose PR is still open — that case is exactly what its "PR stage is not implemented" rule protects.

## Guardrails

- **DELETE-ELIGIBLE is a proposal, not a certainty.** Shipped-state is *inferred* from PR metadata (title/branch matching, ancestor checks, revert detection), which is imperfect. The real safety net is the layering: report-first, explicit user confirmation, removal shipped as a reviewable PR, and git-recoverability. Lean **KEEP** on any ambiguity — a kept spec costs a follow-up sweep; a wrongly-deleted one costs lost work.
- **Never delete on an unproven assumption.** Both tests must pass with evidence (all boxes checked; a title/branch-matched merge commit proven an un-reverted ancestor of `origin/<base>`). Anything indeterminate is kept and reported.
- **Report before deleting** by default. The dry-run is the safe mode; deletion is opt-in per run.
- **`origin/<base>` must be freshly fetched** (Step 0) or the ancestor check reads a stale baseline and can wrongly mark in-flight work as shipped.
- **Don't touch `specs/.gitkeep`** — it keeps the empty folder in git.
