---
name: resolve-conflicts
description: "Resolves git merge conflicts without dropping functionality from either side. Merge is the main flow; rebase covered briefly. Activates when: merging branches, resolving conflicts, updating a branch, integrating work, or when user mentions: merge conflict, resolve conflicts, rebase conflict, integrate branch, update branch."
argument-hint: "[optional: branch to merge, e.g. main]"
---

# Resolve Merge Conflicts Without Losing Functionality

The goal is not just to make the conflict markers go away — it is to produce code that preserves **every behavior** from both sides of the merge. Markers gone is not the same as resolved: a clean *textual* merge can still carry a **semantic conflict**, where the code compiles but one side's behaviour was silently dropped. A naive resolution that picks one side is the classic way to ship one.

## When to Use This Skill

- User asks to merge the base branch (e.g. `main`) into the current branch
- User asks to update/sync a branch with the base branch
- Git reports `CONFLICT` during merge, rebase, or cherry-pick
- User mentions: merge conflict, resolve conflicts, rebase conflict, integrate branch, update branch

## Core Principle

Every conflict is a collision between two intentions, and a good resolution **preserves both intents**. Reason from the **three-way merge** base (ours / theirs / common ancestor) to recover what each side meant to change. Before resolving, understand **both** intentions:

- **HEAD (your branch)** usually contains a focused change — a refactor, feature, or fix.
- **The other branch** (the base branch you are merging in) contains unrelated work that has landed since you branched — new features, bug fixes, type migrations, schema changes.

A good resolution keeps the intent of **both**: apply HEAD's refactor/pattern to the new code that landed on the other branch.

## Workflow

### Phase 0: Preflight and Conflict Detection (No Side Effects)

**First, require a clean working tree.**

```bash
git status --porcelain --untracked-files=no
```

Any output — stop and have the user commit or stash before merging. This is not a formality; a dirty tree does not reliably stop the merge, it corrupts the verification:

- `git merge` aborts only when the incoming change would **overwrite** a dirty file. When the dirty file is one the merge does not touch, git proceeds and the local edits stay sitting in the tree.
- Phase 4's diffs then list those work-in-progress files right alongside the resolved ones, with nothing to distinguish local WIP from a resolution edit. The gate that is supposed to catch a dropped feature reports files you never merged.

**Untracked files are excluded above on purpose, but they are not harmless.** `--untracked-files=no` keeps the gate practical — build output, `.env`, and editor droppings should not block a merge, and untracked files never show up in Phase 4's diffs, so they cannot muddy the verification. They can still stop the merge outright: if the incoming side adds a file at a path where an untracked file already sits, git refuses with `error: The following untracked working tree files would be overwritten by merge`. That is not a conflict and not a dirty-tree failure — move or delete the named file and re-run the merge.

**Then detect conflicts without side effects.** `git merge-tree` performs the merge in memory and writes nothing to the working tree or index:

```bash
git fetch origin <base-branch>
git merge-tree --write-tree --name-only HEAD origin/<base-branch>
```

- **Exit 0** — no *textual* conflict; the only stdout is the resulting tree OID. This probe merged nothing, so **still run Phase 1** to perform the real merge; you then skip Phases 2–3 (no conflicts to reason about) and go to **Phase 4 Check 2** and **Phase 5**. A conflict-free merge can still break the build — "nothing to resolve" is not "nothing to verify."
- **Exit 1** — **either** conflicts **or** a bad ref; they share the exit code, so distinguish by **stdout**:
  - Conflicts write the resulting tree OID, then the conflicted paths, then `CONFLICT (...)` messages, all to **stdout** (stderr stays empty). These are exactly the files Phase 2 must reason about.
  - A bad/unknown ref writes **nothing to stdout** and `merge-tree: <ref> - not something we can merge` to **stderr**. Fix the ref — do not mistake it for a conflict.
  - In short: exit 1 **with non-empty stdout** = conflicts; exit 1 **with empty stdout** = bad ref.
- **Exit 128** — a usage or precondition error, never a conflict. Both unrelated histories (`fatal: refusing to merge unrelated histories`) and `--quiet` combined with `--name-only` (`options '--quiet' and '--name-only' cannot be used together`) land here. Read stderr and fix the invocation.

This needs Git ≥ 2.38. On older Git, fall back to a throwaway probe in a temp worktree (`git worktree add`), never in the user's live working tree. Working from a PR number with no checkout? See [Checking a PR without a checkout](#auxiliary-checking-a-pr-without-a-checkout).

### Phase 1: Start the Merge

```bash
git fetch origin <base-branch>
git merge --no-commit origin/<base-branch>
```

