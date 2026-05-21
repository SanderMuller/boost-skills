---
name: resolve-conflicts
description: "Resolves git merge conflicts without dropping functionality from either side. Merge is the main flow; rebase covered briefly. Activates when: merging branches, resolving conflicts, updating a branch, integrating work, or when user mentions: merge conflict, resolve conflicts, rebase conflict, integrate branch, update branch."
argument-hint: "[optional: branch to merge, e.g. main]"
---

# Resolve Merge Conflicts Without Losing Functionality

The goal is not just to make the conflict markers go away — it is to produce code that preserves **every behavior** from both sides of the merge. A naive resolution that picks one side often silently drops features from the other.

## When to Use This Skill

- User asks to merge the base branch (e.g. `main`) into the current branch
- User asks to update/sync a branch with the base branch
- Git reports `CONFLICT` during merge, rebase, or cherry-pick
- User mentions: merge conflict, resolve conflicts, rebase conflict, integrate branch, update branch

## Core Principle

Every conflict is a collision between two intentions. Before resolving, understand **both** intentions:

- **HEAD (your branch)** usually contains a focused change — a refactor, feature, or fix.
- **The other branch** (the base branch you are merging in) contains unrelated work that has landed since you branched — new features, bug fixes, type migrations, schema changes.

A good resolution keeps the intent of **both**: apply HEAD's refactor/pattern to the new code that landed on the other branch.

## Workflow

### Phase 1: Start the Merge

```bash
git fetch origin <base-branch>
git merge origin/<base-branch>
```

If conflicts appear, `git status` will list them under "Unmerged paths". Do **not** abort unless the user asks.

### Phase 2: Understand Each Conflict

For every conflicted file, before editing:

1. **Read the conflicted file** to see the `<<<<<<<` / `=======` / `>>>>>>>` markers.
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

**Beware different accessor/API patterns for the same value.** If the two sides reach the same value through different APIs or accessor patterns (raw access vs typed accessors, one helper vs another), the two forms may **not** be drop-in equivalents — they can differ for some inputs (null handling, type coercion, throw-vs-return on bad input). Do not silently substitute one form for the other. Verify the behaviour first — write a quick test or probe it in a REPL — and if they genuinely differ, either keep the original form or flag the change explicitly.

### Phase 4: Verify Nothing Was Dropped (Critical)

**This is where most bad merges are caught.** After resolving every conflict, diff the resolved *working tree* against **both** sides. These forms compare the working tree (not `HEAD`, which is still the pre-merge commit until you commit in Phase 6):

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

### Phase 5: Run Quality Checks on Resolved Files

Delegate to the project's quality-check skills rather than invoking the tools by hand. Pick based on which files the merge actually touched:

| Files changed       | Skill to invoke    |
|---------------------|--------------------|
| Backend files       | `backend-quality`  |
| Frontend files      | `frontend-quality` |
| Both                | Both, in parallel  |

Both skills already scope checks to the touched files first and keep the slower, full-suite gates for completion-level runs — which matches this phase.

In addition to what those skills cover, also run **targeted feature tests** for any endpoint, job, or action the merged files participate in (not just the unit tests on the resolved class itself — a merge can break integration points that unit tests miss).

Fix any failures before committing.

### Phase 6: Commit the Merge

```bash
git add <resolved-files>
git status        # confirm "All conflicts fixed"
git commit --no-edit
```

Use `--no-edit` to keep the default merge-commit message. Do not amend or squash a merge commit unless the user asks.

### Phase 7: Report

Report back with:

1. Which conflicts were resolved and the strategy used for each
2. Which features/fields/branches from the base branch were preserved (name them explicitly)
3. Any semantic differences introduced (e.g. stricter input parsing) and why they are safe
4. Verification results: quality checks pass, N tests passed
5. The merge commit SHA
6. Whether the branch was pushed (default: **not** pushed — let the user decide)

## Anti-patterns to Avoid

- **Accepting one side wholesale** without checking what the other side did. `git checkout --ours` / `--theirs` is almost always wrong.
- **Resolving conflicts in the editor without running `git diff origin/<base-branch>` afterwards.** The markers going away doesn't mean the merge is correct.
- **Copy-pasting the base branch's code with stale imports or deprecated method calls** that no longer exist after a refactor on HEAD.
- **Skipping the quality checks** because "it was just a merge". A merge is a code change.
- **Pushing immediately** after resolving — let the user review the merge commit first.
- **Using `git merge --abort` to escape a hard conflict** without asking. Discarding the merge loses the partial resolution work the user may want to keep.

## Auxiliary: Rebase Conflicts

The workflow above is written for `git merge`. Rebase conflicts share most of the same reasoning (understand both sides, diff before committing, run quality checks) but the mechanics differ:

- Conflicts are resolved **per replayed commit**, not all at once.
- Continue each step with `git rebase --continue`, not `git commit --no-edit`.
- `ORIG_HEAD` is set to the pre-rebase tip and remains stable across the rebase, so the Phase 4 diff forms still work.
- **Never** force-push a rebased shared branch without explicit user approval.

If the rebase is non-trivial (multiple conflicting commits, or a long-running branch), consider aborting with `git rebase --abort` and doing a merge instead — merges are usually easier to review and revert.
</content>
</invoke>
