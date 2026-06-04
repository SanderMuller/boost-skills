---
name: evaluate
description: "Self-directed eval loop: review own implementation, fix issues found, re-evaluate until clean, then run code review. Fix yourself; only ask the user for decisions. Activates when: evaluating implementation, self-reviewing code, checking for issues, or when user mentions: evaluate, check implementation, self-review, verify implementation."
argument-hint: "[file path, feature name, or description of what to evaluate]"
metadata:
  schema-required: "^1"
---

# Evaluate Implementation

A self-directed loop: evaluate your own work, fix what you find, re-evaluate until clean, then run a code review for a fresh-eyes pass. Do not ask the user to fix things — fix them yourself.

## When to Use This Skill

- After implementing a feature or fixing a bug (all code is written)
- When the user says "evaluate", "check this", or "review your work"
- Before creating a PR or marking work as done

**Note:** This skill is a completion-level activity. It runs the full `backend-quality` skill (including PHPStan and full test suite). Do not use this skill mid-feature — only when the implementation is done.

## Workflow

### Phase 1: Run Quality Checks (Skip If Recent)

Before running checks, review the current conversation for recent quality check results. **Skip checks that already passed clean and where no code changes were made since.**

**Skip criteria — all must be true:**
1. The check was run earlier in this conversation (not a previous session)
2. The check passed with zero errors/failures
3. No files of that type were added, removed, or changed after the check passed

**What counts as "recently passed":**
- Code style: ran with no changes needed
- Static analysis: ran with 0 errors
- Tests: ran with 0 failures (full suite or all relevant tests)
- Type checking: ran with 0 errors
- Linting: a full run ran with 0 errors (a scoped run on a subset of files does not count)

**If checks can be skipped**, state which specific checks you're skipping and why. Skipping is decided **per individual check**, not all-or-nothing for an entire skill:
> "Skipping code style and static analysis — both passed clean earlier with no backend changes since; re-running tests to verify behavior."

**If any doubt**, run the checks. It's better to re-run than to miss a failure.

**Otherwise**, run checks based on which files were changed:
- **Backend files changed** — use the `backend-quality` skill
- **JS/TS files changed** — use the `frontend-quality` skill

Fix all failures before continuing.

### Phase 2: Review for Issues

Read through all changed files and check for:

| Category | What to look for |
|----------|-----------------|
| **Edge cases** | Null handling, empty collections, zero values, boundary conditions |
| **Race conditions** | Concurrent requests causing data corruption, non-atomic operations |
| **Security** | Unvalidated input, type confusion |
| **Logic errors** | Wrong conditions, off-by-one errors, swallowed exceptions |
| **Missing tests** | Happy paths, failure paths, and edge cases that aren't tested |
| **Convention violations** | Deviations from project patterns (check sibling files) |
| **Cross-version compat** | Works across every runtime and dependency version the project supports |

**DB-driven translation keys** (only when a project translation-key policy is configured):

<!--boost:conv path="translations" mode="yaml" fallback="not configured — skip this check"-->

If a policy is shown above, flag any DB-driven translation key that does not match its `key_pattern`. Exempt file-based keys: top-level groups listed in `file_based_prefixes.framework_groups`, and — when `vendor_namespace_exempt` is true — any key matching a vendor namespace prefix like `package::` (keys validated by the framework's own file-based lang files are out of scope). If `rules_doc` is set, also apply its naming-quality guidance. When nothing is configured, skip this check.

### Phase 3: Fix Issues

For each issue found:

1. Fix it yourself — do not list it as a suggestion for the user
2. Run the affected tests again to verify the fix
3. If the fix requires a design decision, ask the user

### Phase 4: Re-evaluate (Loop Until Clean)

After fixing issues, re-run only the checks affected by your fixes (e.g., if you only fixed backend files, skip frontend checks). Repeat until a full pass finds no new issues. Only then move to Phase 5.

### Phase 5: Code Review

Once the evaluate-fix loop is clean, run the `code-review` skill for a structured review from a different angle (functionality, UX/UI, security, testing). Fix any findings from the code review and re-verify.

### Phase 6: Codex Review (Manual Invocation Only)

If the user directly requested this evaluation (e.g., typed `/evaluate`, said "evaluate this", or "review your work"), run the `codex-review` skill for a multi-model second opinion. Critically evaluate and implement any warranted feedback, then re-verify.

**Skip this phase** when the evaluate skill is invoked automatically by another skill or workflow (e.g., as part of the PR flow or implementation pipeline) rather than by the user themselves.

### Phase 7: Report

Summarize what you found and fixed across all passes:

```markdown
## Evaluation Summary

### Issues Found & Fixed
1. **[Issue]** — [What was wrong and how you fixed it]

### Verified
- All tests pass (X tests, Y assertions)
- PHPStan clean
- Code style clean

### No Issues Found In
- [Categories that were clean]
```

If no issues were found, say so briefly and move on.

## Guidelines

- **Fix, don't report** — the point of this skill is to catch and fix issues, not to generate a list for the user
- **Loop until clean** — do not stop after the first fix pass; re-evaluate until nothing remains
- **Be thorough but fast** — check all dimensions but don't over-analyze obvious code
- **Run tests after every fix** — don't batch fixes and hope they all work
- **Trust existing patterns** — if the codebase does something a certain way consistently, follow it