**`--no-commit` is deliberate.** Without it a conflict-free merge commits *immediately*, and every verification this skill prescribes would then run against a commit that already exists — leaving a failed check fixable only by amending or resetting the merge. With it, both paths behave the same way: conflicted or clean, the merge sits staged until Phase 6 commits it.

Three outcomes need different handling:

- **"Already up to date"** — nothing to do; stop here.
- **Fast-forward** — `--no-commit` does *not* stop one; git moves HEAD regardless. That is fine: a fast-forward means your branch had no commits of its own, so there is no resolution to get wrong and nothing of yours to drop. Nothing to verify and nothing to commit — stop here; do not fall through to Phase 6.
- **Anything else** — a real merge, conflicted or clean. Both still owe you Phase 4 Check 2 and Phase 5 before Phase 6 commits.

Enumerate the conflicts precisely — do **not** eyeball `git status` prose:

```bash
git diff --name-only --diff-filter=U     # every unmerged path
git status --short                       # two-letter code per path — read these
```

**Not every conflict has `<<<<<<<` markers.** Deciding what is left to resolve by grepping for markers will silently skip whole files:

| Status | Shape | What the working tree actually holds |
|--------|-------|--------------------------------------|
| `UU`, `AA` | both modified / both added | Markers, as expected |
| `DU`, `UD` | modify/delete, rename/delete | **No markers.** Git leaves the *surviving* side's full content in place, looking like an ordinary resolved file |

`git ls-files -u <file>` disambiguates: stage 1 is the merge base, 2 is ours, 3 is theirs. A missing stage 2 means our side deleted it; a missing stage 3 means theirs did.

Do **not** abort unless the user asks.

### Phase 2: Understand Each Conflict

For every conflicted file, before editing:

1. **Read the conflicted file.** For `UU`/`AA` that means the `<<<<<<<` / `=======` / `>>>>>>>` markers. For `DU`/`UD` there are no markers to read — the file holds one side's content whole, and the other side is only visible through git: `git show :1:<file>` (merge base) and `git show :2:<file>` / `git show :3:<file>` (ours / theirs, whichever exists).
2. **Find out what each side did** — do NOT assume:
   ```bash
   git log HEAD --oneline -10 -- <file>
   git log origin/<base-branch> --oneline -10 -- <file>
   ```
3. **If a commit on either side looks load-bearing, inspect it**:
   ```bash
   git show <sha> -- <file>
   ```
4. **Check for related files** — a conflict in one file often correlates with a non-conflicting auto-merged change in a sibling file (a related class, config, or type definition). Read those too:
   ```bash
   git show origin/<base-branch>:<related-file> | head -80
   ```

**Do not resolve a conflict you don't understand.** If the purpose of either side is unclear after reading the commits, ask the user.

### Phase 3: Resolve Each Conflict

Pick the strategy that preserves both intents:

| Situation | Strategy |
|-----------|----------|
| HEAD refactored X, base branch added a new field to X | Keep HEAD's refactored style, extend it to cover the new field |
| HEAD and the base branch both fixed the same bug differently | Ask the user — do not guess |
| HEAD added feature A, the base branch added feature B to the same spot | Keep both; place them in the order they appear on each side |
| One side is strictly a superset of the other (e.g. the base branch has everything HEAD has + more) | Take the superset |
| Conflict is a pure formatting/whitespace disagreement | Match project convention |
| **Modify/delete** (`DU`/`UD`) — one side edited the file, the other deleted it | Establish *why* it was deleted before choosing: `git log --oneline <deleting-side> -- <file>`. Feature genuinely removed → `git rm <file>`, and check whether the edit needs re-applying wherever the feature moved to. Deleted by accident or the edit is still needed → `git add <file>` to keep it |
| **Rename/delete** (`UD`) — one side renamed the file, the other deleted it | Same question, at the new path. Keeping it means `git add <new-path>`; accepting the delete means `git rm <new-path>` |

**Beware different accessor/API patterns for the same value.** If the two sides reach the same value through different APIs or accessor patterns (raw access vs typed accessors, one helper vs another), the two forms may **not** be drop-in equivalents — they can differ for some inputs (null handling, type coercion, throw-vs-return on bad input). Do not silently substitute one form for the other. Verify the behaviour first — write a quick test or probe it in a REPL — and if they genuinely differ, either keep the original form or flag the change explicitly.

### Phase 4: Verify Nothing Was Dropped (Critical)

**The gate: markers gone is not resolved — did the result preserve both intents?** This is where the semantic conflict gets caught, via two checks that answer different questions. Check 1 applies when there were conflicts to resolve; **Check 2 applies to every merge, including one git reported as clean.**

#### Check 1: Did the resolution keep both sides?

Diff the resolved *working tree* against **both** sides. These forms compare the working tree (not `HEAD`, which is still the pre-merge commit until you commit in Phase 6):

```bash
# Working tree vs the branch we merged in — should show only our refactor/feature.
git diff origin/<base-branch> -- <file>

# Working tree vs our branch before the merge — shows everything the merge brought in plus your resolution edits.
git diff ORIG_HEAD -- <file>
```

If you prefer to verify after committing (Phase 6), use commit-vs-commit forms instead: `git diff origin/<base-branch>..HEAD -- <file>` and `git diff ORIG_HEAD..HEAD -- <file>`. Do not mix the two — `git diff origin/<base-branch> HEAD -- <file>` before commit compares two commits and ignores your working-tree resolution entirely.

Read each diff carefully. For every removed line, ask: *is this removal intentional?* If a field, branch of logic, feature flag gate, or side-effect disappeared, it needs to be restored.

Common things that silently vanish during conflict resolution:
- New fields set on a model/object
- Feature-flag-gated blocks of code
- New validation rules
- New imports (leading to undefined symbol errors later)
- Subtly different accessor patterns that are **not** interchangeable when the value can be `null` — see the warning in Phase 3

#### Check 2: Cross-side consistency — always, including a conflict-free merge

The diffs above answer *"did I keep both sides' changes?"* They cannot answer *"do those changes still agree with each other?"* — and that second question is where a clean merge ships broken code.

Constructed and observed: the base branch renames `Helper::formatAmount()` to `formatMoney()` and updates its own call site; your branch adds a new `Receipt.php` calling `formatAmount()`. Git merges the two cleanly — exit 0, empty `git status`, fully merged — and `Receipt.php` now calls a method that no longer exists. Run Check 1 on it and `git diff origin/<base-branch>` reports `Receipt.php`, two insertions: your own new file, added by your own branch, which is **precisely** the "only our refactor/feature" result you were told to expect. `Helper.php` does not appear at all, because after the merge your copy matches the base's exactly. Nothing in the output is wrong or missing. The rename and the stale call site simply never land in the same frame, so every element passes in isolation.

This skill ships a companion that finds these. `boost sync` emits it beside the rendered `SKILL.md` in each agent's skill directory, so it is already on disk — under Claude Code at `.claude/skills/resolve-conflicts/scripts/dangling-symbols.sh` (swap the skills-dir prefix for another agent). Commands run from the project root, not the skill directory, so use that full path. Emitted assets carry no executable bit, so invoke via `bash <script>`, never directly:

```bash
bash .claude/skills/resolve-conflicts/scripts/dangling-symbols.sh \
  --base origin/<base-branch> -- src/
```

It checks **both** directions (they removed something you call, *and* you removed something they call — a one-directional sweep passes half the cases), resolves our side automatically (`HEAD^1` after the merge commit, else `ORIG_HEAD`), and works before the merge is committed as well as after. Exit 1 means it found something; `--keywords` retargets it at another language and `--help` documents the rest.

Treat hits as candidates, not verdicts — short or generic names over-match. **Phase 5 is the authoritative pass:** the test suite and static analysis settle what this only flags. Its value is speed and reach — it runs in seconds, and it runs even when git reported no conflict at all.

### Phase 5: Run Quality Checks on the Merged Result

Delegate to the project's quality-check skills rather than invoking the tools by hand. Pick based on which files the merge actually touched:

| Files changed       | Skill to invoke    |
|---------------------|--------------------|
| Backend files       | `backend-quality`  |
| Frontend files      | `frontend-quality` |
| Both                | Both, in parallel  |

Both skills already scope checks to the touched files first and keep the slower, full-suite gates for completion-level runs — which matches this phase.

In addition to what those skills cover, also run **targeted feature tests** for any endpoint, job, or action the merged files participate in (not just the unit tests on the resolved class itself — a merge can break integration points that unit tests miss).

**Before fixing a failure, establish that the merge caused it — and baseline against *both* parents.** The quality skills demand zero failures, which is the right bar for code you wrote; a merge also inherits whatever was already red, and that is not yours to fix mid-merge. But "already red on my branch" is **not** enough to call a failure pre-existing. A merge has two parents, and a test that was red on yours may well have been *fixed* on the incoming one — in which case a red result after the merge means your resolution dropped that fix. Checking only your own side calls that "pre-existing" and ships exactly the dropped-functionality bug this whole skill exists to prevent.

Mid-merge, the obvious approaches do not work: with unmerged paths in the index, `git checkout ORIG_HEAD` refuses (`you need to resolve your current index first`) and `git stash` refuses (`could not write index`). Use side worktrees, which leave the in-progress merge untouched:

```bash
git worktree add ../baseline-ours   ORIG_HEAD               # your pre-merge tip (HEAD^1 once committed)
git worktree add ../baseline-theirs origin/<base-branch>    # the incoming side
# install dependencies in each if the project needs them, then run the same failing test in both
git worktree remove ../baseline-ours && git worktree remove ../baseline-theirs
```

| Ours (`ORIG_HEAD`) | Theirs (`origin/<base>`) | Verdict |
|--------------------|--------------------------|---------|
| fail | fail | **Genuinely pre-existing.** Report it and move on — repairing it here buries an unrelated fix inside a merge commit |
| **fail** | **pass** | **The incoming side fixed it and your resolution dropped the fix.** Fix it, then go back to Phase 4 — if this was dropped, something else probably was too |
| pass | fail | The incoming branch is red here; your resolution did not cause it, but the merged branch now carries it. Report it and let the user decide whether to fix it in this merge or separately |
| pass | pass | **The merge introduced it.** Fix it before committing, and treat it as a signal that a resolution dropped something Phase 4 missed |

### Phase 6: Commit the Merge

```bash
git add <resolved-files>     # conflicted merge only — a clean --no-commit merge is already staged
git status                   # conflicted merge: confirm "All conflicts fixed"
git commit --no-edit
```

`--no-edit` keeps the default merge-commit message. Committing after `--no-commit` still produces a proper two-parent merge commit — the deferred commit changes *when* it is recorded, never what it records. Do not amend or squash a merge commit unless the user asks.

### Phase 7: Report

Report back with:

1. Which conflicts were resolved and the strategy used for each (none, for a clean merge)
2. Which features/fields/branches from the base branch were preserved (name them explicitly)
3. Any semantic differences introduced (e.g. stricter input parsing) and why they are safe
4. Verification results: quality checks pass, N tests passed
5. The merge commit SHA
6. Whether the branch was pushed (default: **not** pushed — let the user decide)

## Anti-patterns to Avoid

- **Accepting one side wholesale** without checking what the other side did. `git checkout --ours` / `--theirs` is almost always wrong.
- **Resolving conflicts in the editor without running `git diff origin/<base-branch>` afterwards.** The markers going away doesn't mean the merge is correct — that's exactly how a semantic conflict slips through.
- **Copy-pasting the base branch's code with stale imports or deprecated method calls** that no longer exist after a refactor on HEAD.
- **Grepping for `<<<<<<<` to decide what is left to resolve.** Modify/delete and rename/delete conflicts carry no markers — the file looks finished. Enumerate with `git diff --name-only --diff-filter=U` and read the status codes.
- **Treating a conflict-free merge as a verified merge.** Git reporting no conflict says the two texts combined, not that the result works. Run Phase 4 Check 2 and Phase 5 anyway.
- **Merging with a dirty working tree.** Git only blocks it when the merge would overwrite the dirty file; otherwise the WIP stays and pollutes every verification diff afterwards.
- **Calling a failure "pre-existing" because it was red on your branch.** A merge has two parents. If the incoming side was green, the failure means your resolution dropped their fix — the very bug this skill exists to prevent. Baseline against **both** parents before dismissing anything.
- **Skipping the quality checks** because "it was just a merge". A merge is a code change.
- **Pushing immediately** after resolving — let the user review the merge commit first.
- **Using `git merge --abort` to escape a hard conflict** without asking. Discarding the merge loses the partial resolution work the user may want to keep.

## Auxiliary: Checking a PR Without a Checkout

For a yes/no on a PR you have not fetched, GitHub exposes a computed mergeability flag. This answers *whether* — it never names the conflicted files, so it does not replace Phase 0's `git merge-tree`:

```bash
gh api graphql -F owner='{owner}' -F repo='{repo}' -F number=<NUMBER> -f query='
query ($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) { mergeable mergeStateStatus }
  }
}' --jq '.data.repository.pullRequest'
```

`mergeable` is `MERGEABLE` / `CONFLICTING` / `UNKNOWN`, and **`UNKNOWN` is not "no conflicts"** — GitHub computes it asynchronously, so re-query after a few seconds rather than treating it as clean. `mergeStateStatus` adds detail (`DIRTY` = conflicts, plus `BEHIND`, `CLEAN`, …).

## Auxiliary: Rebase Conflicts

The workflow above is written for `git merge`. Rebase conflicts share most of the same reasoning (understand both sides, diff before committing, run quality checks) but the mechanics differ:

- Conflicts are resolved **per replayed commit**, not all at once.
- Continue each step with `git rebase --continue`, not `git commit --no-edit`.
- `ORIG_HEAD` is set to the pre-rebase tip and remains stable across the rebase, so the Phase 4 Check 1 diff forms still work.
- **Never** force-push a rebased shared branch without explicit user approval.

If the rebase is non-trivial (multiple conflicting commits, or a long-running branch), consider aborting with `git rebase --abort` and doing a merge instead — merges are usually easier to review and revert.
</content>
</invoke>
